import { useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'

const COLOR_PRESETS = [
  '#D32F2F', '#C62828', '#E91E63', '#9C27B0',
  '#1565C0', '#0277BD', '#00838F', '#2E7D32',
  '#F57F17', '#E65100', '#FFD700', '#FFFFFF',
  '#424242', '#000000',
]

const BALL_COLORS = [
  { color: '#c0c0c0', label: 'Silver' },
  { color: '#FFD700', label: 'Gold' },
  { color: '#FFFFFF', label: 'White' },
  { color: '#FF6F00', label: 'Orange' },
  { color: '#76FF03', label: 'Neon' },
  { color: '#E91E63', label: 'Pink' },
]

const BADGES = [
  { key: 'none', label: 'None' },
  { key: 'star', label: 'Star' },
  { key: 'shield', label: 'Shield' },
  { key: 'bolt', label: 'Bolt' },
  { key: 'crown', label: 'Crown' },
  { key: 'diamond', label: 'Diamond' },
  { key: 'skull', label: 'Skull' },
  { key: 'flame', label: 'Flame' },
]

const PATTERNS = [
  { key: 'none', label: 'Solid' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'split', label: 'Split' },
  { key: 'ring', label: 'Ring' },
  { key: 'cross', label: 'Cross' },
  { key: 'dots', label: 'Dots' },
]

const FINISHES = [
  { key: 'matte', label: 'Matte' },
  { key: 'satin', label: 'Satin' },
  { key: 'gloss', label: 'Gloss' },
  { key: 'chrome', label: 'Chrome' },
]

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
function CapPreview({ config, size = 120 }) {
  const { primary, edge, badge, numbers, pattern, finish } = config
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
  const isMatte = finish === 'matte'
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
function SectionLabel({ children }) {
  return <label style={styles.sectionLabel}>{children}</label>
}

/* ========================================
   OPTION PILL — for badges, patterns, finishes
   ======================================== */
function OptionPill({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.optionPill,
        background: selected
          ? 'linear-gradient(135deg, rgba(255,215,64,0.18) 0%, rgba(255,215,64,0.08) 100%)'
          : 'rgba(0,0,0,0.2)',
        border: selected ? '1.5px solid rgba(255,215,64,0.6)' : '1px solid rgba(255,255,255,0.1)',
        color: selected ? '#FFD740' : 'rgba(255,255,255,0.55)',
        boxShadow: selected ? '0 0 8px rgba(255,215,64,0.12)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

/* ========================================
   SQUAD NUMBER EDITOR — per-cap numbers
   ======================================== */
const POSITIONS = [
  { key: 'gk', label: 'GK' },
  { key: 'def1', label: 'DEF' },
  { key: 'def2', label: 'DEF' },
  { key: 'atk1', label: 'ATK' },
  { key: 'atk2', label: 'ATK' },
]

function SquadNumbers({ numbers, onChange, showNumbers }) {
  const adjust = (posKey, delta) => {
    const current = numbers?.[posKey] ?? 0
    let next = current + delta
    if (next < 0) next = 99
    else if (next > 99) next = 0
    onChange({ ...numbers, [posKey]: next })
  }

  const clearNumber = (posKey) => {
    const updated = { ...numbers }
    delete updated[posKey]
    onChange(updated)
  }

  return (
    <div style={styles.squadGrid}>
      {POSITIONS.map((pos) => {
        const val = numbers?.[pos.key]
        const hasNumber = val != null
        return (
          <div key={pos.key} style={styles.squadRow}>
            <span style={styles.posLabel}>{pos.label}</span>
            {showNumbers && hasNumber ? (
              <div style={styles.numberRow}>
                <button style={styles.numBtn} onClick={() => adjust(pos.key, -1)}>-</button>
                <span style={styles.numDisplay}>{val}</span>
                <button style={styles.numBtn} onClick={() => adjust(pos.key, 1)}>+</button>
                <button style={styles.numClearBtn} onClick={() => clearNumber(pos.key)} title="Remove number">x</button>
              </div>
            ) : (
              <button
                style={styles.addNumBtn}
                onClick={() => onChange({ ...numbers, [pos.key]: pos.key === 'gk' ? 1 : Math.floor(Math.random() * 98) + 1 })}
              >
                {showNumbers ? '+ Add' : '--'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ========================================
   TEAM PANEL — full cap builder
   ======================================== */
function TeamPanel({ teamKey, config, onUpdate }) {
  const [activeTab, setActiveTab] = useState('colors')
  const isRed = teamKey === 'team1'
  const panelBorderColor = isRed ? 'rgba(229,57,53,0.35)' : 'rgba(30,136,229,0.35)'
  const headerBg = `linear-gradient(135deg, ${config.primary} 0%, ${darkenHex(config.primary, 0.3)} 100%)`

  const tabs = [
    { key: 'colors', label: 'COLORS' },
    { key: 'identity', label: 'IDENTITY' },
    { key: 'style', label: 'STYLE' },
  ]

  return (
    <div style={{
      ...styles.panel,
      borderColor: panelBorderColor,
      boxShadow: `0 6px 30px rgba(0,0,0,0.5), 0 0 20px ${config.primary}15, inset 0 1px 0 rgba(255,255,255,0.06)`,
    }}>
      {/* Team header bar */}
      <div style={{ ...styles.panelHeader, background: headerBg }}>
        <input
          style={styles.nameInput}
          value={config.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          maxLength={16}
        />
      </div>

      {/* Cap preview — large and centered */}
      <div style={styles.capPreviewArea}>
        <CapPreview config={config} size={130} />
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              ...styles.tab,
              color: activeTab === t.key ? '#FFD740' : 'rgba(255,255,255,0.4)',
              borderBottom: activeTab === t.key ? '2px solid #FFD740' : '2px solid transparent',
              background: activeTab === t.key ? 'rgba(255,215,64,0.05)' : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={styles.tabContent}>
        {activeTab === 'colors' && (
          <>
            <div style={styles.optionGroup}>
              <SectionLabel>BODY</SectionLabel>
              <div style={styles.colorGrid}>
                {COLOR_PRESETS.map((c) => (
                  <div
                    key={c}
                    onClick={() => onUpdate({ primary: c })}
                    style={{
                      ...styles.colorSwatch,
                      backgroundColor: c,
                      outline: config.primary === c ? '2.5px solid #FFD740' : '1.5px solid rgba(255,255,255,0.12)',
                      outlineOffset: config.primary === c ? '2px' : '0px',
                      transform: config.primary === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: config.primary === c ? `0 0 10px ${c}66, 0 0 4px rgba(255,215,64,0.4)` : '0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={styles.optionGroup}>
              <SectionLabel>RIM</SectionLabel>
              <div style={styles.colorGrid}>
                {COLOR_PRESETS.map((c) => (
                  <div
                    key={c}
                    onClick={() => onUpdate({ edge: c })}
                    style={{
                      ...styles.colorSwatch,
                      backgroundColor: c,
                      outline: config.edge === c ? '2.5px solid #FFD740' : '1.5px solid rgba(255,255,255,0.12)',
                      outlineOffset: config.edge === c ? '2px' : '0px',
                      transform: config.edge === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: config.edge === c ? `0 0 10px ${c}66, 0 0 4px rgba(255,215,64,0.4)` : '0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'identity' && (
          <>
            <div style={styles.optionGroup}>
              <SectionLabel>BADGE</SectionLabel>
              <div style={styles.pillGrid}>
                {BADGES.map((b) => (
                  <OptionPill
                    key={b.key}
                    label={b.label}
                    selected={config.badge === b.key}
                    onClick={() => onUpdate({ badge: b.key })}
                  />
                ))}
              </div>
            </div>

            {/* Squad numbers removed — numbers auto-assigned */}
          </>
        )}

        {activeTab === 'style' && (
          <>
            <div style={styles.optionGroup}>
              <SectionLabel>PATTERN</SectionLabel>
              <div style={styles.pillGrid}>
                {PATTERNS.map((p) => (
                  <OptionPill
                    key={p.key}
                    label={p.label}
                    selected={config.pattern === p.key}
                    onClick={() => onUpdate({ pattern: p.key })}
                  />
                ))}
              </div>
            </div>

            <div style={styles.optionGroup}>
              <SectionLabel>FINISH</SectionLabel>
              <div style={styles.pillGrid}>
                {FINISHES.map((f) => (
                  <OptionPill
                    key={f.key}
                    label={f.label}
                    selected={config.finish === f.key}
                    onClick={() => onUpdate({ finish: f.key })}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ========================================
   MAIN SCREEN
   ======================================== */
export default function TeamSelectScreen() {
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const setTeamConfig = useMatchStore((s) => s.setTeamConfig)
  const ballColor = useMatchStore((s) => s.ballColor)
  const setBallColor = useMatchStore((s) => s.setBallColor)
  const goToScreen = useMatchStore((s) => s.goToScreen)

  return (
    <div style={styles.container}>
      <div style={styles.vignette} />

      {/* Title */}
      <div style={styles.titleArea}>
        <h2 style={styles.heading}>BUILD YOUR TEAMS</h2>
        <div style={styles.headingLine} />
      </div>

      {/* Main setup area */}
      <div style={styles.setupFrame}>
        <div style={styles.teamsRow}>
          <TeamPanel
            teamKey="team1"
            config={teamConfig.team1}
            onUpdate={(c) => setTeamConfig('team1', c)}
          />

          {/* Center VS divider */}
          <div style={styles.vsDivider}>
            <div style={styles.vsLine} />
            <div style={styles.vsCircle}>
              <span style={styles.vsText}>VS</span>
            </div>
            <div style={styles.vsLine} />
          </div>

          <TeamPanel
            teamKey="team2"
            config={teamConfig.team2}
            onUpdate={(c) => setTeamConfig('team2', c)}
          />
        </div>

        {/* Ball color */}
        <div style={styles.ballSection}>
          <div style={styles.ballRow}>
            <label style={styles.ballLabel}>MATCH BALL</label>
            <div style={styles.ballGrid}>
              {BALL_COLORS.map(({ color, label }) => (
                <div
                  key={color}
                  onClick={() => setBallColor(color)}
                  style={{
                    ...styles.ballSwatch,
                    backgroundColor: color,
                    outline: ballColor === color ? '2.5px solid #FFD740' : '1.5px solid rgba(255,255,255,0.12)',
                    outlineOffset: ballColor === color ? '2px' : '0px',
                    transform: ballColor === color ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: ballColor === color
                      ? '0 0 12px rgba(255,215,64,0.4), 0 2px 6px rgba(0,0,0,0.4)'
                      : '0 2px 4px rgba(0,0,0,0.3)',
                  }}
                  title={label}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={styles.navRow}>
        <button
          style={styles.backBtn}
          onClick={() => goToScreen(SCREEN.MENU)}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          BACK
        </button>
        <button
          style={styles.nextBtn}
          onClick={() => goToScreen(SCREEN.STADIUM_SELECT)}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          NEXT
        </button>
      </div>
    </div>
  )
}

/* Color helpers */
function darkenHex(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)))
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)))
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function lightenHex(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount))
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount))
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/* ========================================
   STYLES
   ======================================== */
const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #080a18 0%, #0d1230 30%, #151d45 60%, #0a0e25 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "var(--font-hud, 'Russo One', 'Arial Black', sans-serif)",
    color: 'white',
    gap: '10px',
    padding: '12px 24px',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)',
    pointerEvents: 'none',
  },

  /* Title */
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  heading: {
    fontFamily: "var(--font-display, 'Bungee', 'Impact', sans-serif)",
    fontSize: 'clamp(22px, 3.5vw, 32px)',
    fontWeight: '800',
    color: '#FFD740',
    margin: 0,
    letterSpacing: '5px',
    textShadow: '0 0 20px rgba(255,215,64,0.3), 0 3px 0 #B8860B',
  },
  headingLine: {
    width: '220px',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #FFD740, transparent)',
    marginTop: '4px',
  },

  /* Setup frame */
  setupFrame: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(8,10,25,0.4)',
    border: '1px solid rgba(255,215,64,0.1)',
    borderRadius: '16px',
    padding: '14px 20px 12px',
    position: 'relative',
    zIndex: 1,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
    maxHeight: 'calc(100vh - 140px)',
    overflowY: 'auto',
  },

  teamsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0px',
  },

  /* VS divider */
  vsDivider: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0px',
    padding: '0 10px',
    minHeight: '100%',
    justifyContent: 'center',
  },
  vsLine: {
    width: '2px',
    height: '50px',
    background: 'linear-gradient(180deg, transparent, rgba(255,215,64,0.2), transparent)',
  },
  vsCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(25,30,60,0.95) 0%, rgba(15,18,40,0.98) 100%)',
    border: '2px solid rgba(255,215,64,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 15px rgba(255,215,64,0.08)',
  },
  vsText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '13px',
    fontWeight: '700',
    color: 'rgba(255,215,64,0.6)',
    letterSpacing: '1px',
  },

  /* Team panel */
  panel: {
    background: 'linear-gradient(180deg, rgba(16,20,45,0.95) 0%, rgba(10,13,30,0.98) 100%)',
    border: '1.5px solid',
    borderRadius: '14px',
    width: 'clamp(300px, 36vw, 440px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '10px 16px',
    display: 'flex',
    justifyContent: 'center',
  },
  nameInput: {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    padding: '6px 14px',
    color: 'white',
    fontSize: '15px',
    fontWeight: '700',
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    textAlign: 'center',
    outline: 'none',
    letterSpacing: '1.5px',
    width: '100%',
    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },

  /* Cap preview */
  capPreviewArea: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '10px 0 4px',
    background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 70%)',
  },

  /* Tab bar */
  tabBar: {
    display: 'flex',
    width: '100%',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1,
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '1.5px',
    padding: '8px 0',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    transition: 'all 0.15s ease',
  },

  /* Tab content */
  tabContent: {
    padding: '10px 14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minHeight: '130px',
  },

  /* Section label */
  sectionLabel: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '8px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '2.5px',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: '2px',
    display: 'block',
  },

  /* Option group */
  optionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  /* Color grid */
  colorGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'transform 0.1s ease, box-shadow 0.15s ease, outline-offset 0.1s ease',
    border: 'none',
  },

  /* Pill grid for badges, patterns, finishes */
  pillGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  optionPill: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    padding: '5px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.12s ease',
    outline: 'none',
  },

  /* Squad numbers */
  squadGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  squadRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  posLabel: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '8px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '1px',
    width: '28px',
    flexShrink: 0,
  },
  numberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  numBtn: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '11px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    width: 22,
    height: 22,
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(0,0,0,0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    transition: 'all 0.1s',
    padding: 0,
  },
  numDisplay: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '14px',
    fontWeight: '700',
    color: '#FFD740',
    minWidth: '26px',
    textAlign: 'center',
    letterSpacing: '0.5px',
    textShadow: '0 0 6px rgba(255,215,64,0.15)',
  },
  numClearBtn: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '9px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    width: 18,
    height: 18,
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.2)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    padding: 0,
    marginLeft: '2px',
  },
  addNumBtn: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '9px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    padding: '3px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.2)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.1s',
  },

  /* Ball section */
  ballSection: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  ballRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    background: 'rgba(12,15,35,0.6)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '8px 20px',
  },
  ballLabel: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '9px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.35)',
    whiteSpace: 'nowrap',
  },
  ballGrid: {
    display: 'flex',
    gap: '8px',
  },
  ballSwatch: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'transform 0.1s ease, box-shadow 0.15s ease, outline-offset 0.1s ease',
    border: 'none',
  },

  /* Nav */
  navRow: {
    display: 'flex',
    gap: '16px',
    position: 'relative',
    zIndex: 1,
  },
  backBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    color: 'rgba(255,255,255,0.7)',
    padding: '12px 32px',
    background: 'linear-gradient(180deg, rgba(60,65,90,0.9) 0%, rgba(35,38,55,0.95) 100%)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
    transition: 'transform 0.08s ease',
    outline: 'none',
  },
  nextBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '12px 52px',
    background: 'linear-gradient(180deg, #66BB6A 0%, #43A047 40%, #2E7D32 100%)',
    border: '2px solid #1B5E20',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 4px 0 #1B5E20, 0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
    transition: 'transform 0.08s ease',
    outline: 'none',
  },
}
