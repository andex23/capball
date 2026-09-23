import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useMatchStore, SCREEN, DEFAULT_TEAM_CONFIG, clearMatchTimers } from '../state/MatchStore'
import { initPersistence, useRecordsStore, resetRecords } from '../state/persistence'
import { STORAGE_KEY, loadSaved, sanitizePrefs } from '../utils/storage'
import { emptyRecords } from '../game/records'

/** Minimal in-memory localStorage. */
function memoryStorage(initial) {
  const map = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]])
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    raw: () => map.get(STORAGE_KEY),
    json: () => JSON.parse(map.get(STORAGE_KEY)),
  }
}

const brokenStorage = () => ({
  getItem: () => { throw new Error('SecurityError') },
  setItem: () => { throw new Error('QuotaExceededError') },
})

const initial = useMatchStore.getState()
const get = () => useMatchStore.getState()
const set = (patch) => useMatchStore.setState(patch)
let stop = null

function start(storage) {
  stop = initPersistence({ storage, debounceMs: 100 })
  return storage
}

beforeEach(() => {
  vi.useFakeTimers()
  clearMatchTimers()
  useMatchStore.setState(initial, true)
  useRecordsStore.setState({ records: emptyRecords(), lastUpdate: null })
})
afterEach(() => {
  stop?.()
  stop = null
  clearMatchTimers()
  vi.useRealTimers()
})

const myTeam = { name: 'Night Owls', primary: '#112233', edge: '#FFFFFF', badge: 'star', pattern: 'ring', finish: 'gloss', numbers: { gk: 12, def1: 2, def2: 3, atk1: 8, atk2: 99 } }

describe('preferences', () => {
  it('round-trips through storage', () => {
    const storage = start(memoryStorage())
    get().setTeamConfig('team1', myTeam)
    get().setBallColor('#FFD700')
    get().setStadium('street')
    get().setFormation('team2', 'diamond')
    get().setMatchDuration(300)
    get().setTeam1Side('right')
    get().setAiDifficulty('hard')
    get().setMasterVolume(0.25)
    get().toggleMute()
    expect(storage.raw()).toBeUndefined() // debounced
    vi.advanceTimersByTime(100)
    expect(storage.json().v).toBe(1)
    stop(); stop = null

    useMatchStore.setState(initial, true)
    start(storage)
    expect(get()).toMatchObject({
      ballColor: '#FFD700', stadium: 'street', matchDuration: 300, chosenTeam1Side: 'right', team1Side: 'right',
      aiDifficulty: 'hard', masterVolume: 0.25, muted: true, formations: { team1: 'default', team2: 'diamond' },
    })
    expect(get().teamConfig.team1).toEqual(myTeam)
    expect(get().teamConfig.team2).toEqual(DEFAULT_TEAM_CONFIG.team2)
  })

  it('does not save match state or online-only fields', () => {
    const storage = start(memoryStorage())
    set({ score: { team1: 3, team2: 0 }, onlineStatus: { status: 'connected', msg: '' }, matchKey: 9 })
    get().setMasterVolume(0.5)
    vi.advanceTimersByTime(100)
    const { prefs } = storage.json()
    for (const key of ['score', 'onlineStatus', 'onlineMyTeam', 'matchKey', 'screen', 'phase', 'gameMode']) expect(prefs).not.toHaveProperty(key)
  })

  it('ignores corrupt JSON, the wrong version and non-objects', () => {
    for (const raw of ['{not json', '"text"', 'null', '[1,2]', JSON.stringify({ v: 2, prefs: { stadium: 'street' } }), 'x'.repeat(300_000)]) {
      useMatchStore.setState(initial, true)
      start(memoryStorage(raw))
      expect(get().stadium).toBe(initial.stadium)
      expect(useRecordsStore.getState().records).toEqual(emptyRecords())
      stop(); stop = null
    }
  })

  it('keeps valid fields and drops malicious or unknown ones', () => {
    const raw = `{"v":1,"prefs":{
      "__proto__":{"polluted":true},
      "teamConfig":{"team1":{"name":"  <b>Hi</b>\\u0000 ","primary":"javascript:alert(1)","edge":"#abcdef","badge":"star","numbers":{"gk":7,"def1":-4,"atk1":1000}},"team2":"nope"},
      "ballColor":"url(evil)","stadium":"moon","formations":{"team1":"toString","team2":"line"},
      "matchDuration":999,"chosenTeam1Side":"up","aiDifficulty":"godlike",
      "masterVolume":5,"sfxVolume":-1,"musicVolume":"0.3","muted":"yes","screen":"PLAYING","score":{"team1":99}
    },"records":{"cpu":{"hard":{"w":"lots"}},"online":{"w":2}}}`
    start(memoryStorage(raw))
    const s = get()
    expect({}.polluted).toBeUndefined()
    expect(s.teamConfig.team1).toEqual({ ...DEFAULT_TEAM_CONFIG.team1, name: '<b>Hi</b>', edge: '#abcdef', badge: 'star', numbers: { ...DEFAULT_TEAM_CONFIG.team1.numbers, gk: 7 } })
    expect(s.teamConfig.team2).toEqual(DEFAULT_TEAM_CONFIG.team2)
    expect(s).toMatchObject({
      ballColor: initial.ballColor, stadium: initial.stadium, matchDuration: initial.matchDuration,
      chosenTeam1Side: 'left', aiDifficulty: initial.aiDifficulty, formations: { team1: 'default', team2: 'line' },
      masterVolume: 1, sfxVolume: 0, musicVolume: initial.musicVolume, muted: false, screen: SCREEN.SPLASH, score: { team1: 0, team2: 0 },
    })
    expect(useRecordsStore.getState().records.cpu.hard.w).toBe(0)
    expect(useRecordsStore.getState().records.online.w).toBe(2)
  })

  it('saves optional settings only when the store has them, with the right type', () => {
    expect(sanitizePrefs({ shotClock: 15 }, {})).toEqual({})
    expect(sanitizePrefs({ shotClock: 15 }, { shotClock: 0 })).toEqual({ shotClock: 15 })
    expect(sanitizePrefs({ shotClock: 'x', vibration: 1 }, { shotClock: 0, vibration: true })).toEqual({})
    expect(sanitizePrefs({ vibration: false }, { vibration: true })).toEqual({ vibration: false })
  })

  it('survives storage that throws', () => {
    expect(() => start(brokenStorage())).not.toThrow()
    expect(() => { get().setMasterVolume(0.1); vi.advanceTimersByTime(100) }).not.toThrow()
    expect(loadSaved(brokenStorage())).toEqual({ prefs: {}, records: emptyRecords() })
    expect(loadSaved(null)).toEqual({ prefs: {}, records: emptyRecords() })
  })

  it('online: never saves the host’s setup, and restores the player’s own on leaving', () => {
    const storage = start(memoryStorage())
    get().setTeamConfig('team1', myTeam)
    get().setStadium('table')
    vi.advanceTimersByTime(100)

    // Guest connects; the host's setup arrives over sync
    set({ gameMode: 'online', onlineMyTeam: 'team2' })
    set({ teamConfig: DEFAULT_TEAM_CONFIG, stadium: 'street' })
    get().setSfxVolume(0.2) // this device's own setting still saves
    vi.advanceTimersByTime(100)
    expect(get().teamConfig).toBe(DEFAULT_TEAM_CONFIG) // host's sync still wins while online
    expect(storage.json().prefs).toMatchObject({ teamConfig: { team1: myTeam }, stadium: 'table', sfxVolume: 0.2 })

    // Back to the menu
    set({ gameMode: 'local', onlineMyTeam: null })
    expect(get().teamConfig.team1).toEqual(myTeam)
    expect(get().stadium).toBe('table')
  })
})

describe('records', () => {
  const draw = { winner: null, isDraw: true, score: { team1: 1, team2: 1 } }
  const cpuWin = { winner: 'team1', isDraw: false, score: { team1: 4, team2: 1 } }
  const records = () => useRecordsStore.getState().records

  it('records a finished match once and saves it straight away', () => {
    const storage = start(memoryStorage())
    set({ gameMode: 'ai', aiDifficulty: 'hard', screen: SCREEN.PLAYING, matchKey: 1, matchResult: cpuWin })
    // Re-renders / repeated syncs of the same result don't double count
    set({ screen: SCREEN.MATCH_END, matchResult: { ...cpuWin } })
    set({ matchResult: { ...cpuWin } })
    expect(records().cpu.hard).toEqual({ w: 1, d: 0, l: 0, gf: 4, ga: 1 })
    expect(useRecordsStore.getState().lastUpdate).toEqual({ matchKey: 1, newBests: ['biggestWin', 'mostGoals'] })
    expect(storage.json().records.cpu.hard.w).toBe(1)

    // Reload: nothing is recounted, even though matchKey starts again
    stop(); stop = null
    useMatchStore.setState(initial, true)
    start(storage)
    expect(records().cpu.hard.w).toBe(1)
    set({ gameMode: 'ai', aiDifficulty: 'hard', screen: SCREEN.PLAYING, matchKey: 1, matchResult: cpuWin })
    expect(records().cpu.hard.w).toBe(2) // a genuinely new match in the new session
  })

  it('quitting mid-match records nothing', () => {
    start(memoryStorage())
    set({ gameMode: 'ai' })
    get().startGame()
    vi.advanceTimersByTime(5000)
    get().quitMatch(SCREEN.MENU)
    expect(records()).toEqual(emptyRecords())
  })

  it('a full match through the store counts for the human side', () => {
    start(memoryStorage())
    set({ gameMode: 'ai', aiTeam: 'team1', aiDifficulty: 'easy' })
    get().startGame()
    set({ score: { team1: 0, team2: 2 } })
    get().endMatch()
    expect(records().cpu.easy).toEqual({ w: 1, d: 0, l: 0, gf: 2, ga: 0 })
  })

  it('a shootout decides the drawn match', () => {
    start(memoryStorage())
    set({ gameMode: 'online', onlineMyTeam: 'team2', screen: SCREEN.PLAYING, matchKey: 3, matchResult: draw })
    expect(records().online).toMatchObject({ w: 0, d: 1, l: 0 })
    set({ matchKey: 4, matchResult: null })
    set({ matchResult: { ...draw, winner: 'team2', isDraw: false, penaltyScore: { team1: 2, team2: 3 } } })
    expect(records().online).toEqual({ w: 1, d: 0, l: 0, gf: 1, ga: 1 })
    expect(records().bests.shootoutsWon).toBe(1)
  })

  it('a guest does not record a stale host result sent during setup', () => {
    start(memoryStorage())
    set({ gameMode: 'online', onlineMyTeam: 'team2', screen: SCREEN.TEAM_SELECT, matchKey: 5, matchResult: cpuWin })
    expect(records()).toEqual(emptyRecords())
  })

  it('a new online opponent with the same matchKey still counts', () => {
    start(memoryStorage())
    set({ gameMode: 'online', onlineMyTeam: 'team2', screen: SCREEN.MATCH_END, matchKey: 1, matchResult: cpuWin })
    set({ gameMode: 'local', onlineMyTeam: null, screen: SCREEN.MENU })
    set({ gameMode: 'online', onlineMyTeam: 'team2', screen: SCREEN.PLAYING, matchResult: null })
    set({ screen: SCREEN.MATCH_END, matchKey: 1, matchResult: { ...cpuWin } })
    expect(records().online.l).toBe(2)
  })

  it('local matches count as played', () => {
    start(memoryStorage())
    set({ gameMode: 'local', screen: SCREEN.PLAYING, matchKey: 1, matchResult: cpuWin })
    expect(records().local.played).toBe(1)
    expect(records().bests).toEqual(emptyRecords().bests)
  })

  it('reset clears and saves', () => {
    const storage = start(memoryStorage())
    set({ gameMode: 'ai', screen: SCREEN.PLAYING, matchKey: 1, matchResult: cpuWin })
    resetRecords()
    expect(records().cpu.medium.w).toBe(0)
    expect(storage.json().records.cpu.medium.w).toBe(0)
    set({ matchResult: { ...cpuWin } }) // same match again: still not recounted
    expect(records().cpu.medium.w).toBe(0)
  })
})
