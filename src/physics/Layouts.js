import Matter from 'matter-js'
import { PITCH, CAP_RADIUS, GK_RADIUS, BALL_RADIUS, getFormationPositions } from '../data/TeamData.js'
import { otherTeam, teamHomeDir } from '../game/rules.js'
import { radiusOf } from './WorldCore.js'
const { Body } = Matter

export const FREE_KICK_WALL_DISTANCE = 6
export const FREE_KICK_WALL_MIN = 3.6
export const FREE_KICK_TWO_CAP_WALL_WITHIN = 6.5
export const FK_TUNE = { wallFrac: 0.45, gkShade: -0.6, twoWithin: FREE_KICK_TWO_CAP_WALL_WITHIN }

export function createLayouts(bodies, getState, setState, { onBallPlaced = () => {}, onKickoff = () => {} } = {}) {
  const getTeamDir = team => teamHomeDir(team, getState().team1Side || 'left')
  const stopAll = () => { for (const body of Object.values(bodies)) { Body.setVelocity(body, { x: 0, y: 0 }); Body.setAngularVelocity(body, 0) } }
function placeBallAt(x, y) {
  onBallPlaced()
  const ball = bodies.ball
  if (ball) {
    Body.setPosition(ball, { x, y })
    Body.setVelocity(ball, { x: 0, y: 0 })
  }
}

/** Place a body at (x,y), clamped inside pitch */
function safePlace(id, x, y) {
  const b = bodies[id]
  if (!b) return
  const isGk = id.endsWith('_gk')
  const r = isGk ? GK_RADIUS : CAP_RADIUS
  const pos = clampInPitch(x, y, r)
  Body.setPosition(b, pos)
  Body.setVelocity(b, { x: 0, y: 0 })
}

/** Push apart any overlapping bodies after set piece placement (the ball stays put) */
function deOverlapBodies() {
  const ids = Object.keys(bodies)
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = bodies[ids[i]]
        const b = bodies[ids[j]]
        if (!a || !b) continue
        const rA = radiusOf(ids[i])
        const rB = radiusOf(ids[j])
        const minDist = rA + rB + 0.3
        const dx = b.position.x - a.position.x
        const dy = b.position.y - a.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDist && dist > 0.01) {
          const push = (minDist - dist) / 2 + 0.1
          const nx = dx / dist
          const ny = dy / dist
          // Don't move the ball during set piece setup
          // If one side is the ball, the cap takes the whole push
          const pa = ids[j] === 'ball' ? push * 2 : push
          const pb = ids[i] === 'ball' ? push * 2 : push
          if (ids[i] !== 'ball') Body.setPosition(a, clampInPitch(a.position.x - nx * pa, a.position.y - ny * pa, rA))
          if (ids[j] !== 'ball') Body.setPosition(b, clampInPitch(b.position.x + nx * pb, b.position.y + ny * pb, rB))
        }
      }
    }
  }
}

function clampInPitch(x, y, r = CAP_RADIUS) {
  const { halfW, halfH } = PITCH
  const m = r + 0.5
  return {
    x: Math.max(-halfW + m, Math.min(halfW - m, x)),
    y: Math.max(-halfH + m, Math.min(halfH - m, y)),
  }
}

/* ═══════════════════════════════════════════════════════════
   6. SET PIECE POSITIONING
   ═══════════════════════════════════════════════════════════ */

/**
 * SMART FREE KICK SETUP
 *
 * Rules:
 * - Kicker behind ball, facing opponent goal
 * - Wall: stands on the line from the ball to the goal it protects, square to
 *   that line, FREE_KICK_WALL_DISTANCE back from the ball (closer only when the
 *   goal itself is nearer than that, never under FREE_KICK_WALL_MIN)
 *   - Near the goal (within FREE_KICK_TWO_CAP_WALL_WITHIN of the line): 2 wall caps
 *   - Further out: 1 wall cap
 * - ALL other caps pushed to their own half, far from ball
 * - After placement: no cap but the kicker may stand closer to the ball than the wall
 */
// How far the defending wall stands back from a free kick (world units; the
// pitch is 30 long). Closer than this felt like the wall was on top of the ball.
// Never closer than this, even right by the goal
// A free kick this close to the defending goal line gets a two-cap wall
// Opponents stand this far off a corner kick / goal kick
const CORNER_CLEARANCE = 4.5
const GOAL_KICK_CLEARANCE = 6
// The kicker's own teammates just keep out of the kicker's way
const TEAMMATE_CLEARANCE = 4

const FREE_KICK_RUN_UP = 1.7
// Free-kick set-up: the wall stands this share of the way to goal and, like the
// keeper (shade < 0 = towards the near post), guards the near post — leaving the
// far corner for a well-struck kick (about a quarter of the goal from central spots)

function setupFreeKick(foulSpot, fouledTeam) {
  const { halfW, halfH } = PITCH
  const defTeam = fouledTeam === 'team1' ? 'team2' : 'team1'
  const atkHome = getTeamDir(fouledTeam)
  const defHome = getTeamDir(defTeam)

  stopAll()

  // Ball clamped inside safe area
  const bx = Math.max(-halfW + 3, Math.min(halfW - 3, foulSpot.x))
  const by = Math.max(-halfH + 3, Math.min(halfH - 3, foulSpot.y))
  placeBallAt(bx, by)

  // How much space is there between ball and the defending goal line?
  const spaceToGoal = Math.abs(defHome * halfW - bx)
  // Decide wall size: more space = more wall caps
  // Close to goal is when a wall matters: two caps there, one further out
  // (only four outfield caps a side, and the keeper never joins the wall)
  const wallCount = spaceToGoal < FK_TUNE.twoWithin ? 2 : 1

  // ── KICKER: on the line from ball to goal center, BEHIND the ball ──
  // Calculate angle from ball to the center of the goal being attacked
  const goalCenterX = defHome * halfW  // goal line x
  const goalCenterY = 0                // center of goal mouth
  const dxToGoal = goalCenterX - bx
  const dyToGoal = goalCenterY - by
  const distToGoal = Math.sqrt(dxToGoal * dxToGoal + dyToGoal * dyToGoal)
  // Normalized direction FROM ball TO goal
  const nxToGoal = distToGoal > 0.1 ? dxToGoal / distToGoal : Math.sign(dxToGoal)
  const nyToGoal = distToGoal > 0.1 ? dyToGoal / distToGoal : 0
  // Kicker placed BEHIND ball, a short run-up back on the angle line (close
  // enough that the aim is controllable, like lining up a real set piece)
  safePlace(`${fouledTeam}_atk1`, bx - nxToGoal * FREE_KICK_RUN_UP, by - nyToGoal * FREE_KICK_RUN_UP)

  // ── ALL other attacking caps: FAR on own half ──
  safePlace(`${fouledTeam}_atk2`, atkHome * halfW * 0.5, by > 0 ? -halfH * 0.35 : halfH * 0.35)
  safePlace(`${fouledTeam}_def1`, atkHome * halfW * 0.6, -halfH * 0.4)
  safePlace(`${fouledTeam}_def2`, atkHome * halfW * 0.6, halfH * 0.4)
  safePlace(`${fouledTeam}_mid`, atkHome * halfW * 0.3, 0)
  safePlace(`${fouledTeam}_gk`, atkHome * (halfW - 1.2), 0)
  // A free kick right outside your own box: the taker can end up on top of
  // your keeper, and the pitch edge stops them being pushed apart along x.
  // Slide the keeper along its line instead.
  const taker = bodies[`${fouledTeam}_atk1`]?.position
  const ownGk = bodies[`${fouledTeam}_gk`]?.position
  if (taker && ownGk && Math.hypot(taker.x - ownGk.x, taker.y - ownGk.y) < GK_RADIUS + CAP_RADIUS + 0.4) {
    const side = taker.y >= 0 ? -1 : 1
    safePlace(`${fouledTeam}_gk`, ownGk.x, taker.y + side * (GK_RADIUS + CAP_RADIUS + 0.6))
  }

  // ── WALL: on the ball→goal line, a proper distance back from the ball ──
  // Stand off the full distance when there's room; close to the goal, stop a
  // little in front of the keeper instead of on top of the goal line
  // Like a real wall it guards the NEAR post (the keeper leans that way too),
  // so a well-placed shot round the wall or into the far corner can go in
  const nearSide = Math.abs(by) > 1 ? Math.sign(by) : 1
  const postY = nearSide * PITCH.goalWidth * 0.3
  const wdx = goalCenterX - bx, wdy = postY - by
  const wlen = Math.hypot(wdx, wdy) || 1
  const wnx = wdx / wlen, wny = wdy / wlen
  // About halfway to goal, as a real wall stands: room to bend it over or round
  const wallDist = Math.max(FREE_KICK_WALL_MIN, Math.min(FREE_KICK_WALL_DISTANCE, distToGoal * FK_TUNE.wallFrac))
  const wallCx = bx + wnx * wallDist
  const wallCy = by + wny * wallDist
  // Wall caps line up square to the line of the kick, shoulder to shoulder
  const perpX = -wny
  const perpY = wnx


  const defFieldCaps = [`${defTeam}_def1`, `${defTeam}_def2`, `${defTeam}_mid`, `${defTeam}_atk1`, `${defTeam}_atk2`]
  const wallSpacing = 2.2

  // Place wall caps
  for (let i = 0; i < wallCount && i < defFieldCaps.length; i++) {
    const off = (i - (wallCount - 1) / 2) * wallSpacing
    safePlace(defFieldCaps[i], wallCx + perpX * off, wallCy + perpY * off)
  }

  // Remaining defending field caps: back behind the ball (towards halfway),
  // spread across the pitch — out of the shooting lane but ready for a rebound
  const backX = Math.max(-halfW + 2, Math.min(halfW - 2, bx - defHome * 5))
  for (let i = wallCount; i < defFieldCaps.length; i++) {
    const k = i - wallCount
    const spreadY = (k % 2 === 0 ? -1 : 1) * halfH * (0.3 + Math.floor(k / 2) * 0.35)
    safePlace(defFieldCaps[i], backX - defHome * Math.floor(k / 2) * 1.5, spreadY)
  }

  // Defending GK on goal line — slid along it if the ball sits right in front of him
  const gkX = defHome * (halfW - 1.2)
  const gkGap = GK_RADIUS + BALL_RADIUS + 0.3
  const gkDx = Math.abs(gkX - bx)
  const gkY = gkDx >= gkGap ? 0 : by + (by >= 0 ? -1 : 1) * Math.sqrt(gkGap * gkGap - gkDx * gkDx)
  safePlace(`${defTeam}_gk`, gkX, Math.abs(gkY) < 0.01 ? 0 : gkY)
  // Right back on his line when there's room (safePlace keeps him off the
  // wall), leaning to the near post: standing out would cover far too much
  const fkGk = bodies[`${defTeam}_gk`]
  if (fkGk && Math.abs(gkY) < 0.01) {
    // (a two-cap wall right by goal covers the near post, so he takes the far side)
    Body.setPosition(fkGk, { x: defHome * (halfW - GK_RADIUS - 0.05), y: wallCount === 2 ? -nearSide * 1.5 : -nearSide * FK_TUNE.gkShade })
    Body.setVelocity(fkGk, { x: 0, y: 0 })
  }

  // ── CLEAR ZONE: no opponent stands nearer the ball than the wall does ──
  // (a wall cap squeezed in by the touchline gets moved back out too). The
  // kicker's teammates only have to give the kicker some room, and keepers
  // stay on their goal line, as in real football.
  const kickerId = `${fouledTeam}_atk1`
  for (const [id, body] of Object.entries(bodies)) {
    if (id === 'ball' || id === kickerId || id.endsWith('_gk')) continue
    const radius = id.startsWith(defTeam) ? Math.max(wallDist - 0.5, FREE_KICK_WALL_MIN) : TEAMMATE_CLEARANCE
    const dx = body.position.x - bx
    const dy = body.position.y - by
    const dist = Math.hypot(dx, dy)
    if (dist >= radius) continue
    // Straight away from the ball first; if the edge of the pitch stops that,
    // try sideways and then back toward the cap's own goal
    const away = dist > 0.1 ? { x: dx / dist, y: dy / dist } : { x: getTeamDir(id.startsWith('team1') ? 'team1' : 'team2'), y: 0 }
    const home = { x: getTeamDir(id.startsWith('team1') ? 'team1' : 'team2'), y: 0 }
    const tries = [away, { x: -away.y, y: away.x }, { x: away.y, y: -away.x }, home, { x: -home.x, y: 0 }]
    const step = radius + 1
    let spot = null
    // …and never on top of a cap that's already been moved there
    const free = (p) => Object.entries(bodies).every(([other, ob]) => other === id || other === 'ball' ||
      Math.hypot(ob.position.x - p.x, ob.position.y - p.y) >= radiusOf(other) + CAP_RADIUS + 0.05)
    for (const extra of [0, 1.6, -1.6, 3.2, -3.2]) {
      for (const dir of tries) {
        const p = clampInPitch(bx + dir.x * step - dir.y * extra, by + dir.y * step + dir.x * extra, CAP_RADIUS)
        if (Math.hypot(p.x - bx, p.y - by) >= radius && free(p)) { spot = p; break }
      }
      if (spot) break
    }
    if (spot) safePlace(id, spot.x, spot.y)
  }

  deOverlapBodies()

  setState({ freeKickCapId: kickerId })
}

/** Push every cap in `ids` at least `radius` away from (bx, by), sliding along the walls if needed. */
function clearAround(bx, by, ids, radius) {
  for (const id of ids) {
    const body = bodies[id]
    if (!body) continue
    const dx = body.position.x - bx
    const dy = body.position.y - by
    const dist = Math.hypot(dx, dy)
    if (dist >= radius) continue
    const away = dist > 0.1 ? { x: dx / dist, y: dy / dist } : { x: -Math.sign(bx) || 1, y: 0 }
    const toCentre = { x: -Math.sign(bx) || 1, y: -Math.sign(by) || 1 }
    const len = Math.hypot(toCentre.x, toCentre.y)
    const tries = [away, { x: -away.y, y: away.x }, { x: away.y, y: -away.x }, { x: toCentre.x / len, y: toCentre.y / len }]
    for (const dir of tries) {
      const p = clampInPitch(bx + dir.x * (radius + 0.6), by + dir.y * (radius + 0.6), radiusOf(id))
      if (Math.hypot(p.x - bx, p.y - by) >= radius) { safePlace(id, p.x, p.y); break }
    }
  }
}

/**
 * CORNER KICK for `team`, from the corner at (ex, ey). The ball sits on the
 * end line a little up from the corner, the taker just behind it against the
 * side wall; opponents stand off, everyone else stays where they were.
 */
function setupCorner(team, ex, ey) {
  const { halfW, halfH } = PITCH
  stopAll()
  const bx = ex * (halfW - 1.3)
  const by = ey * (halfH - 2.8)
  placeBallAt(bx, by)
  const taker = `${team}_atk1`
  safePlace(taker, bx, ey * (halfH - 1.25))
  const others = Object.keys(bodies).filter((id) => id !== 'ball' && id !== taker && !id.endsWith('_gk'))
  clearAround(bx, by, others.filter((id) => !id.startsWith(`${team}_`)), CORNER_CLEARANCE)
  clearAround(bx, by, others.filter((id) => id.startsWith(`${team}_`)), TEAMMATE_CLEARANCE - 1)
  deOverlapBodies()
  setState({ freeKickCapId: taker })
}

/**
 * GOAL KICK for `team` (the defenders), after the ball got stuck in a corner
 * at their end. The keeper takes it from inside the six-yard area, on the
 * side the ball went out; attackers leave the penalty area.
 */
function setupGoalKick(team, ex, ey) {
  const { halfW } = PITCH
  stopAll()
  const bx = ex * (halfW - 3.2)
  const by = ey * 2
  placeBallAt(bx, by)
  const taker = `${team}_gk`
  safePlace(taker, ex * (halfW - 1.5), by)
  const opponents = Object.keys(bodies).filter((id) => id.startsWith(otherTeam(team)) && !id.endsWith('_gk'))
  clearAround(bx, by, opponents, GOAL_KICK_CLEARANCE)
  const mates = Object.keys(bodies).filter((id) => id.startsWith(`${team}_`) && id !== taker)
  clearAround(bx, by, mates, TEAMMATE_CLEARANCE - 1)
  deOverlapBodies()
  setState({ freeKickCapId: taker })
}

/** Team that touched the ball last (null after a kick-off until someone does). */

const PENALTY_RUN_UP = 1.5

// How fast a keeper throws himself sideways on a penalty: about the width of
// half the goal before he stops
const KEEPER_DIVE_SPEED = 1.8

/** Throw a keeper across his line: dive -1 / 1 (pitch y), 0 stays put. */
// A diving keeper stops at the post, covering his corner, instead of sliding on past it
let diveStop = null // { id, maxAbsY } for the current penalty

/** The penalty's over: the keeper may use his whole box again. */
function clearKeeperDive() { diveStop = null }

function diveKeeper(keeperTeam, dive) {
  const gk = bodies[`${keeperTeam}_gk`]
  if (!gk || !dive) return
  diveStop = { id: `${keeperTeam}_gk`, maxAbsY: PITCH.goalWidth / 2 - 0.35 }
  Body.setVelocity(gk, { x: 0, y: dive * KEEPER_DIVE_SPEED })
}

function setupPenalty(fouledTeam, { shootout = !!getState().penaltyShootout } = {}) {
  diveStop = null
  const { halfW } = PITCH
  const defTeam = otherTeam(fouledTeam)
  const atkGkDir = getTeamDir(fouledTeam)
  const defGkDir = getTeamDir(defTeam)

  stopAll()

  // Ball on the penalty spot, the keeper right back on his line and the
  // kicker a short run-up behind: enough room to pick a corner past the keeper
  const penX = defGkDir * (halfW - PITCH.penSpotDist)
  placeBallAt(penX, 0)

  // Kicker behind ball (toward center)
  safePlace(`${fouledTeam}_atk1`, penX + atkGkDir * PENALTY_RUN_UP, 0)

  // Both keepers on their own goal lines (they're confined to their boxes anyway)
  // The keeper stands in the middle of his line; he dives (or not) as the ball is struck
  // (right on the line: safePlace keeps a margin off the walls, which would push him out)
  const keeper = bodies[`${defTeam}_gk`]
  if (keeper) {
    Body.setPosition(keeper, { x: defGkDir * (halfW - GK_RADIUS - 0.02), y: 0 })
    Body.setVelocity(keeper, { x: 0, y: 0 })
  }
  if (shootout) safePlace(`${fouledTeam}_gk`, atkGkDir * (halfW - 1.2), 0)

  // Remaining outfield caps; a halfway lineup is only for shootouts.
  const others = [
    `${fouledTeam}_atk2`, `${fouledTeam}_mid`, `${fouledTeam}_def1`, `${fouledTeam}_def2`,
    `${defTeam}_def1`, `${defTeam}_def2`, `${defTeam}_mid`, `${defTeam}_atk1`, `${defTeam}_atk2`,
  ]
  if (shootout) {
    const spacing = 2.2
    const startY = -((others.length - 1) * spacing) / 2
    others.forEach((id, i) => safePlace(id, 0, startY + i * spacing))
  } else {
    // A match penalty preserves the formation wherever it is already legal.
    // Move encroaching caps behind the spot, outside the box and clear of the kicker.
    const legal = p => p.x * defGkDir <= halfW - PITCH.penAreaW - CAP_RADIUS - 0.2
      && Math.hypot(p.x - penX, p.y) >= 4
    const moving = others.filter(id => bodies[id] && !legal(bodies[id].position))
    const occupied = Object.entries(bodies)
      .filter(([id]) => id !== 'ball' && !moving.includes(id))
      .map(([, body]) => body.position)
    const slots = [4.5, 1.8, -0.9, -3.6, -6.3].flatMap(x =>
      [-6.4, -3.2, 0, 3.2, 6.4].map(y => ({ x: x * defGkDir, y })))
    for (const id of moving) {
      const origin = bodies[id].position
      const candidates = slots.filter(p => legal(p) && occupied.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= 2))
      candidates.sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y))
      const target = candidates[0]
      if (target) { safePlace(id, target.x, target.y); occupied.push(target) }
    }
  }

  deOverlapBodies()

  // Only the kicker can take the penalty
  setState({ freeKickCapId: `${fouledTeam}_atk1` })
}

/* ═══════════════════════════════════════════════════════════
   7. KICKOFF POSITIONING
   ═══════════════════════════════════════════════════════════ */

/**
 * Kick-off layout: every cap starts in its team's chosen formation, then the
 * laws are enforced — everyone in their own half, the defending team outside
 * the centre circle, and the kicker next to the ball.
 */
function resetToKickoff(kickingTeam) {
  diveStop = null
  const { formations, team1Side } = getState()
  stopAll()
  onKickoff()
  placeBallAt(0, 0)

  for (const team of ['team1', 'team2']) {
    const home = getTeamDir(team)
    const pos = getFormationPositions(team, formations?.[team] || 'default', team1Side || 'left')
    for (const role of Object.keys(pos)) {
      const id = `${team}_${role}`
      const r = radiusOf(id)
      let { x, y } = pos[role]
      // Own half only
      if (Math.sign(x) !== home || Math.abs(x) < r + 0.2) x = home * (r + 0.2)
      // Defending team stays out of the centre circle
      if (team !== kickingTeam) {
        const d = Math.hypot(x, y)
        const minD = PITCH.centerCircleR + r + 0.2
        if (d < minD) {
          const nx = d > 0.01 ? x / d : home
          const ny = d > 0.01 ? y / d : 0
          x = nx * minD
          y = ny * minD
          if (Math.sign(x) !== home) x = home * Math.abs(x)
        }
      }
      safePlace(id, x, y)
    }
  }

  // Kicker right next to the ball, slightly offset so it's visible
  const home = getTeamDir(kickingTeam)
  safePlace(`${kickingTeam}_atk1`, home * 0.9, -0.9)
  deOverlapBodies()
}


return { placeBallAt, deOverlapBodies, setupFreeKick, setupCorner, setupGoalKick, clearKeeperDive, diveKeeper, setupPenalty, resetToKickoff, getDiveStop: () => diveStop }
}
