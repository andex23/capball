/**
 * The "how this mode works" cards. They never pop up on their own: a player
 * opens them from a mode's "?" (or "How … works" in the pause menu).
 */
import { create } from 'zustand'
import { MODE_INTROS } from '../data/modeIntros'

export const useIntroStore = create((set) => ({
  open: null, // the mode whose cards are showing

  /** The "?": show a mode's cards. */
  show(mode) {
    if (MODE_INTROS[mode]) set({ open: mode })
  },

  close() {
    set({ open: null })
  },
}))
