import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

// The admin console's functions against a real PostgreSQL (PGlite). PGlite
// lacks pgcrypto, so the password and token helpers are swapped for built-ins.
let db
const read = (file) => readFileSync(new URL(`../../supabase/${file}`, import.meta.url), 'utf8')
const q1 = async (sql, args) => (await db.query(sql, args)).rows[0].r
const admin = (token, action, data = {}) => q1('select cb_admin($1,$2,$3) r', [token, action, JSON.stringify(data)])
const setup = (email, pw) => q1('select cb_admin_setup($1,$2) r', [email, pw])
const login = (email, pw) => q1('select cb_admin_login($1,$2) r', [email, pw])
const ids = {}
let boss

beforeAll(async () => {
  db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role; create schema extensions;')
  await db.exec(read('tournaments.sql'))
  await db.exec(read('accounts.sql').replace('create extension if not exists pgcrypto with schema extensions;', '')
    .replace("extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')", "sha256(convert_to(p_token, 'UTF8'))"))
  await db.exec(read('leaderboard.sql'))
  // An install from the earlier version (admins tied to game accounts) upgrades cleanly
  await db.exec(`create table cb_admins (account_id uuid primary key references cb_accounts(id));
    create table cb_admin_log (id bigint generated always as identity primary key, admin_name text not null, action text not null);
    create function cb_admin(p_token text, p_action text, p_data jsonb default '{}') returns jsonb language sql as $$ select '{}'::jsonb $$;`)
  const sql = read('admin.sql')
    .replace("select extensions.crypt(p, extensions.gen_salt('bf', 10))", "select md5(p)")
    .replace("select h = extensions.crypt(coalesce(p, ''), h)", "select h = md5(coalesce(p, ''))")
    .replace("select encode(extensions.gen_random_bytes(32), 'hex')", "select md5(random()::text) || md5(random()::text)")
  await db.exec(sql)
  await db.exec(sql) // safe to run again
  for (const name of ['pat', 'sam']) {
    const r = await db.query("insert into cb_accounts(username,display_name,pass_hash,save_data,saved_at) values($1,$1,'x',$2,now()) returning id", [name, JSON.stringify({ v: 1, items: { k: 'v' } })])
    ids[name] = r.rows[0].id
    await db.query("insert into cb_account_sessions(token_hash,account_id) values (cb_account_hash($1),$2)", [name.repeat(20), ids[name]])
  }
  await db.query("insert into cb_board(account_id,period,played,won,goals) values ($1,'all',5,3,9)", [ids.pat])
}, 20000)
afterAll(async () => db?.close())

describe('admin console', () => {
  it('asks for the first login once, then closes setup for good', async () => {
    expect((await q1('select cb_admin_status() r')).setup).toBe(true)
    await expect(setup('not-an-email', 'longenough1')).rejects.toThrow('bad-email')
    await expect(setup('me@counterball.fun', 'short')).rejects.toThrow('weak-password')
    const r = await setup('Me@Counterball.fun', 'longenough1')
    expect(r.email).toBe('me@counterball.fun')
    boss = r.token
    expect((await q1('select cb_admin_status() r')).setup).toBe(false)
    await expect(setup('intruder@x.com', 'longenough1')).rejects.toThrow('setup-done')
  })

  it('signs in with email and password, and locks out after five wrong tries', async () => {
    expect((await login('me@counterball.fun', 'nope')).error).toBe('wrong-login')
    const ok = await login(' ME@counterball.fun ', 'longenough1')
    expect(ok.token).toBeTruthy()
    expect((await admin(ok.token, 'me')).email).toBe('me@counterball.fun')
    await q1('select cb_admin_logout($1) r', [ok.token])
    await expect(admin(ok.token, 'me')).rejects.toThrow('signed-out')
    for (let i = 0; i < 5; i++) await login('x@y.com', 'bad')
    await expect(login('x@y.com', 'bad')).rejects.toThrow('too-many-tries')
  })

  it('turns away game tokens and nonsense', async () => {
    await expect(admin('pat'.repeat(20), 'overview')).rejects.toThrow('signed-out')
    await expect(admin('nope', 'overview')).rejects.toThrow('signed-out')
    await expect(admin(boss, 'drop-everything')).rejects.toThrow('bad-action')
  })

  it('shows the numbers, players and leaderboard', async () => {
    const o = await admin(boss, 'overview')
    expect(o.players).toBe(2)
    expect(o.signups).toHaveLength(14)
    const list = await admin(boss, 'players', { q: 'pa' })
    expect(list.total).toBe(1)
    const p = await admin(boss, 'player', { id: ids.pat })
    expect(p.save.items.k).toBe('v')
    expect((await admin(boss, 'board', { period: 'all' })).rows[0].name).toBe('pat')
  })

  it('manages players and logs it without passwords', async () => {
    await admin(boss, 'reset-password', { id: ids.sam, password: 'newpass1' })
    expect((await db.query('select count(*)::int n from cb_account_sessions where account_id = $1', [ids.sam])).rows[0].n).toBe(0)
    await admin(boss, 'board-remove', { id: ids.pat, period: 'all' })
    await admin(boss, 'delete-player', { id: ids.sam })
    expect((await admin(boss, 'overview')).players).toBe(1)
    const { log } = await admin(boss, 'admins')
    expect(log.map((l) => l.action)).toContain('reset-password')
    expect(JSON.stringify(log)).not.toContain('newpass1')
  })

  it('adds and removes admins, and changes your own password', async () => {
    await admin(boss, 'add-admin', { email: 'friend@x.com', password: 'friendpass1' })
    await expect(admin(boss, 'add-admin', { email: 'friend@x.com', password: 'friendpass1' })).rejects.toThrow('email-taken')
    const friend = (await login('friend@x.com', 'friendpass1')).token
    expect((await admin(friend, 'me')).email).toBe('friend@x.com')
    const rows = (await admin(boss, 'admins')).rows
    const meId = rows.find((r) => r.email === 'me@counterball.fun').id
    await expect(admin(boss, 'remove-admin', { id: meId })).rejects.toThrow('not-yourself')
    await admin(boss, 'remove-admin', { id: rows.find((r) => r.email === 'friend@x.com').id })
    await expect(admin(friend, 'me')).rejects.toThrow('signed-out')
    await expect(admin(boss, 'change-password', { current: 'wrong', password: 'brandnewpass' })).rejects.toThrow('wrong-current')
    await admin(boss, 'change-password', { current: 'longenough1', password: 'brandnewpass' })
    expect((await login('me@counterball.fun', 'brandnewpass')).token).toBeTruthy()
  })

  it('lists, closes and deletes online tournaments', async () => {
    await db.query("insert into cb_tournaments(code,setup,host_token_hash) values ('ABC123', '{\"name\":\"Office Cup\"}', 'h')")
    const t = await admin(boss, 'tournaments')
    expect(t.rows[0]).toMatchObject({ code: 'ABC123', name: 'Office Cup', closed: false })
    await admin(boss, 'close-tournament', { id: t.rows[0].id })
    await admin(boss, 'delete-tournament', { id: t.rows[0].id })
    expect((await admin(boss, 'tournaments')).total).toBe(0)
    expect((await admin(boss, 'matches')).missing).toBe(true)
  })
})
