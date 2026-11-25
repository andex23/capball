/**
 * The Weekend League on our server: who signed up, each player's fifteen
 * results, and the table. One copy per place it's played (Lagos Life live or
 * test, and the website), kept in the same save store as everything else.
 *
 * A match is marked as started before it's played, as a 3–0 loss; full time
 * replaces that with the real score. Leave early (or close the game) and the
 * loss stands: one go at each fixture.
 */
import { createHash } from 'node:crypto'
import { FIXTURES, LEFT_EARLY, cleanResult, lineFor, tableOrder, openFixtures, acceptsResults, leagueKey } from '../src/game/leagueRules.js'

const fail = (code) => { throw new Error(code) }
export const leagueHash = (playerId) => createHash('sha256').update(`wkd:${playerId}`).digest('hex').slice(0, 12)
export const cleanLeagueName = (name) => (typeof name === 'string' ? name.replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 18) : '') || 'Player'
const KEY = /^\d{4}-\d{2}-\d{2}$/

const SIGNUP = '__league__:signup'
const tableKey = (key) => `__league__:${key}:table`
const mineKey = (key, playerId) => `__league__:${key}:${playerId}`
const cleanSignup = (d) => (d && d.v === 1 && d.rows && typeof d.rows === 'object' ? d : { v: 1, rows: {} })
const cleanTable = (d) => (d && d.v === 1 && d.rows && typeof d.rows === 'object' ? d : { v: 1, rows: {} })
function cleanMine(d) {
  const results = Array.from({ length: FIXTURES }, (_, i) => {
    const r = d?.results?.[i]
    if (!r) return null
    const c = cleanResult(r)
    return c ? { ...c, ...(r.pending ? { pending: true } : {}) } : null
  })
  return { v: 1, results }
}

/** Sign up (or rename your club): how many are in. */
export async function leagueJoin(saves, mode, playerId, input, now = Date.now()) {
  const list = cleanSignup((await saves('get', mode, SIGNUP))?.data)
  const id = leagueHash(playerId)
  const name = cleanLeagueName(input?.name)
  if (!list.rows[id] || list.rows[id].name !== name) {
    list.rows[id] = { name, at: list.rows[id]?.at || now }
    if (Object.keys(list.rows).length <= 50000) await saves('put', mode, SIGNUP, list)
  }
  return { ok: true, registered: Object.keys(list.rows).length, me: true }
}

/** For the owner's stats: sign-ups in each mode, and how many in the last day. */
export async function leagueSummary(saves, now = Date.now()) {
  const out = {}
  for (const mode of ['live', 'web', 'test']) {
    try {
      const rows = Object.values(cleanSignup((await saves('get', mode, SIGNUP))?.data).rows)
      out[mode] = { signedUp: rows.length, lastDay: rows.filter((r) => Number(r.at) > now - 86400000).length }
    } catch { out[mode] = null }
  }
  return out
}

/** How many have signed up, and whether this player has. */
export async function leagueInfo(saves, mode, playerId) {
  const list = cleanSignup((await saves('get', mode, SIGNUP))?.data)
  return { ok: true, registered: Object.keys(list.rows).length, me: !!list.rows[leagueHash(playerId)] }
}

/** The table: top `limit`, how many are on it, and this player's place and line. */
export function leagueView(table, me, limit = 20) {
  const rows = Object.entries(table.rows).map(([id, r]) => ({ id, ...r })).sort(tableOrder)
  const at = me ? rows.findIndex((r) => r.id === me) : -1
  const pub = (r, i) => ({ rank: i + 1, name: r.name, p: r.p, w: r.w, d: r.d, l: r.l, gd: r.gd, gf: r.gf, pts: r.pts, ...(r.id === me ? { me: true } : {}) })
  return { players: rows.length, top: rows.slice(0, limit).map(pub), me: at >= 0 ? pub(rows[at], at) : null }
}

async function mineAndSignup(saves, mode, playerId) {
  const list = cleanSignup((await saves('get', mode, SIGNUP))?.data)
  const row = list.rows[leagueHash(playerId)]
  if (!row) fail('not-signed-up')
  return row
}

/** Kick off a fixture: it counts as a 3–0 loss until full time says otherwise. */
export async function leagueStart(saves, mode, playerId, input, now = Date.now()) {
  const key = input?.key
  const i = Number(input?.index)
  if (!KEY.test(key || '') || key !== leagueKey(now) || !Number.isInteger(i) || i < 0 || i >= openFixtures(key, now)) fail('bad-request')
  await mineAndSignup(saves, mode, playerId)
  const mine = cleanMine((await saves('get', mode, mineKey(key, playerId)))?.data)
  if (mine.results[i]) fail('already-played')
  mine.results[i] = { ...LEFT_EARLY, left: true, pending: true }
  await saves('put', mode, mineKey(key, playerId), mine)
  return saveLine(saves, mode, playerId, key, mine, now)
}

/** Full time: the real score replaces the 3–0, once. */
export async function leagueFinish(saves, mode, playerId, input, now = Date.now()) {
  const key = input?.key
  const i = Number(input?.index)
  const r = cleanResult({ gf: input?.gf, ga: input?.ga })
  if (!KEY.test(key || '') || !acceptsResults(key, now) || !Number.isInteger(i) || i < 0 || i >= FIXTURES || !r) fail('bad-request')
  const mine = cleanMine((await saves('get', mode, mineKey(key, playerId)))?.data)
  if (!mine.results[i]?.pending) fail('already-played')
  mine.results[i] = r
  await saves('put', mode, mineKey(key, playerId), mine)
  return saveLine(saves, mode, playerId, key, mine, now)
}

async function saveLine(saves, mode, playerId, key, mine, now) {
  const signup = await mineAndSignup(saves, mode, playerId)
  const line = lineFor(mine.results)
  const table = cleanTable((await saves('get', mode, tableKey(key)))?.data)
  const id = leagueHash(playerId)
  const was = table.rows[id]
  table.rows[id] = { name: signup.name, ...line, at: !was || was.pts !== line.pts ? now : was.at }
  if (Object.keys(table.rows).length <= 50000) await saves('put', mode, tableKey(key), table)
  return { ok: true, key, results: mine.results, ...leagueView(table, id) }
}

/** The table for a weekend (this one, or the last for Monday), and your results in it. */
export async function leagueTable(saves, mode, playerId, input, now = Date.now()) {
  const key = input?.key && KEY.test(input.key) ? input.key : leagueKey(now)
  const table = cleanTable((await saves('get', mode, tableKey(key)))?.data)
  const mine = cleanMine((await saves('get', mode, mineKey(key, playerId)))?.data)
  return { ok: true, key, results: mine.results, ...leagueView(table, leagueHash(playerId)) }
}

const ACTIONS = { leagueJoin, leagueInfo, leagueStart, leagueFinish, leagueTable }
export const isLeagueAction = (a) => Object.hasOwn(ACTIONS, a)

/** Run a league action for a verified player. */
export function runLeague(action, saves, mode, playerId, input, now = Date.now()) {
  if (!saves) fail('shop-not-configured')
  return ACTIONS[action](saves, mode, playerId, input, now)
}
