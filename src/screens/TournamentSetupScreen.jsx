import { useState } from 'react'
import { useMatchStore, SCREEN, MATCH_DURATIONS } from '../state/MatchStore'
import { useTournamentStore } from '../state/tournamentStore'
import { MIN_TEAMS, MAX_TEAMS } from '../game/tournament'
import { AI_DIFFICULTIES } from '../game/records'
import { formatClock } from '../game/rules'
import { BADGES, TEAM_NAME_MAX, COLOR_PRESETS } from '../data/TeamOptions'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import CapPreview from '../ui/CapPreview'
import { displayColor } from '../ui/color'

/** Ready-made clubs for the extra teams (the first team is the player's own kit). */
const CLUBS = [
  { name: 'Red Lions', primary: '#D32F2F', edge: '#FFD700', badge: 'crown' },
  { name: 'Blue Stars', primary: '#1565C0', edge: '#FFFFFF', badge: 'star' },
  { name: 'Green Hornets', primary: '#2E7D32', edge: '#FFD700', badge: 'bolt' },
  { name: 'Golden Eagles', primary: '#F57F17', edge: '#000000', badge: 'shield' },
  { name: 'Purple Reign', primary: '#9C27B0', edge: '#FFFFFF', badge: 'diamond' },
  { name: 'Orange Tide', primary: '#E65100', edge: '#FFFFFF', badge: 'flame' },
  { name: 'Black Panthers', primary: '#000000', edge: '#FFD700', badge: 'skull' },
  { name: 'Sky Rovers', primary: '#0277BD', edge: '#FFFFFF', badge: 'star' },
  { name: 'Teal Town', primary: '#00838F', edge: '#FFFFFF', badge: 'shield' },
]

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

let uid = 0
const draftId = () => `d${++uid}`

function clubTeam(club) {
  return { key: draftId(), name: club.name, primary: club.primary, edge: club.edge, badge: club.badge || 'none', pattern: 'none', finish: 'matte', cpu: true, difficulty: 'medium' }
}

/** The next club not already in the list (by name or main colour). */
function nextClub(teams) {
  const names = new Set(teams.map((t) => t.name.toLowerCase()))
  const colours = new Set(teams.map((t) => t.primary.toUpperCase()))
  return CLUBS.find((c) => !names.has(c.name.toLowerCase()) && !colours.has(c.primary.toUpperCase()))
    || CLUBS.find((c) => !names.has(c.name.toLowerCase()))
    || CLUBS[teams.length % CLUBS.length]
}

function initialTeams(own) {
  const first = {
    key: draftId(),
    name: own?.name && own.name !== 'Team 1' ? own.name : 'My Team',
    primary: own?.primary || '#D32F2F',
    edge: own?.edge || '#FFD700',
    badge: own?.badge || 'none',
    pattern: own?.pattern || 'none',
    finish: own?.finish || 'matte',
    numbers: own?.numbers,
    cpu: false,
    difficulty: 'medium',
  }
  const teams = [first]
  while (teams.length < 4) teams.push(clubTeam(nextClub(teams)))
  return teams
}

const choose2 = (n) => (n * (n - 1)) / 2

function summary(format, legs, teams) {
  const n = teams.length
  const humans = teams.filter((t) => !t.cpu).length
  if (format === 'league') {
    const total = choose2(n) * legs
    const yours = (choose2(n) - choose2(n - humans)) * legs
    return `${total} matches, ${n - 1 > 0 ? (n - 1) * legs : 0} each. ${yours} to play on this phone; the computer plays out the rest.`
  }
  let size = 1
  while (size < n) size *= 2
  const rounds = Math.log2(size)
  const byes = size - n
  return `${rounds} round${rounds === 1 ? '' : 's'}, drawn at random.${byes ? ` ${byes} team${byes === 1 ? ' gets a bye' : 's get byes'} into round two.` : ''} Draws go to penalties.`
}

function Swatches({ label, value, onPick }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="swatches" role="group" aria-label={label}>
        {COLOR_PRESETS.map((c) => (
          <button key={c} className="swatch" style={{ background: c }} aria-pressed={value === c} aria-label={`${label} ${c}`}
            onClick={() => { playButtonSelect(); onPick(c) }} />
        ))}
      </div>
    </div>
  )
}

function KitEditor({ team, onUpdate, onClose }) {
  return (
    <Modal
      title={team.name || 'Kit'}
      onClose={onClose}
      footer={<button className="btn btn-gold btn-block" onClick={() => { playConfirm(); onClose() }}>Done <Icon name="check" size={18} /></button>}
    >
      <div className="t-kit-preview"><CapPreview config={team} size={96} /></div>
      <Swatches label="Body" value={team.primary} onPick={(c) => onUpdate({ primary: c })} />
      <Swatches label="Rim" value={team.edge} onPick={(c) => onUpdate({ edge: c })} />
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Badge</div>
        <div className="chip-row" role="group" aria-label="Badge">
          {BADGES.map((b) => (
            <button key={b.key} className="chip" aria-pressed={team.badge === b.key} onClick={() => { playButtonSelect(); onUpdate({ badge: b.key }) }}>{b.label}</button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function TeamRow({ team, index, onUpdate, onEdit, onRemove, canRemove }) {
  return (
    <li className="t-setup-team" style={{ '--team': displayColor(team.primary) }}>
      <button className="t-cap-btn" onClick={() => { playButtonSelect(); onEdit() }} aria-label={`Change ${team.name || `team ${index + 1}`} colours`}>
        <CapPreview config={team} size={44} />
      </button>
      <input
        className="field t-name-field"
        value={team.name}
        maxLength={TEAM_NAME_MAX}
        placeholder={`Team ${index + 1}`}
        aria-label={`Team ${index + 1} name`}
        onChange={(e) => onUpdate({ name: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      <div className="t-setup-controls">
        <div className="segmented" role="group" aria-label={`Who plays team ${index + 1}`}>
          <button aria-pressed={!team.cpu} onClick={() => { playButtonSelect(); onUpdate({ cpu: false }) }}><Icon name="users" size={14} /> Player</button>
          <button aria-pressed={team.cpu} onClick={() => { playButtonSelect(); onUpdate({ cpu: true }) }}><Icon name="cpu" size={14} /> CPU</button>
        </div>
        {team.cpu && (
          <div className="segmented t-diff" role="group" aria-label={`Team ${index + 1} difficulty`}>
            {AI_DIFFICULTIES.map((d) => (
              <button key={d} aria-pressed={team.difficulty === d} onClick={() => { playButtonSelect(); onUpdate({ difficulty: d }) }}>{DIFF_LABEL[d]}</button>
            ))}
          </div>
        )}
      </div>
      {canRemove ? (
        <button className="t-remove" onClick={() => { playButtonSelect(); onRemove() }} aria-label={`Remove ${team.name || `team ${index + 1}`}`}>
          <Icon name="close" size={16} />
        </button>
      ) : <span className="t-remove" aria-hidden />}
    </li>
  )
}

export default function TournamentSetupScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const ownKit = useMatchStore((s) => s.teamConfig.team1)
  const savedDuration = useMatchStore((s) => s.matchDuration)
  const createLocal = useTournamentStore((s) => s.createLocal)

  const [format, setFormat] = useState('knockout')
  const [legs, setLegs] = useState(1)
  const [duration, setDuration] = useState(MATCH_DURATIONS.includes(savedDuration) ? savedDuration : 180)
  const [teams, setTeams] = useState(() => initialTeams(ownKit))
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)

  const pick = (fn) => () => { playButtonSelect(); fn() }
  const update = (key, patch) => setTeams((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)))
  const add = () => setTeams((list) => (list.length >= MAX_TEAMS ? list : [...list, clubTeam(nextClub(list))]))
  const remove = (key) => setTeams((list) => (list.length <= MIN_TEAMS ? list : list.filter((t) => t.key !== key)))

  const humans = teams.filter((t) => !t.cpu).length
  const ready = humans > 0 && teams.length >= MIN_TEAMS
  const editingTeam = teams.find((t) => t.key === editing)

  const create = () => {
    if (!ready) return
    try {
      createLocal({
        format,
        legs: format === 'league' ? legs : 1,
        matchDuration: duration,
        teams: teams.map(({ key, ...t }, i) => ({ ...t, name: t.name.trim() || `Team ${i + 1}` })), // eslint-disable-line no-unused-vars
      })
      playConfirm()
      goToScreen(SCREEN.TOURNAMENT_HUB)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head">
          <div>
            <div className="eyebrow shell-eyebrow">Tournament · On this device</div>
            <h1 className="display shell-title">New tournament</h1>
          </div>
          <span className="mode-icon"><Icon name="trophy" size={24} /></span>
        </header>

        <main className="shell-body t-setup">
          <div className="t-setup-options">
            <div className="card card-pad">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Format</div>
              <div className="segmented stretch" role="group" aria-label="Format">
                <button aria-pressed={format === 'knockout'} onClick={pick(() => setFormat('knockout'))}>Knockout cup</button>
                <button aria-pressed={format === 'league'} onClick={pick(() => setFormat('league'))}>League</button>
              </div>
              {format === 'league' && (
                <div className="segmented stretch" role="group" aria-label="How many times teams meet" style={{ marginTop: 8 }}>
                  <button aria-pressed={legs === 1} onClick={pick(() => setLegs(1))}>Play once</button>
                  <button aria-pressed={legs === 2} onClick={pick(() => setLegs(2))}>Home &amp; away</button>
                </div>
              )}
              <p className="muted t-note">{summary(format, legs, teams)}</p>
            </div>
            <div className="card card-pad">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Match length</div>
              <div className="segmented stretch" role="group" aria-label="Match length">
                {MATCH_DURATIONS.map((d) => (
                  <button key={d} aria-pressed={duration === d} onClick={pick(() => setDuration(d))}>{formatClock(d)}</button>
                ))}
              </div>
              <p className="muted t-note">Every match in the tournament. The clock stops between turns.</p>
            </div>
          </div>

          <section className="card card-pad t-setup-teams">
            <div className="label-row" style={{ marginBottom: 12 }}>
              <div>
                <div className="eyebrow">Teams · {teams.length} of {MAX_TEAMS}</div>
                <p className="muted t-note" style={{ marginTop: 4 }}>Tap a cap to change its colours. “Player” teams are played on this phone, pass and play.</p>
              </div>
            </div>
            <ol className="t-setup-list">
              {teams.map((t, i) => (
                <TeamRow
                  key={t.key}
                  team={t}
                  index={i}
                  onUpdate={(patch) => update(t.key, patch)}
                  onEdit={() => setEditing(t.key)}
                  onRemove={() => remove(t.key)}
                  canRemove={teams.length > MIN_TEAMS}
                />
              ))}
            </ol>
            {teams.length < MAX_TEAMS && (
              <button className="btn btn-secondary btn-block t-add" onClick={pick(add)} onMouseEnter={playHoverTick}>+ Add a team</button>
            )}
            {!humans && <p className="t-warn" role="status">Make at least one team a Player team, or there’s nothing for you to play.</p>}
            {error && <p className="t-warn" role="alert">{error}</p>}
          </section>
        </main>

        <footer className="shell-foot">
          <div className="shell-foot-inner">
            <button className="btn btn-secondary" onClick={() => { playButtonSelect(); goToScreen(SCREEN.TOURNAMENT_HOME) }} onMouseEnter={playHoverTick}>
              <Icon name="back" size={18} /> Back
            </button>
            <button className="btn btn-lg btn-gold" onClick={create} onMouseEnter={playHoverTick} disabled={!ready}>
              Create <Icon name="trophy" size={18} />
            </button>
          </div>
        </footer>
      </div>

      {editingTeam && <KitEditor team={editingTeam} onUpdate={(patch) => update(editingTeam.key, patch)} onClose={() => setEditing(null)} />}
    </div>
  )
}
