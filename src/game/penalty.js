/**
 * Penalty kicks: where the struck ball is heading, and which way a computer
 * keeper throws himself. Pure functions so they're easy to test.
 */

// How often the computer keeper reads the shot right, by level
export const CPU_READ = { easy: 0.35, medium: 0.5, hard: 0.65 }
// Shots this close to the middle are "down the middle": staying put saves them
export const MIDDLE = 0.9

/** The y where a ball at (x, y) moving (vx, vy) crosses the goal line x = goalX, or null if it's going away. */
export function crossingY(x, y, vx, vy, goalX) {
  const dx = goalX - x
  if (Math.abs(vx) < 1e-6 || Math.sign(vx) !== Math.sign(dx)) return null
  return y + vy * (dx / vx)
}

/** Which way the shot is going: -1, 0 (middle) or 1 in pitch y, or 0 if unknown. */
export function shotSide(yAtLine) {
  if (yAtLine == null || Math.abs(yAtLine) < MIDDLE) return 0
  return Math.sign(yAtLine)
}

/** The computer keeper's dive: the right side with CPU_READ chance, otherwise one of the others. */
export function cpuDive(yAtLine, difficulty = 'medium', rng = Math.random) {
  const right = shotSide(yAtLine)
  if (rng() < (CPU_READ[difficulty] ?? CPU_READ.medium)) return right
  const others = [-1, 0, 1].filter((d) => d !== right)
  return others[Math.floor(rng() * others.length) % others.length]
}

/**
 * Where the ball will go when a cap at `cap` moving with `v` strikes a ball at
 * `ball` (centres touch at distance rSum): the unit line of centres at the
 * moment of contact, or null if the cap misses. What a keeper "reads" from the
 * kicker's run-up and body shape.
 */
export function strikeDirection(cap, v, ball, rSum) {
  const speed = Math.hypot(v.x, v.y)
  if (speed < 1e-6) return null
  const ux = v.x / speed, uy = v.y / speed
  const fx = ball.x - cap.x, fy = ball.y - cap.y
  const along = fx * ux + fy * uy
  if (along <= 0) return null
  const miss2 = fx * fx + fy * fy - along * along
  if (miss2 > rSum * rSum) return null
  const t = along - Math.sqrt(rSum * rSum - miss2)
  const nx = ball.x - (cap.x + ux * t), ny = ball.y - (cap.y + uy * t)
  const n = Math.hypot(nx, ny) || 1
  return { x: nx / n, y: ny / n }
}

// How a computer penalty-taker picks a spot and how cleanly it strikes it, by level
export const CPU_TAKER = {
  easy: { corner: 0.45, noiseDeg: 5 },
  medium: { corner: 0.65, noiseDeg: 2.5 },
  hard: { corner: 0.85, noiseDeg: 1 },
}

/**
 * A computer penalty: pick a target on the goal line (a corner, or down the
 * middle), work out where the cap must meet the ball to send it there, and
 * flick through that point. Returns the flick velocity.
 */
export function penaltyFlick({ cap, ball, rSum, goalX, goalWidth, level = 'medium', maxSpeed, rng = Math.random }) {
  const t = CPU_TAKER[level] || CPU_TAKER.medium
  const corner = rng() < t.corner
  const targetY = corner ? (rng() < 0.5 ? -1 : 1) * (goalWidth / 2 - 0.75) : 0
  let a = Math.atan2(targetY - ball.y, goalX - ball.x)
  a += ((rng() * 2 - 1) * t.noiseDeg * Math.PI) / 180
  // The cap's centre at the moment of contact sits behind the ball, on the line of the shot
  const cx = ball.x - Math.cos(a) * rSum
  const cy = ball.y - Math.sin(a) * rSum
  const dx = cx - cap.x, dy = cy - cap.y
  const d = Math.hypot(dx, dy) || 1
  const speed = maxSpeed * (0.85 + rng() * 0.15)
  return { x: (dx / d) * speed, y: (dy / d) * speed, targetY }
}
