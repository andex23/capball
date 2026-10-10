import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { handleAnytime } from '../../server/anytime.js'
import { createTournament } from '../game/tournament.js'

let db
const alice = 'a'.repeat(48), bob = 'b'.repeat(48), eve = 'e'.repeat(48)
const read = file => readFileSync(new URL(`../../supabase/${file}`, import.meta.url), 'utf8')
const query = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.result
const rpc = (action, token, code = null, data = {}) => query('select cb_anytime_service($1,$2,$3,$4) result', [action, token, code, JSON.stringify(data)])
const call = (action, token, data = {}) => handleAnytime({ action, token, ...data }, rpc)
const move = match => ({ code: match.code, version: match.version, requestId: randomUUID(), move: { capId: `${match.state.activeTeam}_atk2`, velocity: { x: 0.02, y: 0 } } })

beforeAll(async () => {
  db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role; create schema extensions;')
  await db.exec(read('tournaments.sql'))
  // PGlite lacks pgcrypto. Test real session lookup against builtin SHA256;
  // password signup is separate and isn't used by the saved-match API.
  const accounts = read('accounts.sql').replace('create extension if not exists pgcrypto with schema extensions;', '')
    .replace("extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')", "sha256(convert_to(p_token, 'UTF8'))")
  await db.exec(accounts)
  await db.exec(read('anytime.sql'))
  await db.exec(read('anytime.sql')) // migration is repeatable
  for (const [name, token] of [['alice', alice], ['bob', bob], ['eve', eve]]) {
    await db.query("insert into cb_accounts(username,display_name,pass_hash) values($1,$1,'test')", [name])
    await db.query("insert into cb_account_sessions(token_hash,account_id) select cb_account_hash($2),id from cb_accounts where username=$1", [name, token])
  }
}, 20000)
afterAll(async () => db?.close())

describe('account-backed multiplayer against PostgreSQL', () => {
  it('saves turns while opponent is absent; resumes by account and safely retries lost responses', async () => {
    const hosted = await call('create', alice, { config: { turnsPerPlayer: 10, deadlineHours: 24 } })
    expect(hosted.status).toBe('waiting')
    expect(hosted.config.deadlineHours).toBe(0)
    await expect(call('turn', alice, move(hosted))).rejects.toThrow('match-not-active')
    let joined = await call('join', bob, { code: hosted.code, team: { name: 'Bob FC', primary: '#123456' } })
    expect(joined.myTeam).toBe('team2'); expect(joined.status).toBe('active')
    expect(joined.config.teams.team2.name).toBe('Bob FC')
    let home = await call('get', alice, { code: hosted.code })
    const shot = move(home)
    await expect(call('turn', bob, shot)).rejects.toThrow('not-your-turn')
    home = await call('turn', alice, shot)
    expect(home.state.turns.team1).toBe(1)
    const retry = await call('turn', alice, shot)
    expect(retry.alreadyApplied).toBe(true)
    expect(retry.version).toBe(home.version)
    await expect(call('turn', alice, { ...shot, requestId: randomUUID() })).rejects.toThrow('stale-turn')
    await expect(call('get', eve, { code: hosted.code })).rejects.toThrow('not-a-player')
    await expect(call('get', 'z'.repeat(48), { code: hosted.code })).rejects.toThrow('signed-out')
    joined = await call('get', bob, { code: hosted.code })
    const answer = await call('turn', bob, move(joined))
    expect(answer.state.turns).toEqual({ team1: 1, team2: 1 })
    // Another login session for Alice on another phone sees the same positions.
    const phone = 'c'.repeat(48)
    await db.query('insert into cb_account_sessions(token_hash,account_id) select cb_account_hash($1),id from cb_accounts where username=$2', [phone, 'alice'])
    const resumed = await call('get', phone, { code: hosted.code })
    expect(resumed.state).toEqual(answer.state)
    expect(resumed.myTeam).toBe('team1')
    expect((await call('list', phone)).some(m => m.code === hosted.code)).toBe(true)
  })
  it('only commits one of two submissions from the same version', async () => {
    const h = await call('create', alice)
    await call('join', bob, { code: h.code })
    const match = await call('get', alice, { code: h.code })
    const a = move(match), b = move(match)
    // Both reads succeed before either commit (same race as two server workers).
    const preparedA = await rpc('prepare', alice, h.code, a)
    await rpc('prepare', alice, h.code, b)
    await rpc('commit', alice, h.code, { ...a, state: { ...preparedA.state, activeTeam: 'team2' } })
    await expect(rpc('commit', alice, h.code, { ...b, state: preparedA.state })).rejects.toThrow('stale-turn')
    expect((await call('get', bob, { code: h.code })).version).toBe(match.version + 1)
  })
  it('locks privileged storage and outcome submission away from public clients', async () => {
    const permissions = (await db.query("select has_function_privilege('anon','cb_anytime_service(text,text,text,jsonb)','EXECUTE') as anon, has_function_privilege('authenticated','cb_anytime_finish(uuid)','EXECUTE') as helper, has_function_privilege('service_role','cb_anytime_service(text,text,text,jsonb)','EXECUTE') as server")).rows[0]
    expect(permissions).toEqual({ anon: false, helper: false, server: true })
    await expect(call('commit', alice, { code: '1234567890' })).rejects.toThrow('bad-action')
  })
  it.each(['league', 'knockout'])('binds %s fixture seats to accounts and records missed-deadline forfeits atomically', async format => {
    const setup = createTournament({ format, playMode: 'anytime', deadlineHours: 24, teams: [{ name: 'Alice', cpu: false }, { name: 'Bob', cpu: false }, { name: 'Carol', cpu: false }, { name: 'Dave', cpu: false }] })
    const f = format === 'league' ? setup.fixtures[0] : setup.rounds[0][0]
    const { code } = await query('select cb_create_tournament($1,$2) result', [JSON.stringify(setup), alice])
    await query('select cb_claim_seat($1,$2,$3) result', [code, f.home, alice])
    await query('select cb_claim_seat($1,$2,$3) result', [code, f.away, bob])
    await expect(call('fixture', eve, { code, fixtureId: f.id, deviceToken: eve })).rejects.toThrow('not-your-team')
    await expect(call('fixture', alice, { code, fixtureId: 'fake', deviceToken: alice })).rejects.toThrow('fixture-not-ready')
    const h = await call('fixture', alice, { code, fixtureId: f.id, deviceToken: alice })
    expect(h.dueAt).toBeNull()
    await expect(query('select cb_release_seat($1,$2,$3) result', [code, f.home, alice])).rejects.toThrow('match-in-progress')
    const a = await call('fixture', bob, { code, fixtureId: f.id, deviceToken: bob })
    expect(a.code).toBe(h.code); expect(a.dueAt).toBeTruthy()
    // Existing live reporting endpoint cannot forge a result in this competition.
    await expect(query('select cb_report_result($1,$2,$3,$4,$5,9,0) result', [code, alice, f.id, f.home, f.away])).rejects.toThrow('server-results-only')
    await db.query("update cb_anytime_matches set due_at=now()-interval '1 second' where code=$1", [h.code])
    // Hub polling alone advances the competition, without the missing player.
    const snapshot = await query('select cb_get_tournament($1,$2) result', [code, bob])
    expect(snapshot.results).toHaveLength(1)
    expect(snapshot.results[0]).toMatchObject({ fixtureId: f.id, home: 0, away: 3 })
    const expired = await call('get', alice, { code: h.code })
    expect(expired.status).toBe('complete'); expect(expired.state.finishReason).toBe('deadline')
    await expect(call('turn', alice, move(expired))).rejects.toThrow('match-not-active')
    await call('get', bob, { code: h.code })
    expect((await query('select cb_get_tournament($1,$2) result', [code, bob])).results).toHaveLength(1)
  })
})
