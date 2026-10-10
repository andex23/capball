// Team configurations and formation positions
// Pitch dimensions: 30 x 20 units, centered at origin
export const PITCH = {
  width: 30,
  height: 20,
  halfW: 15,
  halfH: 10,
  goalWidth: 6,
  wallThickness: 1.0,
  penAreaW: 6,   // penalty area extends 6 units from goal line
  penAreaH: 12,  // penalty area height (y = ±6)
  centerCircleR: 3,
  goalDepth: 3.0, // room for a cap to get behind a ball still touching the goal line
  penSpotDist: 5.8, // penalty spot distance from the goal line (inside the 6-deep box)
}

// Cap radii
export const CAP_RADIUS = 0.75
export const GK_RADIUS = 1.1 // a bigger frame than outfield caps (1.47x): more of the goal covered
export const BALL_RADIUS = 0.48 // 0.64x standard

// Physics values — tabletop feel. Tuned together; see the notes on each.
// Too fast / floaty → lower maxFlickVelocity or raise linearFriction.
// Too sticky / dies quickly → the reverse. Bouncy walls → restitution.
export const PHYSICS = {
  playerMass: 2.5,       // heavy caps — don't get pushed around easily
  gkMass: 4.0,           // GK heavier
  ballMass: 0.4,         // ball has weight — doesn't fly uncontrollably
  playerFriction: 0,
  gkFriction: 0,
  ballFriction: 0,
  restitution: 0.55,     // cap off a wall: a firm knock back, not a pinball
  ballRestitution: 0.6,  // the ball off walls and caps
  ballFrictionRatio: 0.55,// the ball rolls: it slows at this fraction of a cap's rate
  restingSpeed: 0.2,     // below this closing speed Matter kills a bounce (its default 2 is for pixel worlds)
  maxFlickVelocity: 3.2, // full-power flick (a full pull) — two-thirds of the pitch for a lone cap
  linearFriction: 0.256, // steady slowdown per physics frame: a full flick slides ~20 units
  minFlickThreshold: 0.5,
  settleSpeed: 0.02,     // settle detection
  settleTime: 300,       // quick settle check
  subSteps: 8,           // good collision stability
  timeScale: 0.3,        // physics frames per real 60 Hz frame: a full flick slides for ~0.7 s, a struck ball rolls on for 1-1.5 s
}

// Default teams
export const TEAMS = {
  team1: {
    name: 'Red Lions',
    primary: '#D32F2F',
    edge: '#FFD700',
  },
  team2: {
    name: 'Blue Stars',
    primary: '#1565C0',
    edge: '#FFFFFF',
  },
}

// Formation presets — a keeper plus five outfield caps (the numbers count back to front)
export const FORMATIONS = {
  default: { name: '2-1-2', description: 'Balanced' },
  diamond: { name: '1-3-1', description: 'Diamond' },
  line: { name: '2-2-1', description: 'Midfield' },
  attack: { name: '1-2-2', description: 'Attack' },
  parkTheBus: { name: '3-1-1', description: 'Park the bus' },
}

// Formation position generators (x as a share of the half-length from the
// centre, toward the team's own goal; y as a share of the half-width)
const FORMATION_POSITIONS = {
  default: (dir, hw, hh) => ({
    gk: { x: dir * hw * 0.9, y: 0 },
    def1: { x: dir * hw * 0.5, y: -hh * 0.45 },
    def2: { x: dir * hw * 0.5, y: hh * 0.45 },
    mid: { x: dir * hw * 0.3, y: 0 },
    atk1: { x: dir * hw * 0.12, y: -hh * 0.4 },
    atk2: { x: dir * hw * 0.12, y: hh * 0.4 },
  }),
  diamond: (dir, hw, hh) => ({
    gk: { x: dir * hw * 0.9, y: 0 },
    def1: { x: dir * hw * 0.58, y: 0 },
    def2: { x: dir * hw * 0.34, y: -hh * 0.55 },
    mid: { x: dir * hw * 0.34, y: 0 },
    atk1: { x: dir * hw * 0.34, y: hh * 0.55 },
    atk2: { x: dir * hw * 0.08, y: 0 },
  }),
  line: (dir, hw, hh) => ({
    gk: { x: dir * hw * 0.9, y: 0 },
    def1: { x: dir * hw * 0.52, y: -hh * 0.42 },
    def2: { x: dir * hw * 0.52, y: hh * 0.42 },
    mid: { x: dir * hw * 0.28, y: -hh * 0.35 },
    atk1: { x: dir * hw * 0.28, y: hh * 0.35 },
    atk2: { x: dir * hw * 0.08, y: 0 },
  }),
  attack: (dir, hw, hh) => ({
    gk: { x: dir * hw * 0.9, y: 0 },
    def1: { x: dir * hw * 0.55, y: 0 },
    def2: { x: dir * hw * 0.32, y: -hh * 0.45 },
    mid: { x: dir * hw * 0.32, y: hh * 0.45 },
    atk1: { x: dir * hw * 0.1, y: -hh * 0.38 },
    atk2: { x: dir * hw * 0.1, y: hh * 0.38 },
  }),
  parkTheBus: (dir, hw, hh) => ({
    gk: { x: dir * hw * 0.9, y: 0 },
    def1: { x: dir * hw * 0.55, y: -hh * 0.5 },
    def2: { x: dir * hw * 0.58, y: 0 },
    atk1: { x: dir * hw * 0.55, y: hh * 0.5 },
    mid: { x: dir * hw * 0.32, y: 0 },
    atk2: { x: dir * hw * 0.1, y: 0 },
  }),
}

/**
 * Get formation positions for a team.
 * @param {string} team - 'team1' or 'team2'
 * @param {string} formationKey - formation preset key
 * @param {string} team1Side - 'left' or 'right' (which side team1 defends)
 */
export function getFormationPositions(team, formationKey = 'default', team1Side = 'left') {
  const team1Dir = team1Side === 'right' ? 1 : -1
  const dir = team === 'team1' ? team1Dir : -team1Dir

  const hw = PITCH.halfW
  const hh = PITCH.halfH
  const fn = FORMATION_POSITIONS[formationKey] || FORMATION_POSITIONS.default
  return fn(dir, hw, hh)
}
