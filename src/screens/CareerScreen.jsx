import { useState } from 'react'
import { useMatchStore, SCREEN, MATCH_DURATIONS } from '../state/MatchStore'
import { useCareerStore } from '../state/careerStore'
import { useTournamentStore } from '../state/tournamentStore'
import { DIVISIONS, TOP, PROMOTED, RELEGATED, ME, nextMatch, seasonOver, myPosition, outcomeFor } from '../game/career'
import { teamById, allFixtures, standings } from '../game/tournament'
import { formatClock } from '../game/rules'
import { TEAM_NAME_MAX } from '../data/TeamOptions'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'
import { Table } from './TournamentHubScreen'
import { KitEditor } from './TournamentSetupScreen'
import { TeamTag } from '../ui/TournamentBits'
import CapPreview from '../ui/CapPreview'
import CapDesigns from '../ui/CapDesigns'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import AccountPanel from '../ui/AccountPanel'
import { useAccountStore } from '../state/accountStore'
import SquadPanel from '../ui/SquadPanel'
import { seasonBonus } from '../game/squad'

const OUTCOME = {
  promoted: { title: 'Promoted!', tone: 'good', line: (next) => `Up you go to the ${next}.` },
  champions: { title: 'Champions!', tone: 'gold', line: () => 'Top of the Premier Cap League. Defend the title next season.' },
  relegated: { title: 'Relegated', tone: 'bad', line: (next) => `Down to the ${next}. Win your way back up.` },
  stayed: { title: 'Season over', tone: '', line: (next) => `Another season in the ${next}.` },
}

/** The club's starting kit: the player's own team 1 kit, under their club name. */
function startingKit(teamConfig) {
  const own = teamConfig.team1
  return {
    name: own.name && own.name !== 'Team 1' ? own.name : 'My Club',
    primary: own.primary, edge: own.edge, badge: own.badge, pattern: own.pattern, finish: own.finish,
    capText: own.capText || '', textColor: own.textColor || '', skirtColor: own.skirtColor || '', numbers: own.numbers,
  }
}

function StartCareer() {
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const [club, setClub] = useState(() => startingKit(teamConfig))
  const [duration, setDuration] = useState(120)
  const [kitOpen, setKitOpen] = useState(false)
  const start = () => {
    playConfirm()
    useCareerStore.getState().start({ ...club, name: club.name.trim() || 'My Club' }, duration)
  }
  return (
    <div className="career-start">
      <section className="card card-pad">
        <h2 className="saved-h">Your club</h2>
        <p className="muted t-note">Start in the {DIVISIONS[0].name} against five computer clubs. Finish in the top {PROMOTED} to go up a division. Finish bottom and you go down. Win the {DIVISIONS[TOP].name} to be champions.</p>
        <div className="career-club">
          <CapPreview config={club} size={96} number={club.numbers?.atk1 ?? 10} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="eyebrow" htmlFor="career-name" style={{ display: 'block', marginBottom: 6 }}>Club name</label>
            <input id="career-name" className="field" value={club.name} maxLength={TEAM_NAME_MAX} onChange={(e) => setClub({ ...club, name: e.target.value })} />
          </div>
        </div>
        <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Kit</div>
        <p className="muted t-note">Pick a design, or open Edit team for colours, pattern, badge, text and squad numbers. Your club keeps this kit all season — you can change it again before the next season kicks off.</p>
        <button className="btn btn-secondary btn-block" style={{ margin: '8px 0 10px' }} onClick={() => { playButtonSelect(); setKitOpen(true) }}><Icon name="settings" size={18} /> Edit team</button>
        <CapDesigns config={club} onPick={(patch) => setClub({ ...club, ...patch })} />
        <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Match length</div>
        <div className="segmented stretch" role="group" aria-label="Match length">
          {MATCH_DURATIONS.map((d) => (
            <button key={d} aria-pressed={duration === d} onClick={() => { playButtonSelect(); setDuration(d) }}>{formatClock(d)}</button>
          ))}
        </div>
      </section>
      <button className="btn btn-gold btn-lg btn-block" onClick={start} onMouseEnter={playHoverTick}><Icon name="play" size={20} /> Start career</button>
      {kitOpen && <KitEditor team={club} withName onUpdate={(patch) => setClub((c) => ({ ...c, ...patch }))} onClose={() => setKitOpen(false)} />}
    </div>
  )
}

function timeAgo(iso) {
  if (!iso) return null
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return new Date(iso).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
}

/** Where the career is saved, and a button to save right now. */
function SaveBar() {
  const { username, savedAt, saving, error } = useAccountStore()
  return (
    <div className="career-save" role="status">
      <Icon name="check" size={16} />
      <span>{saving ? 'Saving…' : `Saved to ${username}${savedAt ? ` · ${timeAgo(savedAt)}` : ''}`}{error ? ` — ${error}` : ''}</span>
      <button className="btn btn-ghost" onClick={() => { playButtonSelect(); useAccountStore.getState().save({ force: true }) }} disabled={saving}>Save now</button>
    </div>
  )
}

function Ladder({ level, promotions, titles }) {
  return (
    <section className="card card-pad career-ladder" aria-label="Divisions">
      <h2 className="saved-h">The pyramid</h2>
      <ol>
        {DIVISIONS.map((d, i) => DIVISIONS.length - 1 - i).map((i) => (
          <li key={i} data-here={i === level ? 'true' : undefined} data-done={i < level ? 'true' : undefined}>
            <span className="career-ladder-n">{DIVISIONS.length - i}</span>
            <span className="career-ladder-name">{DIVISIONS[i].name}</span>
            <small className="muted">{DIVISIONS[i].difficulty === 'hard' ? 'Hard' : DIVISIONS[i].difficulty === 'medium' ? 'Medium' : 'Easy'}</small>
          </li>
        ))}
      </ol>
      <p className="muted t-note">{promotions} promotion{promotions === 1 ? '' : 's'} · {titles} title{titles === 1 ? '' : 's'}</p>
    </section>
  )
}

function SeasonEnd({ career }) {
  const pos = myPosition(career.league)
  const count = career.league.teams.length
  const outcome = outcomeFor(career.level, pos, count)
  const nextLevel = outcome === 'promoted' ? career.level + 1 : outcome === 'relegated' ? career.level - 1 : career.level
  const o = OUTCOME[outcome]
  const row = standings(career.league).find((r) => r.id === ME)
  return (
    <section className="card card-pad career-end" data-tone={o.tone}>
      <div className="eyebrow">Season {career.season} · {DIVISIONS[career.level].name}</div>
      <h2 className="display career-end-title">{o.title}</h2>
      <p className="career-end-pos">Finished <b>{ordinal(pos)}</b> of {count}{row ? ` · ${row.w}W ${row.d}D ${row.l}L · ${row.pts} pts` : ''}</p>
      <p className="muted">{o.line(DIVISIONS[nextLevel].name)}</p>
      <p className="muted">Season bonus: <b>{seasonBonus(outcome)} coins</b>. Your players will improve a little over the summer, and the transfer window opens before the new season.</p>
      <button className="btn btn-gold btn-lg btn-block" onClick={() => { playConfirm(); useCareerStore.getState().nextSeason() }}>
        <Icon name="next" size={20} /> Start season {career.season + 1}
      </button>
    </section>
  )
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function CareerScreen() {
  const career = useCareerStore((s) => s.career)
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const [editing, setEditing] = useState(false)
  const [confirmRetire, setConfirmRetire] = useState(false)

  const username = useAccountStore((s) => s.username)
  const back = () => { playButtonSelect(); goToScreen(SCREEN.MENU) }

  // Careers live on your account, so you need one first
  if (!username) {
    return (
      <div className="screen">
        <div className="shell">
          <header className="shell-head">
            <div>
              <div className="eyebrow shell-eyebrow">Career mode</div>
              <h1 className="display shell-title">Create your account</h1>
            </div>
          </header>
          <main className="shell-body career-start">
            <section className="card card-pad">
              <p className="t-note">Your career is saved to your account as you play — every season, result and trophy — so you can pick it up on any phone. It only takes a username and a password.</p>
              <AccountPanel formOnly />
            </section>
          </main>
          <footer className="shell-foot"><div className="shell-foot-inner">
            <button className="btn btn-secondary" onClick={back}><Icon name="back" size={18} /> Menu</button>
          </div></footer>
        </div>
      </div>
    )
  }

  if (!career) {
    return (
      <div className="screen">
        <div className="shell">
          <header className="shell-head">
            <div>
              <div className="eyebrow shell-eyebrow">Career mode</div>
              <h1 className="display shell-title">Start your career</h1>
            </div>
          </header>
          <main className="shell-body"><StartCareer /></main>
          <footer className="shell-foot"><div className="shell-foot-inner">
            <button className="btn btn-secondary" onClick={back}><Icon name="back" size={18} /> Menu</button>
          </div></footer>
        </div>
      </div>
    )
  }

  const league = career.league
  const division = DIVISIONS[career.level]
  const next = nextMatch(league)
  const done = seasonOver(league)
  const fixtures = allFixtures(league).filter((f) => f.home === ME || f.away === ME)
  const played = fixtures.filter((f) => f.result).length
  const count = league.teams.length
  const zoneOf = (i) => {
    if (career.level < TOP && i < PROMOTED) return 'up'
    if (career.level === TOP && i === 0) return 'up'
    if (career.level > 0 && i >= count - RELEGATED) return 'down'
    return null
  }
  // The kit is fixed once a season is under way; change it before matchday 1
  const kitOpen = played === 0
  const opponent = next ? teamById(league, next.home === ME ? next.away : next.home) : null
  const play = () => { playConfirm(); useTournamentStore.getState().playFixture('career', next) }

  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head">
          <div>
            <div className="eyebrow shell-eyebrow">Career · Season {career.season} · {division.name}</div>
            <h1 className="display shell-title">{career.club.name}</h1>
          </div>
          <span className="career-kit">
            <CapPreview config={career.club} size={52} />
          </span>
        </header>

        <main className="shell-body career-body">
          <div className="career-col">
          <SaveBar />
          <section className="card card-pad career-kit-card">
            <CapPreview config={career.club} size={64} number={career.club.numbers?.atk1 ?? 10} />
            <div>
              <h2 className="saved-h">Your team</h2>
              {kitOpen
                ? <p className="muted t-note">The new season hasn’t kicked off yet — you can change your name, kit and squad numbers now. They’re locked once matchday 1 is played.</p>
                : <p className="muted t-note"><Icon name="lock" size={13} /> Name, kit and numbers are locked for this season. Change them before next season starts.</p>}
            </div>
            {kitOpen && <button className="btn btn-secondary" onClick={() => { playButtonSelect(); setEditing(true) }}>Edit team</button>}
          </section>
          {done ? <SeasonEnd career={career} /> : next && (
            <section className="card card-pad career-next">
              <div className="eyebrow">Matchday {played + 1} of {fixtures.length} · {next.home === ME ? 'Home' : 'Away'}</div>
              <div className="career-vs">
                <TeamTag team={teamById(league, ME)} size={34} strong />
                <span className="vs-badge">VS</span>
                <TeamTag team={opponent} size={34} strong />
              </div>
              <button className="btn btn-gold btn-lg btn-block" onClick={play} onMouseEnter={playHoverTick}><Icon name="play" size={20} /> Play match</button>
              <p className="muted t-note">Computer level: {division.difficulty}. Other clubs’ games play out by themselves.</p>
            </section>
          )}

          <SquadPanel career={career} />
          </div>

          <div className="career-col">
          <section className="card card-pad">
            <h2 className="saved-h">{division.name} table</h2>
            <Table t={league} mine={[ME]} zoneOf={zoneOf} />
            <p className="muted t-note career-key">
              {career.level < TOP ? <><i className="career-dot up" /> Promotion</> : <><i className="career-dot up" /> Champions</>}
              {career.level > 0 && <> <i className="career-dot down" /> Relegation</>}
            </p>
          </section>

          <Ladder level={career.level} promotions={career.promotions} titles={career.titles} />

          {career.past.length > 0 && (
            <section className="card card-pad">
              <h2 className="saved-h">Past seasons</h2>
              <ul className="saved-history">
                {career.past.slice(0, 10).map((p) => (
                  <li key={p.season}>
                    <span />
                    <span className="saved-score">Season {p.season} · {p.division} · <b>{ordinal(p.position)}</b></span>
                    <span />
                    <small className="muted saved-when">{OUTCOME[p.outcome]?.title || ''}{p.record ? ` · ${p.record.w}W ${p.record.d}D ${p.record.l}L` : ''}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button className="btn btn-ghost" onClick={() => { playButtonSelect(); setConfirmRetire(true) }}>Retire and start again</button>
          </div>
        </main>

        <footer className="shell-foot"><div className="shell-foot-inner">
          <button className="btn btn-secondary" onClick={back}><Icon name="back" size={18} /> Menu</button>
        </div></footer>
      </div>

      {editing && kitOpen && (
        <KitEditor
          team={career.club}
          withName
          onUpdate={(patch) => useCareerStore.getState().updateClub(patch)}
          onClose={() => setEditing(false)}
        />
      )}
      {confirmRetire && (
        <Modal title="Retire?" onClose={() => setConfirmRetire(false)}>
          <p>This ends {career.club.name}’s career for good: season {career.season}, {career.promotions} promotions and {career.titles} titles.</p>
          <button className="btn btn-danger btn-block" onClick={() => { playButtonSelect(); useCareerStore.getState().retire(); setConfirmRetire(false) }}>Retire</button>
          <button className="btn btn-secondary btn-block" onClick={() => setConfirmRetire(false)}>Keep playing</button>
        </Modal>
      )}
    </div>
  )
}
