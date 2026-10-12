import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useAnytimeStore, tickAnytime } from '../state/anytimeStore'
import { useAccountStore } from '../state/accountStore'
import { useMatchStore } from '../state/MatchStore'
import { anytimeConfig, createAnytimeState, resolveAnytimeTurn } from '../game/anytime'

const config = anytimeConfig()
const response = data => ({ ok: true, json: async () => data })
let initial
beforeEach(() => {
  useAnytimeStore.getState().leave()
  const values = new Map()
  vi.stubGlobal('localStorage', { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) })
  useAccountStore.setState({ token: 'a'.repeat(48), username: 'alice' })
  initial = { code: 'ABCDE12345', version: 1, status: 'active', myTeam: 'team1', config, state: createAnytimeState(config) }
})
afterEach(() => { useAnytimeStore.getState().leave(); vi.unstubAllGlobals() })

describe('saved-match client recovery', () => {
  it('retains the same request id through a lost response and retry', async () => {
    const requests = []
    let next
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const input = JSON.parse(options.body)
      if (input.action === 'get') return response(initial)
      requests.push(input)
      if (requests.length === 1) {
        next = { ...initial, version: 2, state: resolveAnytimeTurn(initial.state, config, input.move) }
        throw new TypeError('Connection lost after commit')
      }
      return response(next)
    }))
    const actions = useAnytimeStore.getState()
    await actions.open('get', { code: initial.code })
    await actions.submit('team1_atk2', { x: 0.03, y: 0 })
    expect(useAnytimeStore.getState().pending).toBeTruthy()
    expect(useMatchStore.getState().phase).toBe('KICKOFF')
    await actions.retry()
    expect(requests[1].requestId).toBe(requests[0].requestId)
    expect(useAnytimeStore.getState().pending).toBeNull()
    expect(useAnytimeStore.getState().match.state.turns.team1).toBe(1)
  })
  it('does not reopen the pitch when a turn response arrives after leaving', async () => {
    let finish
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      if (JSON.parse(options.body).action === 'get') return response(initial)
      return new Promise(resolve => { finish = resolve })
    }))
    const actions = useAnytimeStore.getState()
    await actions.open('get', { code: initial.code })
    const send = actions.submit('team1_atk2', { x: 0.03, y: 0 })
    actions.leave()
    finish(response({ ...initial, version: 2 }))
    await send
    expect(useMatchStore.getState().screen).toBe('ANYTIME')
    expect(useAnytimeStore.getState().match).toBeNull()
    expect(useAnytimeStore.getState().busy).toBe(false)
  })
  it('resumes an uncertain request after leaving, but clears it if the server already advanced', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      if (JSON.parse(options.body).action === 'get') return response(initial)
      throw new TypeError('No connection')
    }))
    const actions = useAnytimeStore.getState()
    await actions.open('get', { code: initial.code })
    await actions.submit('team1_atk2', { x: 0.03, y: 0 })
    const pending = useAnytimeStore.getState().pending
    actions.leave()
    await actions.open('get', { code: initial.code })
    expect(useAnytimeStore.getState().pending).toEqual(pending)
    expect(useMatchStore.getState().phase).toBe('KICKOFF')
    actions.leave()
    initial = { ...initial, version: 2 }
    await actions.open('get', { code: initial.code })
    expect(useAnytimeStore.getState().pending).toBeNull()
    expect(useMatchStore.getState().phase).toBe('SELECT')
  })
})


it.each(['goal', 'no_goal'])('celebrates only a confirmed %s after saved-turn playback reaches the net', async outcome => {
  const result = { ...initial, version: 2, state: { ...initial.state, lastTurn: {
    frames: [{}, {}], frameSeconds: 0.2, decision: { outcome },
  } } }
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => response(JSON.parse(options.body).action === 'get' ? initial : result)))
  await useAnytimeStore.getState().open('get', { code: initial.code })
  await useAnytimeStore.getState().submit('team1_atk2', { x: 0.1, y: 0 })
  useMatchStore.setState({ paused: false })
  tickAnytime(0.1)
  expect(useMatchStore.getState().phase).toBe('RESOLVE')
  tickAnytime(0.1)
  expect(useMatchStore.getState().phase).toBe(outcome === 'goal' ? 'GOAL' : 'RESOLVE')
  for (let i = 0; i < 11; i++) tickAnytime(0.1)
  expect(useMatchStore.getState().phase).not.toBe('GOAL')
})
