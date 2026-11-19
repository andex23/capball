import { useState, useEffect, useRef } from 'react'
import { useAccountStore } from '../state/accountStore'
import { autoTeamNames } from '../game/teamNames'
import { useMatchStore, SCREEN, DEFAULT_TEAM_CONFIG } from '../state/MatchStore'
import { BADGES, PATTERNS, FINISHES, TEAM_NAME_MAX, CAP_TEXT_MAX, sanitizeCapText, CLEAR_TO, designPatch, isDesign } from '../data/TeamOptions'
import CapDesigns, { useOpenDesigns } from '../ui/CapDesigns'
import ColorPicker from '../ui/ColorPicker'
import SquadEditor from '../ui/SquadEditor'
import { sendTeamConfig } from '../multiplayer/MultiplayerManager'
import { playButtonSelect, playHoverTick } from '../audio/SoundManager'
import SetupShell from '../ui/SetupShell'
import CapPreview from '../ui/CapPreview'
import Icon from '../ui/Icon'
import { displayColor } from '../ui/color'

// The ball is a carrom coin: white or black, or the red queen
const BALL_COLORS = [
  { color: '#EFE6D2', label: 'White' },
  { color: '#1C1B1A', label: 'Black' },
  { color: '#B71C1C', label: 'Red' },
]

const TABS = [
  { key: 'designs', label: 'All designs' },
  { key: 'colors', label: 'Colours' },
  { key: 'badge', label: 'Text' },
  { key: 'style', label: 'Finish' },
  { key: 'squad', label: 'Squad' },
]

// Tapping the chosen option again clears it (back to `clearTo`)
function Chips({ label, options, value, onPick, disabled, clearTo }) {
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
            onClick={() => { playButtonSelect(); onPick(value === o.key && clearTo ? clearTo : o.key) }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A row of every design you can use now; the one on your caps is ringed. */
function DesignStrip({ teamKey, config, onPick }) {
  const list = useOpenDesigns(DEFAULT_TEAM_CONFIG[teamKey])
  const row = useRef(null)
  // Start with the design you're wearing in view
  useEffect(() => { row.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }) }, [teamKey])
  return (
    <div className="cap-strip" ref={row} role="group" aria-label="Designs">
      {list.map((d) => (
        <button key={d.key} className="cap-strip-item" aria-pressed={isDesign(config, d)} onClick={() => { playButtonSelect(); onPick(designPatch(d)) }}>
          <CapPreview config={d} size={54} />
          <span>{d.name}</span>
        </button>
      ))}
    </div>
  )
}

/** The side you're designing: one big cap, its name, a strip of designs and the finer controls. */
function CapStudio({ teamKey, config, onUpdate }) {
  const [tab, setTab] = useState(null)
  const [draftName, setDraftName] = useState(null)
  const [draftText, setDraftText] = useState(null)
  const commitText = () => {
    if (draftText === null) return
    onUpdate({ capText: sanitizeCapText(draftText) })
    setDraftText(null)
  }
  const commitName = () => {
    if (draftName === null) return
    const name = draftName.trim()
    // Typed by the player: theirs to keep. Cleared: back to the automatic name.
    if (name && name !== config.name) onUpdate({ name, customName: true })
    else if (!name) onUpdate({ customName: false })
    setDraftName(null)
  }
  const pickDesign = (patch) => { setDraftText(null); onUpdate(patch) }

  return (
    <section className="cap-studio" style={{ '--team': displayColor(config.primary) }} aria-label={`${config.name} kit`}>
      <div className="cap-studio-hero">
        <CapPreview config={config} size={210} number={config.numbers?.atk1 ?? DEFAULT_TEAM_CONFIG[teamKey].numbers.atk1} />
      </div>
      <input
        className="cap-studio-name"
        value={draftName ?? config.name}
        maxLength={TEAM_NAME_MAX}
        aria-label={`${teamKey === 'team1' ? 'Home' : 'Away'} team name`}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      <DesignStrip teamKey={teamKey} config={config} onPick={pickDesign} />
      <div className="cap-studio-tools" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { playButtonSelect(); setTab(tab === t.key ? null : t.key) }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab && (
        <div className="card card-pad kit-options cap-studio-panel">
          {tab === 'designs' && <CapDesigns config={config} defaultKit={DEFAULT_TEAM_CONFIG[teamKey]} onPick={pickDesign} />}
          {tab === 'colors' && (
            <>
              <ColorPicker label="Top colour" value={config.primary} onPick={(c) => onUpdate({ primary: c || config.primary })} />
              <ColorPicker label="Pattern & ring colour" value={config.edge} onPick={(c) => onUpdate({ edge: c || config.edge })} />
              <ColorPicker label="Text & badge colour" value={config.textColor || ''} allowDefault onPick={(c) => onUpdate({ textColor: c })} />
              <ColorPicker label="Sides colour" value={config.skirtColor || ''} allowDefault autoLabel="Same as top" onPick={(c) => onUpdate({ skirtColor: c })} />
            </>
          )}
          {tab === 'badge' && (
            <>
              <div>
                <label className="eyebrow" htmlFor={`cap-text-${teamKey}`} style={{ display: 'block', marginBottom: 8 }}>Text on your caps</label>
                <input
                  id={`cap-text-${teamKey}`}
                  className="field"
                  value={draftText ?? config.capText ?? ''}
                  maxLength={CAP_TEXT_MAX}
                  placeholder="Leave empty to print your team name"
                  autoComplete="off"
                  onChange={(e) => setDraftText(e.target.value)}
                  onBlur={commitText}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                />
              </div>
              <Chips label="Badge" options={BADGES} value={config.badge} onPick={(k) => onUpdate({ badge: k })} clearTo={CLEAR_TO.badge} />
            </>
          )}
          {tab === 'squad' && <SquadEditor config={config} teamKey={teamKey} onUpdate={onUpdate} />}
          {tab === 'style' && (
            <>
              <Chips label="Pattern" options={PATTERNS} value={config.pattern} onPick={(k) => onUpdate({ pattern: k })} clearTo={CLEAR_TO.pattern} />
              <Chips label="Finish" options={FINISHES} value={config.finish} onPick={(k) => onUpdate({ finish: k })} clearTo={CLEAR_TO.finish} />
            </>
          )}
        </div>
      )}
    </section>
  )
}

/** The other side, small: tap it to design their caps instead (unless your opponent is doing that). */
function OtherSide({ teamKey, config, tag, locked, onOpen }) {
  const Tag = locked ? 'div' : 'button'
  return (
    <Tag className="other-side" style={{ '--team': displayColor(config.primary) }} {...(locked ? {} : { onClick: () => { playButtonSelect(); onOpen() }, type: 'button' })}>
      <CapPreview config={config} size={64} number={config.numbers?.atk1 ?? DEFAULT_TEAM_CONFIG[teamKey].numbers.atk1} />
      <span className="other-side-text">
        <b>{config.name}</b>
        <small>{tag}{locked ? ' · building their own caps' : ' · tap to change their caps'}</small>
      </span>
      {locked ? <Icon name="lock" size={16} /> : <Icon name="next" size={18} />}
    </Tag>
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

  // Your side carries your username, the computer's says CPU (unless you named them yourself)
  const username = useAccountStore((s) => s.username)
  useEffect(() => {
    const names = autoTeamNames({ gameMode, aiTeam, onlineMyTeam: myTeam, teamConfig: useMatchStore.getState().teamConfig, username })
    for (const [team, patch] of Object.entries(names)) update(team, patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, aiTeam, myTeam, username, teamConfig.team1?.customName, teamConfig.team2?.customName])

  const tagFor = (team) => {
    if (isOnline) return team === myTeam ? 'You' : 'Opponent'
    if (gameMode === 'ai') return team === aiTeam ? 'CPU' : 'You'
    return team === 'team1' ? 'Player 1' : 'Player 2'
  }

  // The side you're designing; the other one sits underneath
  const mine = isOnline ? myTeam || 'team1' : gameMode === 'ai' && aiTeam === 'team1' ? 'team2' : 'team1'
  const [active, setActive] = useState(mine)
  useEffect(() => { if (isOnline) setActive(mine) }, [isOnline, mine])
  const other = active === 'team1' ? 'team2' : 'team1'

  return (
    <SetupShell
      step={0}
      title={active === mine ? 'Your caps' : `${teamConfig[active].name}’s caps`}
      subtitle={`${tagFor(active)} · tap a design to put it on`}
      onBack={() => goToScreen(SCREEN.MENU)}
      next={{ label: 'Choose table', onClick: () => goToScreen(SCREEN.STADIUM_SELECT) }}
      onBothReady={() => goToScreen(SCREEN.STADIUM_SELECT)}
    >
      <CapStudio key={active} teamKey={active} config={teamConfig[active]} onUpdate={(c) => update(active, c)} />
      <div className="vs-badge cap-studio-vs" aria-hidden>VS</div>
      <OtherSide teamKey={other} config={teamConfig[other]} tag={tagFor(other)} locked={isOnline && myTeam !== other} onOpen={() => setActive(other)} />

      <div className="card card-pad" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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
