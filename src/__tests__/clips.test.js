import { afterEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ listener: null, recordings: [], state: {} }))
vi.mock('../state/MatchStore', () => ({ useMatchStore: {
  subscribe: (fn) => { mock.listener = fn; return () => {} },
} }))
vi.mock('../scene/camera', () => ({ getCanvas: () => ({ captureStream: () => ({ getTracks: () => [] }) }) }))
vi.mock('../game/commentary', () => ({ playerOf: () => null }))
import { initClips, useClipStore } from '../game/clips'

afterEach(() => { vi.unstubAllGlobals(); useClipStore.setState({ clips: [] }); mock.recordings = [] })

it('records confirmed goals only, even after a previous scorer exists', () => {
  class Recorder {
    static isTypeSupported() { return true }
    constructor(stream) { this.stream = stream; this.mimeType = 'video/webm'; mock.recordings.push(this) }
    start() {}
    stop() { this.ondataavailable({ data: new Blob(['clip']) }); this.onstop() }
  }
  vi.stubGlobal('MediaRecorder', Recorder)
  initClips()
  const base = { matchKey: 1, replaying: false, teamConfig: { team1: { name: 'Reds' }, team2: { name: 'Blues' } }, score: { team1: 1, team2: 0 }, lastScorer: 'team1' }
  for (const reason of ['bank_shot', 'kickoff_violation', 'goal_kick_violation']) {
    const disallowed = { ...base, replaying: true, replayDecision: { outcome: 'no_goal', reason } }
    mock.listener(disallowed, base)
    mock.listener(base, disallowed)
  }
  expect(mock.recordings).toHaveLength(0)
  expect(useClipStore.getState().clips).toHaveLength(0)
  const goal = { ...base, replaying: true, replayDecision: { outcome: 'goal' } }
  mock.listener(goal, base)
  mock.listener(base, goal)
  expect(useClipStore.getState().clips).toHaveLength(1)
  expect(useClipStore.getState().clips[0].outcome).toBe('goal')
  mock.listener(goal, base)
  mock.listener({ ...base, matchKey: 2 }, goal)
  expect(useClipStore.getState().clips).toHaveLength(0)
})
