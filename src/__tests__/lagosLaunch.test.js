import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rewardsKey = 'capball:rewards:v1'
const save = { v: 1, items: { [rewardsKey]: '{"bank":27}' } }

describe('opening Counterball inside Lagos Life', () => {
  let items, sdk
  beforeEach(() => {
    vi.resetModules()
    items = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => items.get(k) ?? null,
      setItem: (k, v) => items.set(k, String(v)),
      removeItem: (k) => items.delete(k),
    })
    sdk = { init: vi.fn(async () => ({ mode: 'test', player: { id: 'returning' } })), session: async () => ({ session: 'test' }) }
    vi.stubGlobal('window', { Vatar: sdk })
    vi.stubGlobal('__COUNTERBALL_PLATFORM__', 'lagos')
    vi.stubGlobal('location', { reload: vi.fn() })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: save })))
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('opens an older cloud save on the first launch, before the inbox creates its defaults', async () => {
    const { prepareLagosLaunch } = await import('../lagos/launch')
    const connection = await prepareLagosLaunch()
    expect(JSON.parse(connection.cloudBaseline)).toEqual(save)
    expect(items.has('capball:inbox-seen:v1')).toBe(false)
    const { useRewardsStore } = await import('../state/rewardsStore')
    await import('../state/inboxStore')
    expect(useRewardsStore.getState().bank).toBe(27)
    expect(items.has('capball:inbox-seen:v1')).toBe(true)
    expect(sdk.init).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(location.reload).not.toHaveBeenCalled()
  })

  it('keeps the career on this phone when another device saved progress without it', async () => {
    const careerKey = 'capball:career-mode:v1'
    const { newCareer } = await import('../game/career')
    const mine = JSON.stringify(newCareer({ name: 'Eko FC' }, { now: 5 }))
    items.set('counterball:lagos:owner', 'returning')
    items.set(careerKey, mine)
    const { prepareLagosLaunch } = await import('../lagos/launch')
    const connection = await prepareLagosLaunch()
    expect(items.get(careerKey)).toBe(mine)
    expect(items.get(rewardsKey)).toBe(save.items[rewardsKey])
    expect(connection.keptCareer).toBe(true)
    // ...and the next save sends it up: the baseline is what the cloud had, not this phone
    expect(JSON.parse(connection.cloudBaseline).items[careerKey]).toBeUndefined()
    expect(items.get('counterball:lagos:career-backup:returning')).toBe(mine)
  })

  it('restores and collects real progress when the frame has no disk access', async () => {
    vi.stubGlobal('localStorage', undefined)
    const { prepareLagosLaunch } = await import('../lagos/launch')
    await prepareLagosLaunch()
    const { useRewardsStore } = await import('../state/rewardsStore')
    expect(useRewardsStore.getState().bank).toBe(27)
    useRewardsStore.getState()._save({ bank: 39 })
    const { collectSave } = await import('../utils/playerSave')
    expect(JSON.parse(collectSave().items[rewardsKey]).bank).toBe(39)
  })

  it('keeps the incoming player’s local progress and holds uploads if the cloud is offline', async () => {
    items.set('counterball:lagos:owner', 'other')
    items.set(rewardsKey, '{"bank":99}')
    items.set('counterball:lagos:save:returning', JSON.stringify(save))
    fetch.mockRejectedValue(new Error('offline'))
    const { prepareLagosLaunch } = await import('../lagos/launch')
    const connection = await prepareLagosLaunch()
    expect(connection.cloudBaseline).toBeNull()
    expect(items.get(rewardsKey)).toBe(save.items[rewardsKey])
    const previous = JSON.parse(items.get('counterball:lagos:save:other'))
    expect(JSON.parse(previous.items[rewardsKey]).bank).toBe(99)
    expect(fetch).toHaveBeenCalledTimes(2) // a second, longer try before the game opens
    expect(location.reload).not.toHaveBeenCalled()
  })

  it('uploads the daily receipt and the career payout together and retries an interrupted claim only once', async () => {
    vi.useFakeTimers()
    window.addEventListener = vi.fn()
    vi.stubGlobal('document', { addEventListener: vi.fn() })
    const { newCareer } = await import('../game/career')
    const careerKey = 'capball:career-mode:v1'
    const club = newCareer({ name: 'Rail End' }, { now: 11 })
    let remote = { v: 1, items: { [careerKey]: JSON.stringify(club) } }
    const puts = []
    let offline = true
    fetch.mockImplementation(async (_url, opts) => {
      const req = JSON.parse(opts.body)
      if (req.action === 'loadSave') return Response.json({ ok: true, data: remote })
      if (req.action === 'putSave') {
        expect(req.expectedPlayerId).toBe('returning')
        puts.push(req.data)
        if (offline) return Response.json({ error: 'offline' }, { status: 503 })
        remote = req.data
      }
      return Response.json({ ok: true, owned: [] })
    })
    async function open() {
      const { prepareLagosLaunch } = await import('../lagos/launch')
      const connection = await prepareLagosLaunch()
      const { useLagosStore } = await import('../lagos/lagosStore')
      await useLagosStore.getState().boot(connection)
      return useLagosStore.getState()
    }
    let lagos = await open()
    const { useRewardsStore } = await import('../state/rewardsStore')
    const { pendingClaims } = await import('../lagos/rewardClaims')
    const day = '2026-11-18'
    useRewardsStore.getState().claim(day)
    expect(await lagos.saveCloud()).toBe(false)
    expect(puts).toHaveLength(1)
    expect(JSON.parse(puts[0].items[rewardsKey]).daily.last).toBe(day)
    expect(JSON.parse(puts[0].items[careerKey]).coins).toBe(club.coins + 10)
    expect(pendingClaims('test', 'returning')).toEqual([day])
    expect(pendingClaims('test', 'another-player')).toEqual([])

    // A later season was saved on another phone before this one reopens.
    remote.items[careerKey] = JSON.stringify({ ...club, season: 2, coins: 105 })
    vi.resetModules()
    offline = false
    lagos = await open()
    expect(await lagos.saveCloud()).toBe(true)
    const restored = JSON.parse(remote.items[careerKey])
    expect([restored.season, restored.coins]).toEqual([2, 115])
    expect(JSON.parse(remote.items[rewardsKey]).daily.last).toBe(day)
    expect(pendingClaims('test', 'returning')).toEqual([])
    vi.resetModules()
    await open()
    expect(puts).toHaveLength(2)
  })
})
