import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rpc } from '../online/supabase'
import { useAccountStore, applySave } from '../state/accountStore'
vi.mock('../online/supabase', () => ({ rpc: vi.fn(), ApiError: class extends Error {} }))

const careerKey = 'capball:career-mode:v1'
let items
beforeEach(() => {
  items = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => items.set(k, v),
    removeItem: (k) => items.delete(k),
  })
  useAccountStore.getState().forget()
  useAccountStore.setState({ token: 'test-session', username: 'test-player', error: null, saving: false })
  rpc.mockReset()
})
afterEach(() => { useAccountStore.getState().forget(); vi.unstubAllGlobals() })

describe('online account progress', () => {
  it('keeps local career and session when signing out cannot save', async () => {
    items.set(careerKey, 'unsaved career')
    rpc.mockRejectedValue(new Error('Network unavailable'))
    expect(await useAccountStore.getState().signOut()).toBe(false)
    expect(items.get(careerKey)).toBe('unsaved career')
    expect(useAccountStore.getState().username).toBe('test-player')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('retains local progress but permits signing in again after session expiry', async () => {
    items.set(careerKey, 'keep this career')
    rpc.mockRejectedValue(Object.assign(new Error('Session expired'), { code: 'signed-out' }))
    expect(await useAccountStore.getState().save()).toBe(false)
    expect(useAccountStore.getState().username).toBeNull()
    expect(items.get(careerKey)).toBe('keep this career')
  })

  it('uploads changes made while another career upload is in flight', async () => {
    let finish
    rpc.mockImplementationOnce(() => new Promise((r) => { finish = r }))
      .mockResolvedValue({ ok: true, savedAt: '2026-10-10T09:00:00Z' })
    items.set(careerKey, 'match one')
    const first = useAccountStore.getState().save({ force: true })
    items.set(careerKey, 'match two')
    const second = useAccountStore.getState().save({ force: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    finish({ ok: true })
    expect(await first).toBe(true)
    expect(await second).toBe(true)
    expect(rpc.mock.calls[1][1].p_data.items[careerKey]).toBe('match two')
  })

  it('replaces stale account progress with the authoritative cloud snapshot', () => {
    items.set(careerKey, 'old account career')
    items.set('capball:daily:v1', 'old account streak')
    expect(applySave({ v: 1, items: { 'capball.device': 'new-device' } })).toBe(true)
    expect(items.has(careerKey)).toBe(false)
    expect(items.has('capball:daily:v1')).toBe(false)
    expect(items.get('capball.device')).toBe('new-device')
  })

  it('does not erase progress for a malformed cloud response', () => {
    items.set(careerKey, 'keep me')
    expect(applySave({ items: {} })).toBe(false)
    expect(items.get(careerKey)).toBe('keep me')
  })

  it('does not activate an account before its cloud save is loaded', async () => {
    useAccountStore.getState().forget()
    rpc.mockResolvedValueOnce({ token: 'new-session', username: 'new-player' })
      .mockRejectedValueOnce(new Error('Cloud load failed'))
    expect(await useAccountStore.getState().signIn('new-player', 'test-password')).toBe(false)
    expect(useAccountStore.getState().username).toBeNull()
    expect(items.has('capball:account')).toBe(false)
  })
})
