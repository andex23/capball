import { darkenHex, lightenHex } from './color'

/* ========================================
   BADGE SVG PATHS
   ======================================== */
function BadgeIcon({ badge, cx, cy, size, color }) {
  const s = size
  const half = s / 2
  switch (badge) {
    case 'star':
      return <polygon points={starPoints(cx, cy, half, half * 0.4, 5)} fill={color} />
    case 'shield':
      return <path d={`M${cx} ${cy - half} L${cx + half * 0.8} ${cy - half * 0.3} L${cx + half * 0.6} ${cy + half * 0.6} L${cx} ${cy + half} L${cx - half * 0.6} ${cy + half * 0.6} L${cx - half * 0.8} ${cy - half * 0.3} Z`} fill={color} />
    case 'bolt':
      return <polygon points={`${cx - s * 0.15},${cy - half} ${cx + s * 0.2},${cy - s * 0.05} ${cx - s * 0.05},${cy + s * 0.05} ${cx + s * 0.15},${cy + half} ${cx - s * 0.2},${cy + s * 0.05} ${cx + s * 0.05},${cy - s * 0.05}`} fill={color} />
    case 'crown':
      return <polygon points={`${cx - half},${cy + half * 0.4} ${cx - half * 0.6},${cy - half * 0.1} ${cx - half * 0.3},${cy + half * 0.15} ${cx},${cy - half} ${cx + half * 0.3},${cy + half * 0.15} ${cx + half * 0.6},${cy - half * 0.1} ${cx + half},${cy + half * 0.4}`} fill={color} />
    case 'diamond':
      return <polygon points={`${cx},${cy - half} ${cx + half * 0.7},${cy} ${cx},${cy + half} ${cx - half * 0.7},${cy}`} fill={color} />
    case 'skull': {
      const r = half * 0.55
      return (
        <g>
          <circle cx={cx} cy={cy - half * 0.15} r={r} fill={color} />
          <rect x={cx - half * 0.25} y={cy + half * 0.15} width={half * 0.5} height={half * 0.45} rx={2} fill={color} />
        </g>
      )
    }
    case 'flame':
      return <path d={`M${cx} ${cy + half} Q${cx - half * 0.9} ${cy + half * 0.1} ${cx - half * 0.4} ${cy - half * 0.3} Q${cx - half * 0.2} ${cy + half * 0.1} ${cx} ${cy - half} Q${cx + half * 0.2} ${cy + half * 0.1} ${cx + half * 0.4} ${cy - half * 0.3} Q${cx + half * 0.9} ${cy + half * 0.1} ${cx} ${cy + half} Z`} fill={color} />
    default:
      return null
  }
}

function starPoints(cx, cy, outerR, innerR, points) {
  const pts = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI / points) * i - Math.PI / 2
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

/* ========================================
   PATTERN OVERLAYS
   ======================================== */
function PatternOverlay({ pattern, cx, cy, innerR, edgeColor }) {
  const color = `${edgeColor}55`
  const boldColor = `${edgeColor}88`
  switch (pattern) {
    case 'stripe':
      return (
        <g>
          <rect x={cx - innerR * 0.12} y={cy - innerR} width={innerR * 0.24} height={innerR * 2} fill={boldColor} />
        </g>
      )
    case 'split':
      return (
        <clipPath id="split-clip">
          <rect x={cx} y={cy - innerR} width={innerR} height={innerR * 2} />
        </clipPath>
      )
    case 'ring':
      return <circle cx={cx} cy={cy} r={innerR * 0.55} fill="none" stroke={boldColor} strokeWidth={innerR * 0.1} />
    case 'cross':
      return (
        <g>
          <rect x={cx - innerR * 0.08} y={cy - innerR * 0.7} width={innerR * 0.16} height={innerR * 1.4} fill={color} />
          <rect x={cx - innerR * 0.7} y={cy - innerR * 0.08} width={innerR * 1.4} height={innerR * 0.16} fill={color} />
        </g>
      )
    case 'dots': {
      const dotR = innerR * 0.08
      const positions = [
        [0, -0.45], [0.32, -0.32], [0.45, 0], [0.32, 0.32],
        [0, 0.45], [-0.32, 0.32], [-0.45, 0], [-0.32, -0.32],
      ]
      return (
        <g>
          {positions.map(([dx, dy], i) => (
            <circle key={i} cx={cx + innerR * dx} cy={cy + innerR * dy} r={dotR} fill={boldColor} />
          ))}
        </g>
      )
    }
    default:
      return null
  }
}

/* ========================================
   PREMIUM CAP PREVIEW — SVG
   Real tabletop game piece with structural anatomy:
   1. Outer rim (beveled metallic band)
   2. Body wall (visible side thickness)
   3. Recessed channel ring
   4. Main body surface
   5. Raised center badge plate
   6. Badge / number / pattern layers
   7. Finish-dependent lighting
   ======================================== */
export default function CapPreview({ config, size = 120 }) {
  const { primary, edge, badge, pattern, finish } = config
  // Numbers disabled — caps show badge only
  const number = null
  const cx = size / 2
  const cy = size / 2
  const uid = `${primary}-${edge}-${pattern}-${finish}`.replace(/#/g, '')

  // --- Cap anatomy radii ---
  const outerR = cx - 3                // full outer edge
  const rimInner = outerR * 0.88       // inside of rim band
  const bodyR = outerR * 0.85          // main body surface
  const channelOuter = bodyR * 0.72    // recessed channel outer
  const channelInner = bodyR * 0.62    // recessed channel inner
  const plateR = bodyR * 0.56          // raised center badge plate
  const domeR = plateR * 0.82         // dome highlight on plate

  // --- Finish properties ---
  const isSatin = finish === 'satin'
  const isGloss = finish === 'gloss'
  const isChrome = finish === 'chrome'
  const specAlpha = isChrome ? 0.45 : isGloss ? 0.3 : isSatin ? 0.15 : 0.07
  const rimSpecAlpha = isChrome ? 0.5 : isGloss ? 0.35 : 0.2
  const bodyLighten = isChrome ? 0.25 : isGloss ? 0.15 : isSatin ? 0.08 : 0.04
  const bodyDarken = isChrome ? 0.35 : isGloss ? 0.22 : isSatin ? 0.15 : 0.12

  // --- Badge color ---
  const badgeColor = edge === primary ? 'rgba(255,255,255,0.75)' : `${edge}dd`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: 'drop-shadow(0 5px 14px rgba(0,0,0,0.55))' }}>
      <defs>
        {/* Outer rim bevel — metallic band */}
        <radialGradient id={`rim-${uid}`} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor={lightenHex(edge, 0.45)} />
          <stop offset="35%" stopColor={lightenHex(edge, 0.15)} />
          <stop offset="65%" stopColor={edge} />
          <stop offset="100%" stopColor={darkenHex(edge, 0.45)} />
        </radialGradient>
        {/* Body surface — matte/satin shading */}
        <radialGradient id={`body-${uid}`} cx="40%" cy="36%" r="62%">
          <stop offset="0%" stopColor={lightenHex(primary, bodyLighten)} />
          <stop offset="55%" stopColor={primary} />
          <stop offset="100%" stopColor={darkenHex(primary, bodyDarken)} />
        </radialGradient>
        {/* Center plate — slightly lighter raised area */}
        <radialGradient id={`plate-${uid}`} cx="42%" cy="38%" r="55%">
          <stop offset="0%" stopColor={lightenHex(primary, bodyLighten + 0.06)} />
          <stop offset="50%" stopColor={lightenHex(primary, 0.02)} />
          <stop offset="100%" stopColor={darkenHex(primary, bodyDarken * 0.6)} />
        </radialGradient>
        {/* Dome highlight on center plate */}
        <radialGradient id={`dome-${uid}`} cx="44%" cy="38%" r="48%">
          <stop offset="0%" stopColor={`rgba(255,255,255,${specAlpha * 1.2})`} />
          <stop offset="60%" stopColor={`rgba(255,255,255,${specAlpha * 0.3})`} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* Recessed channel shadow */}
        <radialGradient id={`channel-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={darkenHex(primary, 0.3)} />
          <stop offset="100%" stopColor={darkenHex(primary, 0.45)} />
        </radialGradient>
        {/* Side wall depth gradient (ellipse at bottom) */}
        <linearGradient id={`wall-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={darkenHex(primary, 0.15)} />
          <stop offset="100%" stopColor={darkenHex(primary, 0.4)} />
        </linearGradient>
        {/* Split clip */}
        <clipPath id={`split-${uid}`}>
          <rect x={cx} y={0} width={cx + 2} height={size} />
        </clipPath>
        {/* Body clip for patterns */}
        <clipPath id={`bodyClip-${uid}`}>
          <circle cx={cx} cy={cy} r={bodyR} />
        </clipPath>
      </defs>

      {/* === LAYER 1: Ground shadow — perspective ellipse === */}
      <ellipse cx={cx} cy={cy + size * 0.06} rx={outerR * 0.9} ry={outerR * 0.2} fill="rgba(0,0,0,0.3)" />

      {/* === LAYER 2: Side wall — visible thickness === */}
      <ellipse cx={cx} cy={cy + size * 0.025} rx={outerR} ry={outerR * 0.97} fill={`url(#wall-${uid})`} />

      {/* === LAYER 3: Outer rim — beveled metallic band === */}
      <circle cx={cx} cy={cy} r={outerR} fill={`url(#rim-${uid})`} />
      {/* Rim highlight arc */}
      <path
        d={`M ${cx - outerR * 0.7} ${cy - outerR * 0.65} A ${outerR} ${outerR} 0 0 1 ${cx + outerR * 0.7} ${cy - outerR * 0.65}`}
        fill="none"
        stroke={`rgba(255,255,255,${rimSpecAlpha})`}
        strokeWidth={outerR * 0.04}
        strokeLinecap="round"
      />
      {/* Rim inner shadow edge */}
      <circle cx={cx} cy={cy} r={rimInner} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />

      {/* === LAYER 4: Main body surface === */}
      <circle cx={cx} cy={cy} r={bodyR} fill={`url(#body-${uid})`} />

      {/* === LAYER 5: Pattern overlay (clipped to body) === */}
      <g clipPath={`url(#bodyClip-${uid})`}>
        {pattern === 'split' && (
          <circle cx={cx} cy={cy} r={bodyR} fill={`${edge}35`} clipPath={`url(#split-${uid})`} />
        )}
        <PatternOverlay pattern={pattern} cx={cx} cy={cy} innerR={bodyR} edgeColor={edge} />
      </g>

      {/* Body edge definition — subtle dark ring */}
      <circle cx={cx} cy={cy} r={bodyR} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />

      {/* === LAYER 6: Recessed channel ring === */}
      {/* Dark recessed groove between body and center plate */}
      <circle cx={cx} cy={cy} r={channelOuter} fill="none" stroke={`url(#channel-${uid})`} strokeWidth={channelOuter - channelInner} />
      {/* Inner shadow of channel */}
      <circle cx={cx} cy={cy} r={channelInner + 0.5} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
      {/* Outer highlight of channel (light catch) */}
      <path
        d={`M ${cx - channelOuter * 0.6} ${cy - channelOuter * 0.75} A ${channelOuter} ${channelOuter} 0 0 1 ${cx + channelOuter * 0.6} ${cy - channelOuter * 0.75}`}
        fill="none"
        stroke={`rgba(255,255,255,${specAlpha * 0.5})`}
        strokeWidth="0.6"
        strokeLinecap="round"
      />

      {/* === LAYER 7: Raised center badge plate === */}
      <circle cx={cx} cy={cy} r={plateR} fill={`url(#plate-${uid})`} />
      {/* Plate raised edge — light on top, shadow on bottom */}
      <path
        d={`M ${cx - plateR * 0.85} ${cy - plateR * 0.5} A ${plateR} ${plateR} 0 0 1 ${cx + plateR * 0.85} ${cy - plateR * 0.5}`}
        fill="none"
        stroke={`rgba(255,255,255,${specAlpha * 0.8})`}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + plateR * 0.85} ${cy + plateR * 0.5} A ${plateR} ${plateR} 0 0 1 ${cx - plateR * 0.85} ${cy + plateR * 0.5}`}
        fill="none"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* === LAYER 8: Dome highlight on plate === */}
      <circle cx={cx} cy={cy} r={domeR} fill={`url(#dome-${uid})`} />

      {/* === LAYER 9: Badge emblem === */}
      {badge && badge !== 'none' && (
        <BadgeIcon badge={badge} cx={cx} cy={number != null ? cy - plateR * 0.15 : cy} size={plateR * 0.7} color={badgeColor} />
      )}

      {/* === LAYER 10: Number === */}
      {number != null && (
        <text
          x={cx}
          y={badge && badge !== 'none' ? cy + plateR * 0.52 : cy + plateR * 0.12}
          textAnchor="middle"
          dominantBaseline="central"
          fill={badgeColor}
          fontSize={plateR * 0.55}
          fontWeight="900"
          fontFamily="'Bungee', 'Impact', sans-serif"
        >
          {number}
        </text>
      )}

      {/* === LAYER 11: Specular highlight — finish-dependent === */}
      <ellipse
        cx={cx * 0.78}
        cy={cy * 0.72}
        rx={outerR * (isChrome ? 0.18 : isGloss ? 0.14 : 0.09)}
        ry={outerR * (isChrome ? 0.1 : isGloss ? 0.07 : 0.04)}
        fill={`rgba(255,255,255,${specAlpha * 0.7})`}
        transform={`rotate(-30 ${cx * 0.78} ${cy * 0.72})`}
      />

      {/* Chrome: extra ring glints */}
      {isChrome && (
        <g>
          <circle cx={cx} cy={cy} r={bodyR * 0.95} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <circle cx={cx} cy={cy} r={plateR + 1} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        </g>
      )}

      {/* Gloss: broader sheen */}
      {isGloss && (
        <ellipse
          cx={cx * 0.85}
          cy={cy * 0.6}
          rx={outerR * 0.3}
          ry={outerR * 0.08}
          fill="rgba(255,255,255,0.06)"
          transform={`rotate(-20 ${cx * 0.85} ${cy * 0.6})`}
        />
      )}
    </svg>
  )
}

/* ========================================
   SECTION LABEL
   ======================================== */
