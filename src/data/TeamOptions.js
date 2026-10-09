// Cap customisation options shared by the team builder and online validation.

export const BADGES = [
  { key: 'none', label: 'None' },
  { key: 'star', label: 'Star' },
  { key: 'shield', label: 'Shield' },
  { key: 'bolt', label: 'Bolt' },
  { key: 'crown', label: 'Crown' },
  { key: 'diamond', label: 'Diamond' },
  { key: 'skull', label: 'Skull' },
  { key: 'flame', label: 'Flame' },
]

export const PATTERNS = [
  { key: 'none', label: 'Solid' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'split', label: 'Split' },
  { key: 'ring', label: 'Ring' },
  { key: 'cross', label: 'Cross' },
  { key: 'dots', label: 'Dots' },
  { key: 'wave', label: 'Wave' },
  { key: 'rays', label: 'Rays' },
]

export const FINISHES = [
  { key: 'matte', label: 'Matte' },
  { key: 'satin', label: 'Satin' },
  { key: 'gloss', label: 'Gloss' },
  { key: 'chrome', label: 'Chrome' },
]

export const CAP_ROLES = ['gk', 'def1', 'def2', 'atk1', 'atk2']

export const TEAM_NAME_MAX = 16

/** Kit colours offered by the colour pickers. */
export const COLOR_PRESETS = [
  '#D32F2F', '#C62828', '#E91E63', '#9C27B0',
  '#1565C0', '#0277BD', '#00838F', '#2E7D32',
  '#F57F17', '#E65100', '#FFD700', '#FFFFFF',
  '#424242', '#000000',
]

/** Text a team can print on its caps (arched over the top, like a brand on a real cap). */
export const CAP_TEXT_MAX = 12

/** Clean cap text: letters, numbers, spaces and a little punctuation, at most CAP_TEXT_MAX. */
export function sanitizeCapText(input) {
  if (typeof input !== 'string') return ''
  return input.replace(/[^\p{L}\p{N} .!'&-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, CAP_TEXT_MAX)
}
