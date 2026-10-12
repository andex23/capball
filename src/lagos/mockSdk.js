/**
 * Development stand-in for the Lagos Life SDK (never part of a frame in
 * production: sdk.js only loads it in `npm run dev` outside a frame with ?mock).
 * Two tabs in the same browser can pair for a friend match through
 * localStorage + BroadcastChannel.
 */
const KEY = 'mockVatar:matches'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
const write = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ } }
const code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('')
const err = (c) => Object.assign(new Error(c), { code: c })

export function createMockSdk() {
  let id = new URLSearchParams(location.search).get('pid') || sessionStorage.getItem('mockVatar:id')
  if (!id) { id = `t_${Math.random().toString(36).slice(2, 10)}`; sessionStorage.setItem('mockVatar:id', id) }
  const name = new URLSearchParams(location.search).get('name') || `Player ${id.slice(2, 5).toUpperCase()}`
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mockVatar') : null
  const listeners = new Set()
  const pauses = new Set()
  const resumes = new Set()
  let best = 0
  let lastScore = 0
  const scores = JSON.parse(localStorage.getItem('mockVatar:scores') || '{}')

  // Stand-in for our /api/lagos shop endpoints, kept in localStorage
  const ownedKey = `mockVatar:owned:${id}`
  const purchasesMade = new Map()
  const realFetch = window.fetch.bind(window)
  window.fetch = async (url, init) => {
    if (String(url) !== '/api/lagos') return realFetch(url, init)
    const body = JSON.parse(init?.body || '{}')
    const owned = JSON.parse(localStorage.getItem(ownedKey) || '[]')
    const ok = (data) => new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
    if (body.action === 'owned') return ok({ owned })
    if (body.action === 'loadSave') return ok({ data: JSON.parse(localStorage.getItem(`mockVatar:save:${id}`) || 'null') })
    if (body.action === 'putSave') { localStorage.setItem(`mockVatar:save:${id}`, JSON.stringify(body.data)); return ok({}) }
    if (body.action === 'claim') {
      // ?claimfail in the address: the shop server isn't set up until localStorage mockVatar:fixed is set
      if (new URLSearchParams(location.search).has('claimfail') && !localStorage.getItem('mockVatar:fixed')) return new Response(JSON.stringify({ error: 'shop-not-configured', message: 'The shop server isn’t set up yet.' }), { status: 503 })
      const productId = purchasesMade.get(body.purchaseId)
      if (!productId) return new Response(JSON.stringify({ error: 'bad-purchase', message: 'That purchase couldn’t be found for you.' }), { status: 400 })
      const next = [...new Set([...owned, productId])]
      localStorage.setItem(ownedKey, JSON.stringify(next))
      return ok({ productId, owned: next })
    }
    return ok({})
  }
  const view = (m) => m && ({ ...m, me: id })
  const emit = (m) => { for (const fn of listeners) fn(view(m)) }
  channel?.addEventListener('message', (e) => { const m = e.data; if (m?.players?.some((p) => p.id === id)) emit(m) })
  const save = (m) => {
    write([...read().filter((x) => x.id !== m.id), m])
    emit(m)
    channel?.postMessage(m)
    return view(m)
  }
  const mine = () => read().find((m) => ['open', 'playing'].includes(m.status) && m.players.some((p) => p.id === id))
  const join = (m) => {
    if (!m || m.status !== 'open') throw err(m ? 'not_open' : 'not_found')
    return save({ ...m, status: 'playing', players: [...m.players, { id, name }] })
  }

  return {
    version: '1',
    async init() { return { player: { id, name, avatar: null }, session: `mock.${id}`, mode: 'test' } },
    async session() { return { session: `mock.${id}`, exp: Date.now() + 15 * 60_000 } },
    onPause(fn) { pauses.add(fn); return () => pauses.delete(fn) },
    onResume(fn) { resumes.add(fn); return () => resumes.delete(fn) },
    // ?leftover=<productId>: a purchase from an earlier visit still waiting to be delivered
    async purchases() {
      const left = new URLSearchParams(location.search).get('leftover')
      if (!left) return []
      purchasesMade.set('pu_left', left)
      return [{ purchaseId: 'pu_left', productId: left }]
    },
    onPurchase() { return () => {} },
    async purchase(productId) {
      // ?fail=1 in the address: the player cancels
      if (new URLSearchParams(location.search).has('fail')) throw err('cancelled')
      const purchaseId = `pu_${Math.random().toString(36).slice(2, 10)}`
      purchasesMade.set(purchaseId, productId)
      return { purchaseId, productId }
    },
    async submitScore(n) {
      if (Date.now() - lastScore < 20_000) throw err('too_soon')
      lastScore = Date.now()
      best = Math.max(best, scores[id] || 0, n)
      scores[id] = best
      localStorage.setItem('mockVatar:scores', JSON.stringify(scores))
      return { best, accepted: true }
    },
    async leaderboard() {
      const top = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([pid, score], i) => ({ rank: i + 1, name: pid === id ? name : `Player ${pid.slice(2, 5).toUpperCase()}`, score }))
      const me = top.find((r) => r.name === name) || null
      return { top: top.slice(0, 50), me }
    },
    match: {
      async create({ stake = 0, seats = 2 } = {}) {
        return save({ id: `m_${Math.random().toString(36).slice(2)}`, code: code(), status: 'open', stake, seats, players: [{ id, name }], mode: 'test', winner: null, endsAt: null })
      },
      async join(c) { return join(read().find((m) => m.code === String(c).toUpperCase())) },
      async quick({ stake = 0 } = {}) {
        const open = read().find((m) => m.status === 'open' && m.stake === stake && !m.players.some((p) => p.id === id))
        return open ? join(open) : this.create({ stake, seats: 2 })
      },
      async current() { return view(mine() || null) },
      async leave() { const m = mine(); if (m) save({ ...m, status: m.status === 'open' ? 'cancelled' : m.status }) ; return null },
      onUpdate(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    },
    // Test hooks
    _pause() { for (const fn of pauses) fn() },
    _resume() { for (const fn of resumes) fn() },
  }
}
