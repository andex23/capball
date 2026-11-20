import { describe, it, expect, beforeEach } from 'vitest'
import { useIntroStore } from '../state/introStore'
import { MODE_INTROS } from '../data/modeIntros'
import fs from 'node:fs'

describe('how each mode works', () => {
  beforeEach(() => useIntroStore.setState({ open: null }))

  it('nothing opens by itself; the "?" opens a mode\'s cards and closing hides them', () => {
    expect(useIntroStore.getState().open).toBe(null)
    useIntroStore.getState().show('career')
    expect(useIntroStore.getState().open).toBe('career')
    useIntroStore.getState().close()
    expect(useIntroStore.getState().open).toBe(null)
    useIntroStore.getState().show('nope')
    expect(useIntroStore.getState().open).toBe(null)
  })

  it('every card has a title, text and a screenshot that exists', () => {
    for (const [mode, intro] of Object.entries(MODE_INTROS)) {
      expect(intro.cards.length, mode).toBeGreaterThan(0)
      for (const c of intro.cards) {
        expect(c.title && c.text, mode).toBeTruthy()
        expect(fs.existsSync(`public/intro/${c.img}.webp`), c.img).toBe(true)
      }
    }
  })
})
