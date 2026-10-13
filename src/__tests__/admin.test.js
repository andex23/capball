import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

// The admin functions against a real PostgreSQL (PGlite). PGlite lacks
// pgcrypto, so hashing is swapped for built-ins, as in the other DB tests.
let db
const boss = 'b'.repeat(48), pat = 'p'.repeat(48), sam = 's'.repeat(48)
const read = (file) => readFileSync(new URL(`../../supabase/${file}`, import.meta.url), 'utf8')
const admin = async (token, action, data = {}) => (await db.query('select cb_admin($1,$2,$3) result', [token, action, JSON.stringify(data)])).rows[0].result
const ids = {}

beforeAll(async () => {
  db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role; create schema extensions;')
  await db.exec(read('tournaments.sql'))
  await db.exec(read('accounts.sql').replace('create extension if not exists pgcrypto with schema extensions;', '')
    .replace("extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')", "sha256(convert_to(p_token, 'UTF8'))"))
  await db.exec(read('leaderboard.sql'))
  const sql = read('admin.sql').replace("extensions.crypt(d->>'password', extensions.gen_salt('bf', 10))", "md5(d->>'password')")
  await db.exec(sql)
  await db.exec(sql) // safe to run again
  for (const [name, token] of [['boss', boss], ['pat', pat], ['sam', sam]]) {
    const r = await db.query("insert into cb_accounts(username,display_name,pass_hash,save_data,saved_at) values($1,$1,'x',$2,now()) returning id", [name, JSON.stringify({ v: 1, items: { k: 'v' } })])
    ids[name] = r.rows[0].id
    await db.query('insert into cb_account_sessions(token_hash,account_id) values (cb_account_hash($1),$2)', [token, ids[name]])
  }
  await db.query('insert into cb_admins(account_id) values ($1)', [ids.boss])
  await db.query("insert into cb_board(account_id,period,played,won,goals) values ($1,'all',5,3,9)", [ids.pat])
}, 20000)
afterAll(async () => db?.close())

describe('admin page functions', () => {
  it('turns away anyone who is not an admin', async () => {
    await expect(admin(pat, 'overview')).rejects.toThrow('not-admin')
    await expect(admin('nope'.repeat(10), 'overview')).rejects.toThrow('signed-out')
    await expect(admin(boss, 'drop-everything')).rejects.toThrow('bad-action')
  })

  it('gives an admin the numbers, players and leaderboard', async () => {
    const o = await admin(boss, 'overview')
    expect(o.players).toBe(3)
    expect(o.active24h).toBe(3)
    expect(o.signups).toHaveLength(14)
    expect(o.signups.at(-1).n).toBe(3)
    const list = await admin(boss, 'players', { q: 'pa' })
    expect(list.total).toBe(1)
    expect(list.rows[0].name).toBe('pat')
    const p = await admin(boss, 'player', { id: ids.pat })
    expect(p.save.items.k).toBe('v')
    expect(p.board[0].won).toBe(3)
    const b = await admin(boss, 'board', { period: 'all' })
    expect(b.rows[0].name).toBe('pat')
  })

  it('resets a password, signs a player out, and logs it', async () => {
    await admin(boss, 'reset-password', { id: ids.sam, password: 'newpass1' })
    const s = await db.query('select count(*)::int n from cb_account_sessions where account_id = $1', [ids.sam])
    expect(s.rows[0].n).toBe(0)
    await expect(admin(boss, 'reset-password', { id: ids.sam, password: 'x' })).rejects.toThrow('bad-password')
    const log = await admin(boss, 'admins')
    expect(log.log[0].action).toBe('reset-password')
    expect(log.log[0].detail.password).toBeUndefined()
  })

  it('manages admins and removes players, but never the last admin or yourself', async () => {
    await expect(admin(boss, 'revoke-admin', { id: ids.boss })).rejects.toThrow('last-admin')
    await expect(admin(boss, 'delete-player', { id: ids.boss })).rejects.toThrow('not-yourself')
    await admin(boss, 'grant-admin', { username: 'PAT' })
    expect((await admin(pat, 'me')).username).toBe('pat')
    await admin(pat, 'revoke-admin', { id: ids.pat })
    await expect(admin(pat, 'overview')).rejects.toThrow('not-admin')
    await admin(boss, 'board-remove', { id: ids.pat, period: 'all' })
    expect((await admin(boss, 'board', { period: 'all' })).rows).toHaveLength(0)
    await admin(boss, 'delete-player', { id: ids.sam })
    expect((await admin(boss, 'overview')).players).toBe(2)
  })

  it('lists, closes and deletes online tournaments', async () => {
    await db.query("insert into cb_tournaments(code,setup,host_token_hash) values ('ABC123', '{\"name\":\"Office Cup\"}', 'h')")
    const t = await admin(boss, 'tournaments')
    expect(t.rows[0]).toMatchObject({ code: 'ABC123', name: 'Office Cup', closed: false })
    await admin(boss, 'close-tournament', { id: t.rows[0].id })
    expect((await admin(boss, 'tournaments')).rows[0].closed).toBe(true)
    await admin(boss, 'delete-tournament', { id: t.rows[0].id })
    expect((await admin(boss, 'tournaments')).total).toBe(0)
    expect((await admin(boss, 'matches')).missing).toBe(true)
  })
})
