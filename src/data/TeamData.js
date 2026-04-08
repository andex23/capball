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
}

// Cap radii
export const CAP_RADIUS = 0.75
export const GK_RADIUS = 1.0 // 1.33x standard
export const BALL_RADIUS = 0.48 // 0.64x standard

// Physics values — crisp tabletop arcade feel
export const PHYSICS = {
  playerMass: 2.5,       // heavy caps — don't get pushed around easily
  gkMass: 4.0,           // GK heavier
  ballMass: 0.4,         // ball has weight — doesn't fly uncontrollably
  playerFriction: 0,
  gkFriction: 0,
  ballFriction: 0,
  restitution: 0.9,      // wall bounce — strong rebound off walls
  maxFlickVelocity: 4.5, // max shot power — lower for more control
  linearFriction: 0.018, // moderate friction — things slide, slow, and stop naturally
  minFlickThreshold: 0.5,
  settleSpeed: 0.02,     // settle detection
  settleTime: 300,       // quick settle check
  subSteps: 8,           // good collision stability
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

// Formation presets
export const FORMATIONS = {
  default: { name: '2-2', description: 'Balanced' },
  diamond: { name: 'Diamond', description: '1-2-1' },
  line: { name: 'Line', description: '1-3' },
  parkTheBus: { name: 'Park the Bus', description: '3-1' },
}

// Formation position generators
const FORMATION_POSITIONS = {
  default: (dir, hw, hh) => ({
    gk: { x: dir * hw * 0.9, y: 0 },
    def1: { x: dir * hw * 0.42, y: -hh * 0.45 },
    def2: { x: dir * hw * 0.42, y: hh * 0.45 },
    atk1: { x: dir * hw * 0.12, y: -hh * 0.38 },
    atk2: { x: dir * hw * 0.12, y: hh * 0.38 },
  }),
  diamond: (dir, hw, hh) => ({
    gk: { x: dir * hw * 0.9, y: 0 },
    def1: { x: dir * hw * 0.58, y: 0 },
    def2: { x: dir * hw * 0.32, y: -hh * 0.45 },
    atk1: { x: dir * hw * 0.32, y: hh * 0.45 },
    atk2: { x: dir * hw * 0.06, y: 0 },
  }),
  line: (dir, hw, hh) => ({
    gk: { x: dir * hw * 0.9, y: 0 },
    def1: { x: dir * hw * 0.52, y: 0 },
    def2: { x: dir * hw * 0.16, y: -hh * 0.5 },
    atk1: { x: dir * hw * 0.16, y: 0 },
    atk2: { x: dir * hw * 0.16, y: hh * 0.5 },
  }),
  parkTheBus: (dir, hw, hh) => ({
    gk: { x: dir * hw * 0.9, y: 0 },
    def1: { x: dir * hw * 0.52, y: -hh * 0.45 },
    def2: { x: dir * hw * 0.52, y: 0 },
    atk1: { x: dir * hw * 0.52, y: hh * 0.45 },
    atk2: { x: dir * hw * 0.12, y: 0 },
  }),
}

/**
 * Get formation positions for a team.
 * @param {string} team - 'team1' or 'team2'
 * @param {string} formationKey - formation preset key
 * @param {string} team1Side - 'left' or 'right' (which side team1 defends)
 */
export function getFormationPositions(team, formationKey = 'default', team1Side = 'left') {
  let dir
  if (team1Side === 'left') {
    dir = team === 'team1' ? -1 : 1  // team1 on left, team2 on right
  } else {
    dir = team === 'team1' ? 1 : -1  // team1 on right, team2 on left
  }

  const hw = PITCH.halfW
  const hh = PITCH.halfH
  const fn = FORMATION_POSITIONS[formationKey] || FORMATION_POSITIONS.default
  return fn(dir, hw, hh)
}
