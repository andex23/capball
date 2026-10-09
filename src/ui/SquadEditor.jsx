import { CAP_ROLES, playerNames, capNameMode, dummyNames, sanitizePlayerName, PLAYER_NAME_MAX } from '../data/TeamOptions'
import { DEFAULT_TEAM_CONFIG } from '../state/MatchStore'
import { playButtonSelect } from '../audio/SoundManager'
import CapPreview from './CapPreview'

const ROLE_NAMES = { gk: 'Keeper', def1: 'Defender', def2: 'Defender', mid: 'Midfield', atk1: 'Forward', atk2: 'Forward' }

/** Each cap's player name and squad number, and what's printed round the caps. */
export default function SquadEditor({ config, onUpdate, teamKey = 'team1', disabled = false, fixedNames = null }) {
  const defaults = DEFAULT_TEAM_CONFIG[teamKey]?.numbers || DEFAULT_TEAM_CONFIG.team1.numbers
  const numberOf = (role) => (Number.isInteger(config.numbers?.[role]) ? config.numbers[role] : defaults[role])
  const setNumber = (role, raw) => {
    const n = Math.max(0, Math.min(99, parseInt(String(raw).replace(/\D/g, ''), 10) || 0))
    onUpdate({ numbers: { ...defaults, ...(config.numbers || {}), [role]: n } })
  }
  const used = CAP_ROLES.map(numberOf)
  const mode = capNameMode(config)
  // Career: the names are your squad's (they change with transfers), so they're shown, not typed
  const names = fixedNames || playerNames(config)
  const setName = (role, raw) => onUpdate({ players: { ...names, [role]: raw.slice(0, PLAYER_NAME_MAX) } })
  const tidyName = (role) => onUpdate({ players: { ...names, [role]: sanitizePlayerName(names[role]) || dummyNames(config.name)[role] } })
  const shuffle = () => { playButtonSelect(); onUpdate({ players: dummyNames(`${config.name}:${Date.now()}`) }) }
  const MODES = [['player', 'Player names'], ['team', 'Team name'], ['none', 'Nothing']]

  return (
    <div className="squad-editor">
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Printed on the caps</div>
        <div className="segmented stretch" role="group" aria-label="Printed on the caps">
          {MODES.map(([key, label]) => (
            <button key={key} aria-pressed={mode === key} disabled={disabled} onClick={() => { playButtonSelect(); onUpdate({ capNames: key }) }}>{label}</button>
          ))}
        </div>
        <p className="muted t-note" style={{ marginTop: 6 }}>{mode === 'player' ? 'Each cap shows its player’s name and squad number.' : mode === 'team' ? 'Every cap shows your cap text (Text tab) or the team name.' : 'Just the squad numbers.'}</p>
      </div>
      <div>
        <div className="squad-names-head">
          <div className="eyebrow">Players and numbers</div>
          {!fixedNames && <button type="button" className="btn btn-ghost squad-shuffle" disabled={disabled} onClick={shuffle}>New names</button>}
        </div>
        <div className="squad-grid">
          {CAP_ROLES.map((role) => {
            const n = numberOf(role)
            const clash = used.filter((x) => x === n).length > 1
            return (
              <label key={role} className="squad-cell" data-clash={clash ? 'true' : undefined}>
                <CapPreview config={config} size={52} number={n} role={role} />
                <small>{ROLE_NAMES[role]}</small>
                <input
                  className="field squad-name-input"
                  value={names[role]}
                  maxLength={PLAYER_NAME_MAX}
                  disabled={disabled || !!fixedNames}
                  aria-label={`${ROLE_NAMES[role]} name`}
                  onChange={(e) => setName(role, e.target.value)}
                  onBlur={() => tidyName(role)}
                />
                <input
                  className="field squad-num"
                  inputMode="numeric"
                  maxLength={2}
                  value={n}
                  disabled={disabled}
                  aria-label={`${ROLE_NAMES[role]} number`}
                  onChange={(e) => setNumber(role, e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            )
          })}
        </div>
        {fixedNames && <p className="muted t-note" style={{ marginTop: 6 }}>Your players’ names come from your squad — sign new players in the transfer market.</p>}
        {used.some((n, i) => used.indexOf(n) !== i) && <p className="t-warn" style={{ marginTop: 6 }}>Two caps share a number.</p>}
      </div>
    </div>
  )
}
