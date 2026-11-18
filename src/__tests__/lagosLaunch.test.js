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
    sdk = { init: vi.fn(async () => ({ player: { id: 'returning' } })), session: async () => ({ session: 'test' }) }
    vi.stubGlobal('window', { Vatar: sdk })
    vi.stubGlobal('__COUNTERBALL_PLATFORM__', 'lagos')
    vi.stubGlobal('location', { reload: vi.fn() })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: save })))
  })
  afterEach(() => vi.unstubAllGlobals())

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
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(location.reload).not.toHaveBeenCalled()
  })
})
