/**
 * The Weekend League: your sign-up (the club you play every match with), this
 * weekend's results, the table, and the match being played. Our server keeps
 * the sign-up list, the results and the table (server/league.js); in Lagos
 * Life through the Lagos server, on the website with your account.
 */
import { create } from 'zustand'
import { getSaveStorage as storage } from '../utils/playerSave'
import { isLagos } from '../platform'
import { useLagosStore } from '../lagos/lagosStore'
import { useSavedStore } from './savedMatch'
import { useAccountStore } from './accountStore'
import { useMatchStore, SCREEN } from './MatchStore'
import { FIXTURES, LEFT_EARLY, FIRST_LEAGUE, leagueKey, lastLeagueKey, isLive, openFixtures, cleanResult, lineFor } from '../game/leagueRules'
import { capsForRank, capsForResults } from '../game/collection'
import { useRewardsStore } from './rewardsStore'
import { leagueClubs } from '../game/leagueClubs'

export const LEAGUE_KEY = 'capball:league:v1'
export const LEAGUE_PLAY_KEY = 'capball:league-play:v1'
// Settings a league match borrows, given back afterwards
const BORROWED = ['stadium', 'tableFinish', 'teamConfig', 'formations', 'gameMode', 'aiTeam', 'aiDifficulty', 'matchDuration', 'goalTarget', 'chosenTeam1Side', 'team1Side']
export const LEAGUE_MATCH_SECONDS = 120 // a half
const LOOK = ['primary', 'edge', 'pattern', 'badge', 'finish', 'capText', 'textColor', 'skirtColor', 'art', 'capNames']

/** A clean copy of a club: a name and the look of its caps. */
export function cleanClub(c) {
  if (!c || typeof c !== 'object') return null
  const name = typeof c.name === 'string' ? c.name.replace(/\s+/g, ' ').trim().slice(0, 18) : ''
  if (!name || typeof c.primary !== 'string' || typeof c.edge !== 'string') return null
  return { name, ...Object.fromEntries(LOOK.filter((k) => typeof c[k] === 'string').map((k) => [k, c[k]])) }
}

function load() {
  try {
    const r = JSON.parse(storage()?.getItem(LEAGUE_KEY) || 'null')
    const club = cleanClub(r?.club)
    return club ? { club, at: Number(r.at) || 0 } : null
  } catch { return null }
}

/** Your wins towards entry: Lagos Life's count there, your account's elsewhere. */
export function leagueWins() {
  if (isLagos()) {
    const l = useLagosStore.getState()
    return Math.max(l.wins || 0, l.best || 0)
  }
  return useSavedStore.getState().career?.won || 0
}

/** Talk to our server: through Lagos Life there, with your account on the website. */
async function call(action, body = {}) {
  if (isLagos()) return useLagosStore.getState().weekend(action, body)
  const token = useAccountStore.getState().token
  if (!token) throw Object.assign(new Error('signed-out'), { code: 'signed-out' })
  const res = await fetch('/api/league', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token, ...body }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'server'), { code: data.error, message: data.message })
  return data
}

function loadPlay() {
  try {
    const r = JSON.parse(storage()?.getItem(LEAGUE_PLAY_KEY) || 'null')
    if (!r || typeof r.key !== 'string') return { key: null, results: Array(FIXTURES).fill(null) }
    return { key: r.key, results: Array.from({ length: FIXTURES }, (_, i) => (r.results?.[i] ? cleanResult(r.results[i]) : null)) }
  } catch { return { key: null, results: Array(FIXTURES).fill(null) } }
}

export const useLeagueStore = create((set, get) => ({
  joined: load(),
  registered: null, // how many have signed up
  error: null,
  ...loadPlay(), // { key, results }: this weekend's results, as this phone knows them
  table: null, // { players, top, me }
  playing: null, // { index, club } while a league match is on
  stash: null,
  last: null, // the last full time: { index, gf, ga, club, rankFrom, rankTo, pts }

  _savePlay() {
    const { key, results } = get()
    try { storage()?.setItem(LEAGUE_PLAY_KEY, JSON.stringify({ key, results })) } catch { /* blocked */ }
  },

  /** A new weekend starts with no results. */
  roll(now = Date.now()) {
    const key = leagueKey(now)
    if (get().key === key) return
    set({ key, results: Array(FIXTURES).fill(null), table: null, last: null })
    get()._savePlay()
  },

  /** Take the server's word for results and the table. */
  _take(r) {
    if (!r) return
    const results = Array.from({ length: FIXTURES }, (_, i) => (r.results?.[i] ? cleanResult(r.results[i]) : null))
    set({ table: { players: r.players, top: r.top || [], me: r.me || null }, results: r.key === get().key ? results : get().results, error: null })
    get()._savePlay()
  },

  /** This weekend's table and your results. */
  async refreshTable() {
    get().roll()
    if (!get().joined) return
    try { get()._take(await call('leagueTable', { key: get().key })) } catch (e) { set({ error: e.code === 'signed-out' ? 'Sign in to see the table.' : 'Couldn’t load the table. Check your connection.' }) }
  },

  /** The next fixture you can play now, or -1. */
  nextFixture(now = Date.now()) {
    const open = isLive(now) ? openFixtures(get().key, now) : 0
    return get().results.findIndex((r, i) => !r && i < open)
  },

  /** Kick off a fixture: our server marks it started (a 3–0 loss until full time). */
  async play(index) {
    get().roll()
    const { joined, results, key } = get()
    if (!joined || !isLive() || results[index] || index >= openFixtures(key)) return false
    set({ error: null })
    try {
      get()._take(await call('leagueStart', { key, index }))
    } catch (e) {
      set({ error: e.code === 'already-played' ? 'You’ve already played that match.' : 'Couldn’t start the match. Check your connection and try again.' })
      if (e.code === 'already-played') get().refreshTable()
      return false
    }
    const club = leagueClubs(key)[index]
    const ms = useMatchStore.getState()
    const stash = Object.fromEntries(BORROWED.map((k) => [k, ms[k]]))
    const mine = { ...ms.teamConfig.team1, ...joined.club, name: joined.club.name }
    set({ playing: { index, club }, stash, rankFrom: get().table?.me?.rank ?? null })
    globalThis.__counterballLeagueMatch = true
    globalThis.__counterballCount?.('feature', index === 0 ? 'league_first' : 'league_match')
    useMatchStore.setState({
      teamConfig: { team1: mine, team2: { ...club } },
      gameMode: 'ai',
      aiTeam: 'team2',
      aiDifficulty: 'hard',
      matchDuration: LEAGUE_MATCH_SECONDS,
      goalTarget: null,
      chosenTeam1Side: 'left',
      team1Side: 'left',
      stadium: 'capArena',
      tableFinish: 'midnight',
      formations: { team1: ms.formations?.team1 || 'default', team2: 'default' },
    })
    useMatchStore.getState().goToScreen(SCREEN.FORMATION)
    return true
  },

  /** Full time: send the score, then back to the league. */
  async finish(result) {
    const p = get().playing
    if (!p || !result) return
    const gf = result.score?.team1 ?? 0
    const ga = result.score?.team2 ?? 0
    const results = [...get().results]
    results[p.index] = { gf, ga }
    const rankFrom = get().rankFrom
    set({ results })
    get()._savePlay()
    globalThis.__counterballCount?.('feature', 'league_done')
    let rankTo = null
    try {
      const r = await call('leagueFinish', { key: get().key, index: p.index, gf, ga })
      get()._take(r)
      rankTo = r.me?.rank ?? null
    } catch { set({ error: 'Your result is saved on this phone; the table will catch up.' }) }
    set({ last: { index: p.index, gf, ga, club: p.club, rankFrom, rankTo, pts: lineFor(get().results).pts } })
    get().leave()
  },

  /** Back to the league screen, with your own settings back. */
  leave() {
    const { stash } = get()
    if (stash) useMatchStore.setState({ ...stash })
    set({ playing: null, stash: null })
    globalThis.__counterballLeagueMatch = false
    useMatchStore.getState().quitMatch(SCREEN.LEAGUE)
  },

  /** Sign up with a club. */
  async join(club) {
    const c = cleanClub(club)
    if (!c) return false
    const joined = { club: c, at: Date.now() }
    try { storage()?.setItem(LEAGUE_KEY, JSON.stringify(joined)) } catch { /* blocked */ }
    set({ joined, error: null })
    globalThis.__counterballCount?.('feature', 'league_join')
    try {
      const r = await call('leagueJoin', { name: c.name })
      set({ registered: r.registered })
    } catch { /* sent again next time the screen opens */ }
    // Signed up while it's on: load this weekend's fixtures and table straight away
    if (isLive()) { get().roll(); get().refreshTable() }
    return true
  },

  /** After a weekend: where you finished, and your caps and prize money (once a weekend). */
  async checkLast(now = Date.now()) {
    const key = lastLeagueKey(now)
    if (key < FIRST_LEAGUE || !get().joined) return
    if (useRewardsStore.getState().news.some((n) => n.id === `league:${key}`)) return
    try {
      const r = await call('leagueTable', { key })
      const me = r.me
      if (!me) return
      const results = Array.from({ length: FIXTURES }, (_, i) => (r.results?.[i] ? cleanResult(r.results[i]) : null))
      const caps = [...new Set([...capsForRank(me.rank), ...capsForResults(results)])]
      const prize = (me.rank === 1 ? 100 : me.rank === 2 ? 50 : me.rank === 3 ? 25 : 0) + (results.filter(Boolean).length === FIXTURES ? 10 : 0)
      useRewardsStore.getState().leagueResult({ key, rank: me.rank, players: r.players, pts: me.pts, caps, money: prize })
    } catch { /* try again next time */ }
  },

  /** How many have signed up, and (while it's on) the table. */
  async refresh() {
    try {
      const r = await call('leagueInfo')
      set({ registered: r.registered })
      // Signed up on another phone: the list knows, this phone's save will follow
      if (r.me && !get().joined) set({ joined: load() })
      // Signed up while offline: tell the server now
      if (!r.me && get().joined) set({ registered: (await call('leagueJoin', { name: get().joined.club.name })).registered })
    } catch { /* offline or signed out: no count */ }
    if (isLive() && get().joined) get().refreshTable()
  },
}))

export const inLeaguePlay = () => !!useLeagueStore.getState().playing

// Left a league match some other way (the pause menu, or back from the formation
// screen): our server already holds it as a 3–0 loss; your own settings come back
const MATCH_SCREENS = [SCREEN.FORMATION, SCREEN.PLAYING, SCREEN.MATCH_END]
useMatchStore.subscribe((s, prev) => {
  const l = useLeagueStore.getState()
  if (!l.playing || s.screen === prev.screen || MATCH_SCREENS.includes(s.screen)) return
  const results = [...l.results]
  results[l.playing.index] = { ...LEFT_EARLY, left: true }
  const { stash } = l
  useLeagueStore.setState({ playing: null, stash: null, results })
  globalThis.__counterballLeagueMatch = false
  l._savePlay()
  if (stash) useMatchStore.setState({ ...stash })
})
