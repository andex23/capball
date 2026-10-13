import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

// Forgotten passwords against a real PostgreSQL (PGlite). PGlite lacks
// pgcrypto, so hashing and random bytes are swapped for built-ins.
let db
const read = (file) => readFileSync(new URL(`../../supabase/${file}`, import.meta.url), 'utf8')
const q1 = async (sql, args) => (await db.query(sql, args)).rows[0].r
const rand = (n) => `decode(substr(md5(random()::text) || md5(random()::text), 1, ${n * 2}), 'hex')`
const pat = 'p'.repeat(40)
let admin

beforeAll(async () => {
  db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role; create schema extensions;')
  await db.exec(read('tournaments.sql'))
  await db.exec(read('accounts.sql').replace('create extension if not exists pgcrypto with schema extensions;', '')
    .replace("extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')", "sha256(convert_to(p_token, 'UTF8'))")
    .replace('extensions.gen_random_bytes(24)', rand(24)))
  await db.exec(read('leaderboard.sql'))
  await db.exec(read('admin.sql')
    .replace("select extensions.crypt(p, extensions.gen_salt('bf', 10))", 'select md5(p)')
    .replace("select h = extensions.crypt(coalesce(p, ''), h)", "select h = md5(coalesce(p, ''))")
    .replace("select encode(extensions.gen_random_bytes(32), 'hex')", 'select md5(random()::text) || md5(random()::text)'))
  const sql = read('recovery.sql').replace('extensions.gen_random_bytes(12)', rand(12))
  await db.exec(sql)
  await db.exec(sql) // safe to run again
  const r = await db.query("insert into cb_accounts(username,display_name,pass_hash) values('pat','Pat','old') returning id")
  await db.query('insert into cb_account_sessions(token_hash,account_id) values (cb_account_hash($1),$2)', [pat, r.rows[0].id])
  admin = (await q1('select cb_admin_setup($1,$2) r', ['me@x.com', 'longenough1'])).token
}, 20000)
afterAll(async () => db?.close())

describe('recovery codes', () => {
  it('a signed-in player gets a code; username + code sets a new password and gives a fresh code', async () => {
    expect((await q1('select cb_account_recovery_status($1) r', [pat])).has).toBe(false)
    const { code } = await q1('select cb_account_recovery_new($1) r', [pat])
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect((await q1('select cb_account_recovery_status($1) r', [pat])).has).toBe(true)

    expect((await q1('select cb_account_recover($1,$2,$3) r', ['pat', 'AAAA-BBBB-CCCC', 'newpass'])).error).toBe('wrong-code')
    await expect(q1('select cb_account_recover($1,$2,$3) r', ['pat', code, 'x'])).rejects.toThrow('bad-password')
    // Lower case, no dashes, spaces: still accepted
    const back = await q1('select cb_account_recover($1,$2,$3) r', ['PAT', ` ${code.toLowerCase().replace(/-/g, ' ')} `, 'newpass'])
    expect(back.username).toBe('Pat')
    expect(back.token).toBeTruthy()
    expect(back.code).not.toBe(code)
    // Old sessions are gone, the new one works, the old code is spent
    await expect(q1('select cb_account_recovery_status($1) r', [pat])).rejects.toThrow('signed-out')
    expect((await q1('select cb_account_recovery_status($1) r', [back.token])).has).toBe(true)
    expect((await q1('select cb_account_recover($1,$2,$3) r', ['pat', code, 'again1'])).error).toBe('wrong-code')
    expect((await q1('select cb_account_recover($1,$2,$3) r', ['pat', back.code, 'again1'])).token).toBeTruthy()
  })

  it('stops guessing after five wrong codes in an hour', async () => {
    for (let i = 0; i < 5; i++) await q1('select cb_account_recover($1,$2,$3) r', ['nobody', 'AAAA-AAAA-AAAA', 'whatever'])
    await expect(q1('select cb_account_recover($1,$2,$3) r', ['nobody', 'AAAA-AAAA-AAAA', 'whatever'])).rejects.toThrow('too-many-tries')
  })
})

describe('help requests', () => {
  it('a player asks for help; it shows in the admin console until marked done', async () => {
    await expect(q1('select cb_help_request($1,$2,$3) r', ['no spaces!', 'wa 0803', ''])).rejects.toThrow('bad-username')
    await expect(q1('select cb_help_request($1,$2,$3) r', ['pat', 'x', ''])).rejects.toThrow('bad-contact')
    expect((await q1('select cb_help_request($1,$2,$3) r', ['Pat', 'WhatsApp 0803 000 0000', 'My club is Yaba United'])).ok).toBe(true)
    // An unknown username is accepted the same way (no account given away)
    expect((await q1('select cb_help_request($1,$2,$3) r', ['ghost_99', 'ig @ghost', ''])).ok).toBe(true)
    const help = (action, data = {}) => q1('select cb_admin_help($1,$2,$3) r', [admin, action, JSON.stringify(data)])
    await expect(q1('select cb_admin_help($1,$2,$3) r', [pat, 'list', '{}'])).rejects.toThrow('signed-out')
    const list = await help('list')
    expect(list.open).toBe(2)
    const mine = list.rows.find((r) => r.username === 'pat')
    expect(mine).toMatchObject({ accountName: 'Pat', contact: 'WhatsApp 0803 000 0000', hasCode: true })
    expect(list.rows.find((r) => r.username === 'ghost_99').accountId).toBeNull()
    await help('done', { id: mine.id })
    expect((await help('list')).open).toBe(1)
    expect((await help('list', { status: 'all' })).rows).toHaveLength(2)
    await help('delete', { id: mine.id })
    expect((await help('list', { status: 'all' })).rows).toHaveLength(1)
  })

  it('limits open requests per username', async () => {
    for (let i = 0; i < 3; i++) await q1('select cb_help_request($1,$2,$3) r', ['spammy', 'wa 123', ''])
    await expect(q1('select cb_help_request($1,$2,$3) r', ['spammy', 'wa 123', ''])).rejects.toThrow('too-many-requests')
  })
})
