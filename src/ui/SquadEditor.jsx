import { CAP_ROLES } from '../data/TeamOptions'
import { DEFAULT_TEAM_CONFIG } from '../state/MatchStore'
import { playButtonSelect } from '../audio/SoundManager'
import CapPreview from './CapPreview'

const ROLE_NAMES = { gk: 'Keeper', def1: 'Defender', def2: 'Defender', mid: 'Midfield', atk1: 'Forward', atk2: 'Forward' }

/** Squad numbers for each cap, and whether the team name goes on the caps. */
export default function SquadEditor({ config, onUpdate, teamKey = 'team1', disabled = false }) {
  const defaults = DEFAULT_TEAM_CONFIG[teamKey]?.numbers || DEFAULT_TEAM_CONFIG.team1.numbers
  const numberOf = (role) => (Number.isInteger(config.numbers?.[role]) ? config.numbers[role] : defaults[role])
  const setNumber = (role, raw) => {
    const n = Math.max(0, Math.min(99, parseInt(String(raw).replace(/\D/g, ''), 10) || 0))
    onUpdate({ numbers: { ...defaults, ...(config.numbers || {}), [role]: n } })
  }
  const used = CAP_ROLES.map(numberOf)
  const showName = config.showName !== false

  return (
    <div className="squad-editor">
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Team name on the caps</div>
        <div className="segmented stretch" role="group" aria-label="Team name on the caps">
          <button aria-pressed={showName} disabled={disabled} onClick={() => { playButtonSelect(); onUpdate({ showName: true }) }}>Show</button>
          <button aria-pressed={!showName} disabled={disabled} onClick={() => { playButtonSelect(); onUpdate({ showName: false }) }}>Hide</button>
        </div>
        <p className="muted t-note" style={{ marginTop: 6 }}>Your own cap text (Text tab) always shows instead, if you set one.</p>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Squad numbers</div>
        <div className="squad-grid">
          {CAP_ROLES.map((role) => {
            const n = numberOf(role)
            const clash = used.filter((x) => x === n).length > 1
            return (
              <label key={role} className="squad-cell" data-clash={clash ? 'true' : undefined}>
                <CapPreview config={config} size={52} number={n} />
                <small>{ROLE_NAMES[role]}</small>
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
        {used.some((n, i) => used.indexOf(n) !== i) && <p className="t-warn" style={{ marginTop: 6 }}>Two caps share a number.</p>}
      </div>
    </div>
  )
}
