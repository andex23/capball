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
  const uid = `${primary}-${edge}-${pattern}-${finish}-${capText}-${size}`.replace(/[^a-z0-9-]/gi, '')

  // A crown cap seen from a little above, like one sitting on the table:
  // the printed top tilted into an ellipse, the fluted skirt showing below
  // it with its teeth at the bottom.
  const cx = size / 2
  const R = size * 0.44            // radius of the top
  const K = 0.62                   // tilt: how round the top looks
  const tc = size * 0.4            // centre of the top
  const H = size * 0.15            // skirt height
  const R2 = R * 1.09              // the skirt flares a little
  const TOOTH = size * 0.04
  const PLEATS = 21
  const topR = R * 0.97
  const ringR = topR * 0.8

  const isChrome = finish === 'chrome'
  const isMatte = finish === 'matte'
  const specAlpha = isChrome ? 0.55 : finish === 'gloss' ? 0.4 : finish === 'satin' ? 0.22 : 0.1
  const printColor = edge === primary ? '#ffffff' : edge
  const withText = capText.length > 0
  const hasBadge = badge && badge !== 'none'

  // Fluted skirt: each pleat is two folds, one catching the light, one in shade.
  // Only the front half (towards the viewer) shows.
  const top = (a, r = R) => [cx + Math.cos(a) * r, tc + Math.sin(a) * r * K]
  const bot = (a, drop = 0) => [cx + Math.cos(a) * R2, tc + H + Math.sin(a) * R2 * K + drop]
  const folds = []
  const step = (Math.PI * 2) / PLEATS
  for (let i = -1; i <= PLEATS; i++) {
    const a0 = i * step + step * 0.25
    for (const half of [0, 1]) {
      let s0 = a0 + half * step / 2
      let s1 = s0 + step / 2
      if (s1 <= 0 || s0 >= Math.PI) continue
      s0 = Math.max(0, s0); s1 = Math.min(Math.PI, s1)
      const tipAt = half === 0 ? s1 : s0 // the tooth points down where the two folds meet
      const p = [top(s0), top(s1), bot(s1, s1 === tipAt ? TOOTH : 0), bot(s0, s0 === tipAt ? TOOTH : 0)]
      const facing = Math.cos((s0 + s1) / 2 + 0.5) // light from the front left
      const lit = half === 0
      const amt = (lit ? 0.1 : 0.32) + (1 - facing) * 0.18
      folds.push({ d: `M${p.map((q) => q.map((v) => v.toFixed(2)).join(' ')).join(' L')} Z`, fill: darkenHex(primary, Math.min(0.7, amt)), shine: lit && facing > 0.2 })
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <radialGradient id={`top-${uid}`} cx="42%" cy="34%" r="70%">
          <stop offset="0%" stopColor={lightenHex(primary, isChrome ? 0.32 : isMatte ? 0.04 : 0.16)} />
          <stop offset="65%" stopColor={primary} />
          <stop offset="100%" stopColor={darkenHex(primary, 0.22)} />
        </radialGradient>
        <linearGradient id={`skirtShine-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={isMatte ? 0.08 : 0.28} />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`topClip-${uid}`}>
          <circle cx={cx} cy={tc} r={topR} />
        </clipPath>
        <clipPath id={`split-${uid}`}>
          <rect x={cx} y={0} width={cx + 2} height={size} />
        </clipPath>
        <path id={`arc-${uid}`} d={`M ${cx - ringR * 0.62} ${tc} A ${ringR * 0.62} ${ringR * 0.62} 0 0 1 ${cx + ringR * 0.62} ${tc}`} />
      </defs>

      {/* Shadow on the table */}
      <ellipse cx={cx + size * 0.02} cy={tc + H + TOOTH + size * 0.02} rx={R2 * 1.02} ry={R2 * K * 0.95} fill="rgba(0,0,0,0.38)" />

      {/* Fluted skirt */}
      {folds.map((f, i) => (
        <path key={i} d={f.d} fill={f.fill} stroke={darkenHex(primary, 0.55)} strokeWidth={size * 0.004} strokeLinejoin="round" />
      ))}
      {folds.filter((f) => f.shine).map((f, i) => <path key={`s${i}`} d={f.d} fill={`url(#skirtShine-${uid})`} />)}

      {/* Rolled edge round the top */}
      <ellipse cx={cx} cy={tc} rx={R} ry={R * K} fill={darkenHex(primary, 0.3)} />
      <ellipse cx={cx} cy={tc} rx={R} ry={R * K} fill="none" stroke={lightenHex(primary, 0.35)} strokeOpacity={isMatte ? 0.3 : 0.7} strokeWidth={size * 0.012} />

      {/* Printed top, drawn flat then tilted */}
      <g transform={`matrix(1 0 0 ${K} 0 ${(tc * (1 - K)).toFixed(3)})`}>
        <circle cx={cx} cy={tc} r={topR} fill={`url(#top-${uid})`} />
        <g clipPath={`url(#topClip-${uid})`}>
          {pattern === 'split' && <circle cx={cx} cy={tc} r={topR} fill={`${edge}40`} clipPath={`url(#split-${uid})`} />}
          <PatternOverlay pattern={pattern} cx={cx} cy={tc} innerR={topR} edgeColor={edge} />
        </g>
        <circle cx={cx} cy={tc} r={ringR} fill="none" stroke={printColor} strokeOpacity="0.85" strokeWidth={size * 0.014} />
        {withText && (
          <text fill={printColor} fontSize={topR * 0.24} fontWeight="900" fontStyle="italic" fontFamily="'Barlow Condensed', 'Impact', sans-serif" letterSpacing="0.04em">
            <textPath href={`#arc-${uid}`} startOffset="50%" textAnchor="middle">{capText.toUpperCase()}</textPath>
          </text>
        )}
        {hasBadge && (
          <BadgeIcon
            badge={badge}
            cx={cx}
            cy={number != null ? tc - topR * 0.08 + (withText ? topR * 0.08 : 0) : tc + (withText ? topR * 0.12 : 0)}
            size={topR * (number != null ? 0.34 : 0.5)}
            color={printColor}
          />
        )}
        {number != null && (
          <text
            x={cx}
            y={hasBadge ? tc + topR * 0.4 : tc + topR * (withText ? 0.22 : 0.06)}
            textAnchor="middle"
            dominantBaseline="central"
            fill={isLight(primary) ? '#111111' : '#ffffff'}
            stroke={isLight(primary) ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)'}
            strokeWidth={topR * 0.05}
            paintOrder="stroke"
            fontSize={topR * (hasBadge ? 0.42 : withText ? 0.6 : 0.78)}
            fontWeight="900"
            fontFamily="'Barlow Condensed', 'Impact', sans-serif"
          >
            {number}
          </text>
        )}
      </g>

      {/* Light on the tin */}
      <ellipse cx={cx - R * 0.32} cy={tc - R * K * 0.42} rx={R * 0.42} ry={R * K * 0.16} fill={`rgba(255,255,255,${specAlpha * 0.55})`} transform={`rotate(-12 ${cx - R * 0.32} ${tc - R * K * 0.42})`} />
    </svg>
  )
}

/* ========================================
   SECTION LABEL
   ======================================== */
