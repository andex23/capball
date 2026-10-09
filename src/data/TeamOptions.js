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

// A keeper and five outfield caps: two at the back, one in midfield, two up front
export const CAP_ROLES = ['gk', 'def1', 'def2', 'mid', 'atk1', 'atk2']

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

/**
 * Ready-made cap designs in the style of real drink caps. Picking one sets the
 * colours, print, finish and text in one go; everything stays editable after.
 */
export const CAP_DESIGNS = [
  { key: 'cola', name: 'Cola', primary: '#C8102E', edge: '#FFFFFF', pattern: 'wave', badge: 'none', finish: 'gloss', capText: 'COLA' },
  { key: 'fizz', name: 'Blue Fizz', primary: '#0B3D91', edge: '#FFFFFF', pattern: 'split', badge: 'none', finish: 'gloss', capText: 'FIZZ' },
  { key: 'lemon', name: 'Lemon Lime', primary: '#1E8E3E', edge: '#FFE14D', pattern: 'wave', badge: 'none', finish: 'gloss', capText: 'LEMON LIME' },
  { key: 'orange', name: 'Orange Pop', primary: '#F57F17', edge: '#FFFFFF', pattern: 'rays', badge: 'none', finish: 'gloss', capText: 'ORANGE' },
  { key: 'root', name: 'Root Beer', primary: '#5D3A1A', edge: '#F2E2B6', pattern: 'ring', badge: 'none', finish: 'satin', capText: 'ROOT BEER' },
  { key: 'ginger', name: 'Ginger Ale', primary: '#0B4D2C', edge: '#E8C766', pattern: 'stripe', badge: 'none', finish: 'satin', capText: 'GINGER ALE' },
  { key: 'malt', name: 'Malt', primary: '#141414', edge: '#D4AF37', pattern: 'ring', badge: 'crown', finish: 'gloss', capText: 'MALT' },
  { key: 'lager', name: 'Lager', primary: '#E9E9E9', edge: '#B71C1C', pattern: 'none', badge: 'star', finish: 'chrome', capText: 'LAGER' },
  { key: 'cream', name: 'Cream Soda', primary: '#E91E63', edge: '#FFFFFF', pattern: 'dots', badge: 'none', finish: 'gloss', capText: 'CREAM SODA' },
  { key: 'tonic', name: 'Tonic', primary: '#00838F', edge: '#FFFFFF', pattern: 'cross', badge: 'none', finish: 'satin', capText: 'TONIC' },
]

const DESIGN_FIELDS = ['primary', 'edge', 'pattern', 'badge', 'finish', 'capText']

/** The fields a design sets (without its key and name). */
export function designPatch(design) {
  return { ...Object.fromEntries(DESIGN_FIELDS.map((k) => [k, design[k]])), textColor: '', skirtColor: '' }
}

/** Is this kit exactly the given design? */
export function isDesign(config, design) {
  return !config.textColor && !config.skirtColor &&
    DESIGN_FIELDS.every((k) => (config[k] || (k === 'capText' ? '' : 'none')) === design[k])
}

/** What an option goes back to when you tap it again to clear it. */
export const CLEAR_TO = { pattern: 'none', badge: 'none', finish: 'gloss' }

/**
 * Rare designs you earn. `need` reads the player's progress
 * ({ won, goalsFor, cleanSheets, promotions, titles, cups, streak }) and
 * says how far along they are: [have, target].
 */
export const RARE_DESIGNS = [
  { key: 'silver', name: 'Silver Star', primary: '#CFD8DC', edge: '#0D47A1', pattern: 'ring', badge: 'star', finish: 'chrome', capText: 'SILVER',
    hint: 'Win 10 matches', need: (p) => [p.won, 10] },
  { key: 'gold', name: 'Golden Crown', primary: '#D4AF37', edge: '#FFF3B0', pattern: 'rays', badge: 'crown', finish: 'chrome', capText: 'GOLD',
    hint: 'Win promotion in Career', need: (p) => [p.promotions, 1] },
  { key: 'boot', name: 'Golden Boot', primary: '#1A1A1A', edge: '#FFD700', pattern: 'stripe', badge: 'bolt', finish: 'gloss', capText: 'BOOT',
    hint: 'Score 50 goals', need: (p) => [p.goalsFor, 50] },
  { key: 'wall', name: 'Iron Wall', primary: '#37474F', edge: '#B0BEC5', pattern: 'cross', badge: 'shield', finish: 'satin', capText: 'IRON WALL',
    hint: 'Keep 5 clean sheets', need: (p) => [p.cleanSheets, 5] },
  { key: 'cup', name: 'Cup Winner', primary: '#8E0000', edge: '#FFD700', pattern: 'split', badge: 'crown', finish: 'gloss', capText: 'WINNERS',
    hint: 'Win a tournament', need: (p) => [p.cups, 1] },
  { key: 'lucky', name: 'Lucky Seven', primary: '#00A651', edge: '#FFFFFF', pattern: 'dots', badge: 'star', finish: 'gloss', capText: 'LUCKY 7',
    hint: 'Beat the daily challenge 7 days running', need: (p) => [p.streak, 7] },
  { key: 'royal', name: 'Royal Purple', primary: '#4A148C', edge: '#FFD700', pattern: 'ring', badge: 'crown', finish: 'chrome', capText: 'ROYAL',
    hint: 'Win the Premier Cap League', need: (p) => [p.titles, 1] },
]

/** Is a rare design unlocked for this progress? */
export const isUnlocked = (design, progress) => {
  const [have, target] = design.need(progress)
  return (have || 0) >= target
}

/** Placeholder team names that shouldn't be printed on caps. */
const DEFAULT_NAMES = /^(team\s*[12]|defenders|my team|my club)$/i

/**
 * What's printed round the top of a team's caps: their own cap text, or else
 * the team name (not the placeholder "Team 1" / "Team 2").
 */
export function capLabel(config) {
  const own = typeof config?.capText === 'string' ? config.capText.trim() : ''
  if (own) return own
  if (config?.showName === false) return ''
  const name = typeof config?.name === 'string' ? config.name.trim() : ''
  if (!name || DEFAULT_NAMES.test(name)) return ''
  return name.slice(0, CAP_TEXT_MAX)
}
