/**
 * Live check of the online-tournament database, run from a real browser.
 * Open the game with #dbcheck on the end of the address. It creates a tiny
 * test tournament, walks through the main calls, checks the locks hold,
 * then closes the test tournament again.
 */
import { rpc, SUPABASE_URL } from './supabase'

const randomToken = () => {
  const b = new Uint8Array(20)
  crypto.getRandomValues(b)
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export async function runDbCheck(log) {
  const host = randomToken()
  const friend = randomToken()
  const outsider = randomToken()
  const setup = {
    v: 1, id: `dbcheck-${Date.now()}`, format: 'league', legs: 1, matchDuration: 120, createdAt: Date.now(),
    teams: [
      { id: 'T1', name: 'Check A', primary: '#D32F2F', edge: '#FFFFFF', cpu: false, difficulty: 'medium' },
      { id: 'T2', name: 'Check B', primary: '#1565C0', edge: '#FFFFFF', cpu: false, difficulty: 'medium' },
      { id: 'T3', name: 'Check CPU', primary: '#2E7D32', edge: '#FFFFFF', cpu: true, difficulty: 'easy' },
    ],
    fixtures: [
      { id: 'L1', round: 0, home: 'T1', away: 'T2', result: null },
      { id: 'L2', round: 1, home: 'T3', away: 'T1', result: null },
      { id: 'L3', round: 2, home: 'T2', away: 'T3', result: null },
    ],
    rounds: null, championId: null, runnerUpId: null,
  }
  let ok = true
  const step = async (name, fn) => {
    try {
      const detail = await fn()
      log({ name, pass: true, detail })
      return true
    } catch (e) {
      ok = false
      log({ name, pass: false, detail: `${e.code || ''} ${e.message}`.trim() })
      return false
    }
  }
  const expectError = async (name, code, fn) => step(name, async () => {
    try { await fn() } catch (e) {
      if (e.code === code || String(e.message).includes(code)) return `refused (${code}) ✓`
      throw new Error(`refused, but with "${e.code}" instead of "${code}"`, { cause: e })
    }
    throw new Error('was allowed — it should have been refused')
  })

  log({ name: `Database: ${SUPABASE_URL}`, pass: true, detail: '' })
  let code = null
  await step('Create a test tournament', async () => {
    const r = await rpc('cb_create_tournament', { p_setup: setup, p_token: host })
    code = r.code
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error(`odd join code: ${code}`)
    return `join code ${code}`
  })
  if (!code) return ok
  await step('Read it back as the host', async () => {
    const t = await rpc('cb_get_tournament', { p_code: code, p_token: host })
    if (!t.isHost) throw new Error('host not recognised')
    const open = t.seats.filter((s) => !s.claimed).map((s) => s.teamId).join(', ')
    if (open !== 'T1, T2') throw new Error(`expected open seats T1, T2 — got ${open}`)
    return `host ✓, open seats ${open}`
  })
  await step('A friend claims Team B', async () => {
    await rpc('cb_claim_seat', { p_code: code, p_team_id: 'T2', p_token: friend })
    const t = await rpc('cb_get_tournament', { p_code: code, p_token: friend })
    if (!t.seats.find((s) => s.teamId === 'T2')?.mine) throw new Error('seat not marked as theirs')
    return 'seat is theirs ✓'
  })
  await expectError('Someone else can’t take that seat', 'taken', () => rpc('cb_claim_seat', { p_code: code, p_team_id: 'T2', p_token: outsider }))
  await expectError('An outsider can’t report a result', 'not-your-fixture', () => rpc('cb_report_result', {
    p_code: code, p_token: outsider, p_fixture_id: 'L1', p_home_team: 'T1', p_away_team: 'T2', p_home: 3, p_away: 0, p_pens_home: null, p_pens_away: null,
  }))
  await step('The friend reports their match', async () => {
    await rpc('cb_report_result', {
      p_code: code, p_token: friend, p_fixture_id: 'L1', p_home_team: 'T1', p_away_team: 'T2', p_home: 1, p_away: 2, p_pens_home: null, p_pens_away: null,
    })
    const t = await rpc('cb_get_tournament', { p_code: code, p_token: friend })
    const r = t.results.find((x) => x.fixtureId === 'L1')
    if (!r || r.home !== 1 || r.away !== 2) throw new Error('result not stored')
    return 'stored 1–2 ✓'
  })
  await expectError('The same match can’t be reported twice', 'already-reported', () => rpc('cb_report_result', {
    p_code: code, p_token: host, p_fixture_id: 'L1', p_home_team: 'T1', p_away_team: 'T2', p_home: 5, p_away: 0, p_pens_home: null, p_pens_away: null,
  }))
  await step('The tables are locked from direct access', async () => {
    const key = (await import('./supabase')).ANON_KEY_FOR_CHECK
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cb_tournaments?select=code&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    const body = await res.json().catch(() => null)
    if (res.ok && Array.isArray(body) && body.length > 0) throw new Error('rows were readable directly!')
    return res.ok ? 'nothing readable ✓' : `refused (HTTP ${res.status}) ✓`
  })
  await step('Close the test tournament', async () => {
    await rpc('cb_close_tournament', { p_code: code, p_token: host })
    return 'closed'
  })
  return ok
}
