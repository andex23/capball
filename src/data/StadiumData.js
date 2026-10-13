/**
 * Stadium / Surface Theme System
 * Each stadium defines the full visual and atmospheric identity of a match venue.
 */

export const STADIUMS = {
  arena: {
    id: 'arena',
    // The table itself, with lines chalked or taped on (the default look)
    top: { surface: 'laminate', c1: '#24262d', c2: '#2c2e36', line: 'rgba(110,225,255,0.92)', note: 'Black table, neon tape' },
    name: 'Game Room',
    tableColor: '#2b2f3a', // the table the board sits on (venue picker preview)
    label: 'Black table, neon lights',
    surface: 'grass',
    floodIntensity: 0.55,
    // Pitch surface
    grass1: '#2a8830',
    grass2: '#32a03a',
    stripeAlpha: 0.035,
    lineColor: 'rgba(255,255,255,0.9)',
    lineWidth: 3,
    // Board frame
    woodColor: '#1c2233',
    trimColor: '#1fb8e0',
    trimGlow: 0.35,
    // Base platform
    baseColor: '#1a2030',
    baseTrimColor: '#3a4256',
    // Background / atmosphere
    bgColor: '#0b0d1c',
    fogColor: '#0b0d1c',
    fogDensity: 0.005,
    groundGlow: '#1a1830',
    // Lighting
    ambientColor: '#fff0dd',
    ambientIntensity: 0.5,
    keyLightColor: '#fff5e0',
    keyLightIntensity: 1.8,
    fillLightColor: '#c8d8ff',
    fillLightIntensity: 0.5,
    floodColor: '#d6dcff',
    rimColor: '#7c4dff',
    // Crowd
    showCrowd: true,
    crowdColors: ['#e53935', '#1e88e5', '#ffd740', '#ff7043', '#66bb6a', '#ab47bc', '#ffffff'],
    // Goal posts
    postColor: '#e8e8e8',
  },

  table: {
    id: 'table',
    // The table itself, with lines chalked or taped on (the default look)
    top: { surface: 'wood', c1: '#a8743f', c2: '#bb8650', line: 'rgba(255,255,255,0.88)', note: 'Oak kitchen table, chalk lines' },
    name: 'Kitchen Table',
    tableColor: '#8a5a30', // the table the board sits on (venue picker preview)
    label: 'Felt board, wooden table',
    surface: 'felt',
    floodIntensity: 0.45,
    grass1: '#256b2c',
    grass2: '#2b7a33',
    stripeAlpha: 0,
    lineColor: 'rgba(255,255,255,0.85)',
    lineWidth: 2.5,
    woodColor: '#5a3a1e',
    trimColor: '#d4a74a',
    baseColor: '#3e2814',
    baseTrimColor: '#d4a74a',
    bgColor: '#2a1f16',
    fogColor: '#2a1f16',
    fogDensity: 0.0055,
    groundGlow: '#1a1510',
    ambientColor: '#ffe8c0',
    ambientIntensity: 0.6,
    keyLightColor: '#ffddaa',
    keyLightIntensity: 1.5,
    fillLightColor: '#ffe0b0',
    fillLightIntensity: 0.4,
    floodColor: '#ffd8a0',
    rimColor: '#664422',
    showCrowd: false,
    crowdColors: [],
    postColor: '#c0c0c0',
  },

  street: {
    id: 'street',
    // The table itself, with lines chalked or taped on (the default look)
    top: { surface: 'laminate', c1: '#56595f', c2: '#606369', line: 'rgba(255,212,60,0.92)', note: 'Folding table, yellow tape' },
    name: 'Street Corner',
    tableColor: '#d9d9d2', // the table the board sits on (venue picker preview)
    label: 'Folding table, night-time pavement',
    surface: 'asphalt',
    floodIntensity: 0.6,
    grass1: '#3b3d42',
    grass2: '#43454b',
    stripeAlpha: 0,
    lineColor: 'rgba(255,214,0,0.85)',
    lineWidth: 4,
    woodColor: '#6f737b',
    trimColor: '#c9a400',
    baseColor: '#5b5e64',
    baseTrimColor: '#2a2c30',
    bgColor: '#090b14',
    fogColor: '#0d1019',
    fogDensity: 0.005,
    groundGlow: '#151518',
    ambientColor: '#e0e0e8',
    ambientIntensity: 0.55,
    keyLightColor: '#f0f0ff',
    keyLightIntensity: 1.6,
    fillLightColor: '#d0d0e0',
    fillLightIntensity: 0.45,
    floodColor: '#ffc27a',
    rimColor: '#5a4a88',
    showCrowd: false,
    crowdColors: [],
    postColor: '#999999',
  },

  gravel: {
    id: 'gravel',
    // The table itself, with lines chalked or taped on (the default look)
    top: { surface: 'planks', c1: '#86603d', c2: '#977048', line: 'rgba(255,255,255,0.82)', note: 'Picnic table planks, chalk lines' },
    name: 'Garden Table',
    tableColor: '#7a5a3a', // the table the board sits on (venue picker preview)
    label: 'Picnic table at sunset',
    surface: 'dirt',
    floodIntensity: 0.2,
    grass1: '#8b7355',
    grass2: '#9a8060',
    stripeAlpha: 0.02,
    lineColor: 'rgba(255,255,255,0.55)',
    lineWidth: 2,
    woodColor: '#6b5540',
    trimColor: '#a08060',
    baseColor: '#4a3828',
    baseTrimColor: '#8b7050',
    bgColor: '#e0905c',
    fogColor: '#8f6250',
    fogDensity: 0.003,
    groundGlow: '#1a1408',
    ambientColor: '#b4a0d8',
    ambientIntensity: 0.6,
    keyLightColor: '#ffbe7a',
    keyLightIntensity: 1.6,
    fillLightColor: '#8d9ee0',
    fillLightIntensity: 0.4,
    floodColor: '#ffd090',
    rimColor: '#553322',
    showCrowd: false,
    crowdColors: [],
    postColor: '#b0a090',
  },
  bar: {
    id: 'bar',
    // The table itself, with lines chalked or taped on (the default look)
    top: { surface: 'wood', c1: '#4b2516', c2: '#5c2e1b', varnish: true, line: 'rgba(255,226,170,0.9)', note: 'Varnished bar top' },
    name: 'Bar Counter',
    tableColor: '#4a2614',
    label: 'Polished bar, warm lamps',
    surface: 'felt',
    floodIntensity: 0.4,
    grass1: '#1f5e33',
    grass2: '#246b3a',
    stripeAlpha: 0,
    lineColor: 'rgba(255,240,210,0.85)',
    lineWidth: 2.5,
    woodColor: '#3b1e0e',
    trimColor: '#c9963c',
    baseColor: '#2a140a',
    baseTrimColor: '#c9963c',
    bgColor: '#1a0e08',
    fogColor: '#1a0e08',
    fogDensity: 0.006,
    groundGlow: '#140a05',
    ambientColor: '#ffd9a8',
    ambientIntensity: 0.5,
    keyLightColor: '#ffcf8a',
    keyLightIntensity: 1.6,
    fillLightColor: '#ffb870',
    fillLightIntensity: 0.35,
    floodColor: '#ffc27a',
    rimColor: '#7a3a14',
    showCrowd: false,
    crowdColors: [],
    postColor: '#d8c8a8',
  },

  desk: {
    id: 'desk',
    // The table itself, with lines chalked or taped on (the default look)
    top: { surface: 'laminate', c1: '#d6c096', c2: '#dfcaa2', line: 'rgba(28,58,160,0.8)', note: 'School desk, biro lines' },
    name: 'School Desk',
    tableColor: '#c79a5e',
    label: 'Classroom desk, break time',
    surface: 'grass',
    floodIntensity: 0.3,
    grass1: '#3f9a45',
    grass2: '#47a84d',
    stripeAlpha: 0.03,
    lineColor: 'rgba(255,255,255,0.9)',
    lineWidth: 2.5,
    woodColor: '#9c6b35',
    trimColor: '#e0b46a',
    baseColor: '#7a5228',
    baseTrimColor: '#e0b46a',
    bgColor: '#dfe6ea',
    fogColor: '#c9d3d8',
    fogDensity: 0.003,
    groundGlow: '#3a3a3a',
    ambientColor: '#ffffff',
    ambientIntensity: 0.75,
    keyLightColor: '#fffaf0',
    keyLightIntensity: 1.5,
    fillLightColor: '#e0ecff',
    fillLightIntensity: 0.5,
    floodColor: '#ffffff',
    rimColor: '#8899aa',
    showCrowd: false,
    crowdColors: [],
    postColor: '#f0f0f0',
  },

  beach: {
    id: 'beach',
    // The table itself, with lines chalked or taped on (the default look)
    top: { surface: 'towel', c1: '#ff7a59', c2: '#ffffff', stripes: ['#ff7a59', '#ffffff', '#2bb7c9', '#ffd35a', '#ffffff'], line: 'rgba(20,32,90,0.85)', note: 'Striped towel' },
    name: 'Beach Towel',
    tableColor: '#e8cf9a',
    label: 'Board on a towel, sun and sea',
    surface: 'grass',
    floodIntensity: 0.15,
    grass1: '#33a457',
    grass2: '#3cb462',
    stripeAlpha: 0.04,
    lineColor: 'rgba(255,255,255,0.92)',
    lineWidth: 2.5,
    woodColor: '#1e88e5',
    trimColor: '#ffffff',
    baseColor: '#1565c0',
    baseTrimColor: '#ffffff',
    bgColor: '#8fd3ff',
    fogColor: '#bfe6ff',
    fogDensity: 0.0025,
    groundGlow: '#e8cf9a',
    ambientColor: '#ffffff',
    ambientIntensity: 0.8,
    keyLightColor: '#fff6dc',
    keyLightIntensity: 1.9,
    fillLightColor: '#cfe9ff',
    fillLightIntensity: 0.5,
    floodColor: '#ffffff',
    rimColor: '#ffd27a',
    showCrowd: false,
    crowdColors: [],
    postColor: '#ffffff',
  },
  // Career only: the top venue a club can build (not in the venue picker)
  capArena: {
    id: 'capArena',
    careerOnly: true,
    // The default finish; a top-division club picks its own (TABLE_FINISHES)
    top: { surface: 'felt', c1: '#1c6a3c', c2: '#227a45', line: 'rgba(255,255,255,0.9)', note: 'Tournament baize, white lines' },
    name: 'Cap Arena',
    tableColor: '#1c6a3c',
    label: 'Pro table, packed arena',
    surface: 'grass',
    floodIntensity: 0.7,
    grass1: '#2a8f34',
    grass2: '#33a63e',
    stripeAlpha: 0.045,
    lineColor: 'rgba(255,255,255,0.95)',
    lineWidth: 3,
    woodColor: '#0b1d6b',
    trimColor: '#c9a35a',
    trimGlow: 0.08,
    baseColor: '#1a120b',
    baseTrimColor: '#ffd23f',
    bgColor: '#07080d',
    fogColor: '#0b0d14',
    fogDensity: 0.0022,
    groundGlow: '#151826',
    ambientColor: '#ffeedd',
    ambientIntensity: 0.38,
    keyLightColor: '#ffffff',
    keyLightIntensity: 2,
    fillLightColor: '#d6e2ff',
    fillLightIntensity: 0.55,
    floodColor: '#eef3ff',
    rimColor: '#ffd23f',
    showCrowd: true,
    crowdColors: ['#1e5bff', '#ffd23f', '#ffffff'],
    postColor: '#ffffff',
  },
}

/**
 * Pro table finishes: a club in the top division chooses the table its home
 * matches at Cap Arena are played on. Each sets the playing surface, its
 * lines, the board's rails and the table's rim and body.
 */
export const TABLE_FINISHES = [
  { id: 'baize', label: 'Tournament baize', note: 'Green felt, white lines', surface: 'felt', c1: '#1c6a3c', c2: '#227a45', line: 'rgba(255,255,255,0.9)', rail: '#24160d', body: '#160e08', frame: '#2a1a10', trim: '#c9a35a', base: '#1a120b' },
  { id: 'midnight', label: 'Midnight', note: 'Navy laminate, gold lines', surface: 'laminate', c1: '#17224a', c2: '#1c2a58', line: 'rgba(242,193,78,0.92)', rail: '#0c1230', body: '#0a0f26', frame: '#0e1638', trim: '#f2c14e', base: '#0a0f26' },
  { id: 'gloss', label: 'Black gloss', note: 'Black lacquer, white lines', surface: 'laminate', c1: '#16171b', c2: '#1d1f24', line: 'rgba(255,255,255,0.88)', rail: '#0d0e10', body: '#0b0c0e', frame: '#111215', trim: '#c7ccd4', base: '#0b0c0e' },
  { id: 'walnut', label: 'Walnut', note: 'Oiled wood, cream lines', surface: 'wood', c1: '#5b3920', c2: '#6b4528', line: 'rgba(250,236,205,0.9)', rail: '#2b1a0e', body: '#22150b', frame: '#2b1a0e', trim: '#c9a35a', base: '#1d1209' },
  { id: 'clay', label: 'Red clay', note: 'Terracotta felt, white lines', surface: 'felt', c1: '#8a3b24', c2: '#9a452b', line: 'rgba(255,248,240,0.9)', rail: '#2a1712', body: '#1e110d', frame: '#2a1712', trim: '#e0b070', base: '#1e110d' },
  { id: 'club', label: 'Club colours', note: 'Your colour, your lines', surface: 'laminate', club: true },
  { id: 'ivory', label: 'Classic ivory', note: 'White laminate, navy lines', surface: 'laminate', c1: '#e6e8ee', c2: '#eef0f5', line: 'rgba(11,29,107,0.85)', rail: '#0b1d6b', body: '#0b1d6b', frame: '#0b1d6b', trim: '#ffd23f', base: '#0b1d6b' },
]
export const DEFAULT_FINISH = 'baize'
const FINISH_IDS = new Set(TABLE_FINISHES.map((f) => f.id))
export const isFinish = (id) => typeof id === 'string' && FINISH_IDS.has(id)

const HEX = /^#[0-9a-f]{6}$/i
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * A finish ready to paint: `club` takes the club's own colours (`kit`:
 * { primary, edge }), toned down so the caps still stand out on it.
 */
export function resolveFinish(id, kit = null) {
  const f = TABLE_FINISHES.find((x) => x.id === id) || TABLE_FINISHES[0]
  if (!f.club) return f
  const p = HEX.test(kit?.primary || '') ? kit.primary : '#1d4ed8'
  const e = HEX.test(kit?.edge || '') ? kit.edge : '#ffffff'
  const dark = shade(p, -0.55)
  return { ...f, c1: dark, c2: shade(p, -0.48), line: e.toLowerCase() === p.toLowerCase() ? 'rgba(255,255,255,0.9)' : e, rail: shade(p, -0.75), body: shade(p, -0.8), frame: shade(p, -0.7), trim: e, base: shade(p, -0.8) }
}

/** The same finish every time for a club that isn't yours (its away table). */
export function finishForName(name = '') {
  let h = 0
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const pool = TABLE_FINISHES.filter((f) => !f.club && f.id !== 'ivory')
  return pool[h % pool.length].id
}

/** A venue painted with a pro finish (Cap Arena only). */
export function withFinish(stadiumConfig, finish) {
  if (!finish || !stadiumConfig?.top) return stadiumConfig
  return {
    ...stadiumConfig,
    top: { ...stadiumConfig.top, surface: finish.surface, c1: finish.c1, c2: finish.c2, line: finish.line, note: finish.note },
    tableColor: finish.c1, woodColor: finish.frame, trimColor: finish.trim, baseColor: finish.base, baseTrimColor: finish.trim,
  }
}

export const STADIUM_KEYS = Object.keys(STADIUMS).filter((k) => !STADIUMS[k].careerOnly)
export const DEFAULT_STADIUM = 'arena'

/** The venue as painted: its own table top (default) or a green pitch. */
export function surfaceFor(stadiumConfig, pitchStyle = 'table') {
  const top = stadiumConfig.top
  if (pitchStyle !== 'table' || !top) return stadiumConfig
  return { ...stadiumConfig, surface: top.surface, grass1: top.c1, grass2: top.c2, lineColor: top.line, lineWidth: top.surface === 'towel' ? 7 : 4, stripeAlpha: 0 }
}

