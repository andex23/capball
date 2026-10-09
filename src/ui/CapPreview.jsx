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
    case 'wave':
      // A swoosh across the middle, like a soda cap's wave
      return (
        <path
          d={`M ${cx - innerR} ${cy + innerR * 0.15} C ${cx - innerR * 0.4} ${cy - innerR * 0.55}, ${cx + innerR * 0.2} ${cy + innerR * 0.55}, ${cx + innerR} ${cy - innerR * 0.2} L ${cx + innerR} ${cy + innerR} L ${cx - innerR} ${cy + innerR} Z`}
          fill={`${edgeColor}cc`}
        />
      )
    case 'rays': {
      const n = 12
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const a0 = (i / n) * Math.PI * 2
            const a1 = a0 + Math.PI / n
            return (
              <path key={i} d={`M ${cx} ${cy} L ${cx + Math.cos(a0) * innerR * 1.2} ${cy + Math.sin(a0) * innerR * 1.2} L ${cx + Math.cos(a1) * innerR * 1.2} ${cy + Math.sin(a1) * innerR * 1.2} Z`} fill={color} />
            )
          })}
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
function isLight(hex) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || '')
  if (!m) return false
  const n = parseInt(m[1], 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.55
}

export default function CapPreview({ config, size = 120, number = null }) {
  const { primary, edge, badge, pattern, finish } = config
  const capText = typeof config.capText === 'string' ? config.capText.trim() : ''
  const cx = size / 2
  const cy = size / 2
  const uid = `${primary}-${edge}-${pattern}-${finish}-${capText}`.replace(/[^a-z0-9-]/gi, '')

  // A crown cap from above: crimped skirt round the outside, printed top inside
  const outerR = cx - 3
  const topR = outerR * 0.8
  const ringR = topR * 0.84
  const PLEATS = 21

  const isChrome = finish === 'chrome'
  const isGloss = finish === 'gloss'
  const specAlpha = isChrome ? 0.5 : isGloss ? 0.35 : finish === 'satin' ? 0.2 : 0.12

  // Scalloped outline of the crimp
  const crimp = []
  const steps = PLEATS * 6
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const r = outerR * (0.93 + 0.07 * Math.pow(Math.abs(Math.cos((a * PLEATS) / 2)), 0.6))
    crimp.push(`${i ? 'L' : 'M'} ${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`)
  }
  const printColor = edge === primary ? '#ffffff' : edge
  const withText = capText.length > 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}>
      <defs>
        <radialGradient id={`skirt-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="78%" stopColor={darkenHex(primary, 0.05)} />
          <stop offset="92%" stopColor={darkenHex(primary, 0.35)} />
          <stop offset="100%" stopColor="#c9ccd3" />
        </radialGradient>
        <radialGradient id={`top-${uid}`} cx="40%" cy="36%" r="64%">
          <stop offset="0%" stopColor={lightenHex(primary, isChrome ? 0.3 : 0.14)} />
          <stop offset="60%" stopColor={primary} />
          <stop offset="100%" stopColor={darkenHex(primary, 0.2)} />
        </radialGradient>
        <clipPath id={`topClip-${uid}`}>
          <circle cx={cx} cy={cy} r={topR} />
        </clipPath>
        <clipPath id={`split-${uid}`}>
          <rect x={cx} y={0} width={cx + 2} height={size} />
        </clipPath>
        {/* Path the custom text follows: the upper arc inside the printed ring */}
        <path id={`arc-${uid}`} d={`M ${cx - ringR * 0.8} ${cy} A ${ringR * 0.8} ${ringR * 0.8} 0 0 1 ${cx + ringR * 0.8} ${cy}`} />
      </defs>

      {/* Crimped skirt with its 21 pleats */}
      <path d={crimp.join(' ') + ' Z'} fill={`url(#skirt-${uid})`} stroke={darkenHex(primary, 0.45)} strokeWidth={size * 0.006} />
      {Array.from({ length: PLEATS }, (_, i) => {
        const a = ((i + 0.5) / PLEATS) * Math.PI * 2
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * topR * 1.02} y1={cy + Math.sin(a) * topR * 1.02}
            x2={cx + Math.cos(a) * outerR * 0.95} y2={cy + Math.sin(a) * outerR * 0.95}
            stroke="rgba(0,0,0,0.35)" strokeWidth={size * 0.008} strokeLinecap="round"
          />
        )
      })}

      {/* Printed top */}
      <circle cx={cx} cy={cy} r={topR} fill={`url(#top-${uid})`} />
      <g clipPath={`url(#topClip-${uid})`}>
        {pattern === 'split' && <circle cx={cx} cy={cy} r={topR} fill={`${edge}40`} clipPath={`url(#split-${uid})`} />}
        <PatternOverlay pattern={pattern} cx={cx} cy={cy} innerR={topR} edgeColor={edge} />
      </g>
      <circle cx={cx} cy={cy} r={topR} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={size * 0.01} />
      <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={printColor} strokeOpacity="0.8" strokeWidth={size * 0.012} />

      {/* The team's own text, arched over the top */}
      {withText && (
        <text fill={printColor} fontSize={topR * 0.3} fontWeight="900" fontStyle="italic" fontFamily="'Barlow Condensed', 'Impact', sans-serif" letterSpacing="0.04em">
          <textPath href={`#arc-${uid}`} startOffset="50%" textAnchor="middle">{capText.toUpperCase()}</textPath>
        </text>
      )}

      {/* Badge */}
      {badge && badge !== 'none' && (
        <BadgeIcon
          badge={badge}
          cx={cx}
          cy={number != null ? cy - topR * 0.12 + (withText ? topR * 0.1 : 0) : cy + (withText ? topR * 0.12 : 0)}
          size={topR * (number != null ? 0.36 : 0.5)}
          color={printColor}
        />
      )}

      {/* Squad number */}
      {number != null && (
        <text
          x={cx}
          y={badge && badge !== 'none' ? cy + topR * 0.38 : cy + topR * (withText ? 0.2 : 0.06)}
          textAnchor="middle"
          dominantBaseline="central"
          fill={isLight(primary) ? '#111111' : '#ffffff'}
          stroke={isLight(primary) ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)'}
          strokeWidth={topR * 0.05}
          paintOrder="stroke"
          fontSize={topR * (badge && badge !== 'none' ? 0.42 : withText ? 0.55 : 0.7)}
          fontWeight="900"
          fontFamily="'Barlow Condensed', 'Impact', sans-serif"
        >
          {number}
        </text>
      )}

      {/* Light on the printed tin */}
      <ellipse
        cx={cx - topR * 0.3} cy={cy - topR * 0.4}
        rx={topR * 0.45} ry={topR * 0.16}
        fill={`rgba(255,255,255,${specAlpha * 0.5})`}
        transform={`rotate(-28 ${cx - topR * 0.3} ${cy - topR * 0.4})`}
      />
    </svg>
  )
}

/* ========================================
   SECTION LABEL
   ======================================== */
