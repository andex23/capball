import { useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { BADGES, PATTERNS, FINISHES, TEAM_NAME_MAX } from '../data/TeamOptions'
import { sendTeamConfig } from '../multiplayer/MultiplayerManager'
import { playButtonSelect, playHoverTick } from '../audio/SoundManager'
import SetupShell from '../ui/SetupShell'
import CapPreview from '../ui/CapPreview'
import Icon from '../ui/Icon'
import { displayColor } from '../ui/color'

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

const TABS = [
  { key: 'colors', label: 'Colours' },
  { key: 'badge', label: 'Badge' },
  { key: 'style', label: 'Finish' },
]

function Swatches({ label, value, onPick, disabled }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="swatches" role="group" aria-label={label}>
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            aria-pressed={value === c}
            aria-label={`${label} ${c}`}
            disabled={disabled}
            onClick={() => { playButtonSelect(); onPick(c) }}
          />
        ))}
      </div>
    </div>
  )
}

function Chips({ label, options, value, onPick, disabled }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="chip-row" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key}
            className="chip"
            aria-pressed={value === o.key}
            disabled={disabled}
            onClick={() => { playButtonSelect(); onPick(o.key) }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function TeamCard({ teamKey, config, onUpdate, locked, tag }) {
  const [tab, setTab] = useState('colors')
  const [draftName, setDraftName] = useState(null)
  const teamColor = displayColor(config.primary)

  const commitName = () => {
    if (draftName === null) return
    const name = draftName.trim()
    if (name) onUpdate({ name })
    setDraftName(null)
  }

  return (
    <section className="card team-card" style={{ '--team': teamColor }} aria-label={`${config.name} kit`}>
      <div className="team-card-head">
        <input
          className="team-name-input"
          value={draftName ?? config.name}
          maxLength={TEAM_NAME_MAX}
          disabled={locked}
          aria-label={`${teamKey === 'team1' ? 'Home' : 'Away'} team name`}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        {tag && <span className="lock-note">{locked && <Icon name="lock" size={14} />}{tag}</span>}
      </div>

      <div style={{ display: 'grid', placeItems: 'center', padding: '18px 0 10px' }}>
        <CapPreview config={config} size={128} />
      </div>

      {locked ? (
        <p className="muted" style={{ padding: '4px 20px 20px', textAlign: 'center', fontSize: 13 }}>
          Your opponent is building this kit.
        </p>
      ) : (
        <>
          <div className="tabs" role="tablist" style={{ padding: '0 12px' }}>
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { playButtonSelect(); setTab(t.key) }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 210 }}>
            {tab === 'colors' && (
              <>
                <Swatches label="Body" value={config.primary} onPick={(c) => onUpdate({ primary: c })} />
                <Swatches label="Rim" value={config.edge} onPick={(c) => onUpdate({ edge: c })} />
              </>
            )}
            {tab === 'badge' && (
              <Chips label="Badge" options={BADGES} value={config.badge} onPick={(k) => onUpdate({ badge: k })} />
            )}
            {tab === 'style' && (
              <>
                <Chips label="Pattern" options={PATTERNS} value={config.pattern} onPick={(k) => onUpdate({ pattern: k })} />
                <Chips label="Finish" options={FINISHES} value={config.finish} onPick={(k) => onUpdate({ finish: k })} />
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default function TeamSelectScreen() {
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const setTeamConfig = useMatchStore((s) => s.setTeamConfig)
  const ballColor = useMatchStore((s) => s.ballColor)
  const setBallColor = useMatchStore((s) => s.setBallColor)
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const gameMode = useMatchStore((s) => s.gameMode)
  const myTeam = useMatchStore((s) => s.onlineMyTeam)
  const aiTeam = useMatchStore((s) => s.aiTeam)
  const isOnline = gameMode === 'online'
  const isGuest = isOnline && myTeam === 'team2'

  const update = (team, config) => {
    setTeamConfig(team, config)
    // The guest asks the host to apply its edits; the host's copy comes back via sync
    if (isGuest && team === 'team2') sendTeamConfig(config)
  }

  const tagFor = (team) => {
    if (isOnline) return team === myTeam ? 'You' : 'Opponent'
    if (gameMode === 'ai') return team === aiTeam ? 'CPU' : 'You'
    return team === 'team1' ? 'Player 1' : 'Player 2'
  }

  return (
    <SetupShell
      step={0}
      title="Build your teams"
      subtitle="Name your side and design your caps."
      onBack={() => goToScreen(SCREEN.MENU)}
      next={{ label: 'Choose venue', onClick: () => goToScreen(SCREEN.STADIUM_SELECT) }}
      onBothReady={() => goToScreen(SCREEN.STADIUM_SELECT)}
    >
      <div className="versus">
        <TeamCard teamKey="team1" config={teamConfig.team1} onUpdate={(c) => update('team1', c)} locked={isOnline && myTeam !== 'team1'} tag={tagFor('team1')} />
        <div className="vs-badge" aria-hidden>VS</div>
        <TeamCard teamKey="team2" config={teamConfig.team2} onUpdate={(c) => update('team2', c)} locked={isOnline && myTeam !== 'team2'} tag={tagFor('team2')} />
      </div>

      <div className="card card-pad" style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div className="eyebrow">Match ball</div>
        <div className="chip-row" role="group" aria-label="Match ball colour">
          {BALL_COLORS.map(({ color, label }) => (
            <button
              key={color}
              className="swatch"
              style={{ background: color, width: 32 }}
              aria-pressed={ballColor === color}
              aria-label={`${label} ball`}
              title={label}
              disabled={isGuest}
              onMouseEnter={playHoverTick}
              onClick={() => { playButtonSelect(); setBallColor(color) }}
            />
          ))}
        </div>
        {isGuest && <span className="muted" style={{ fontSize: 13 }}>The host picks the ball.</span>}
      </div>
    </SetupShell>
  )
}
