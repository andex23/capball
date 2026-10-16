import { useState, useRef, useEffect } from 'react'
import { useMatchStore, SCREEN, MATCH_DURATIONS } from '../state/MatchStore'
import { useCareerStore } from '../state/careerStore'
import { useTournamentStore } from '../state/tournamentStore'
import { DIVISIONS, TOP, PROMOTED, RELEGATED, ME, opponentOvr, nextMatch, careerNext, seasonOver, myPosition, outcomeFor, cupNext, cupRun, cupPending, CUP_NAME, CUP_PRIZE, TARGETS, TARGET_BONUS, targetMet } from '../game/career'
import { teamById, allFixtures, standings, roundName } from '../game/tournament'
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
import { isLagos } from '../platform'
import SquadPanel, { PlayerRatings } from '../ui/SquadPanel'
import { seasonBonus, startingSquad, squadSurnames, squadRatings, averageRating, matchupOf, money } from '../game/squad'
import LeagueClubs from '../ui/LeagueClubs'
import MatchReport from '../ui/MatchReport'
import CupPage from '../ui/CupPage'
import BoardObjectives from '../ui/BoardObjectives'
import { inboxOffers, seasonAwards, repLabel, REP_START } from '../game/clubLife'
import { squadSize, transferWindow, MAX_SQUAD } from '../game/transfers'
import RatingsGuide from '../ui/RatingsGuide'
import ClubPanel from '../ui/ClubPanel'

const PAGE_TITLE = { cup: 'Cap Cup', report: 'Match report', squad: 'Squad', transfers: 'Transfers', youth: 'Youth team', club: 'Club', league: 'League', history: 'History', settings: 'Settings' }

const OUTCOME = {
  promoted: { title: 'Promoted!', tone: 'good', line: (next) => `Up you go to the ${next}.` },
  champions: { title: 'Champions!', tone: 'gold', line: () => 'Top of the Premier Cap League. Defend the title next season.' },
  relegated: { title: 'Relegated', tone: 'bad', line: (next) => `Down to the ${next}. Win your way back up.` },
  stayed: { title: 'Season over', tone: '', line: (next) => `Another season in the ${next}.` },
}

/** How a career is played: solo against the computer, or a friend plays the opposition. */
const MODE_INFO = {
  solo: { label: 'Solo', icon: 'play', line: 'Your own manager career. Every match is you against the computer.' },
  online: { label: 'Online', icon: 'globe', line: 'A friend plays every opponent from their own phone, anywhere. You host each match and send them the code.' },
  lan: { label: 'LAN', icon: 'wifi', line: 'A friend on the same Wi-Fi plays every opponent. You host each match; they join over LAN.' },
}

function ModePicker({ mode, onPick }) {
  return (
    <>
      <div className="segmented stretch" role="group" aria-label="Career type">
        {Object.entries(MODE_INFO).map(([k, m]) => (
          <button key={k} aria-pressed={mode === k} onClick={() => { playButtonSelect(); onPick(k) }}><Icon name={m.icon} size={14} /> {m.label}</button>
        ))}
      </div>
      <p className="muted t-note">{MODE_INFO[mode].line}</p>
    </>
  )
}

/** Clubs bidding for your players while a window is open. */
function OfferInbox({ career }) {
  const rows = inboxOffers(career)
  if (!rows.length) return null
  const store = useCareerStore.getState()
  return (
    <section className="card card-pad" aria-label="Offers for your players">
      <h2 className="saved-h">Offers for your players</h2>
      <ul className="squad-list career-inbox">
        {rows.map(({ slot, player: p, offer }) => (
          <li key={p.id}>
            <span className="squad-name">
              <span className="squad-name-main">{offer.club} want {p.name}</span>
              <small className="squad-stats">{DIVISIONS[offer.level].name} · {money(offer.fee)}{p.wantsAway ? ' · he wants to go' : ''}</small>
            </span>
            <button className="btn btn-gold squad-buy" onClick={() => { if (store.sell(slot, offer.clubId) === true) playConfirm() }}>Accept</button>
            <button className="btn btn-ghost squad-buy" onClick={() => { playButtonSelect(); store.rejectOffer(p.id) }}>Reject</button>
          </li>
        ))}
      </ul>
      <p className="muted t-note">Selling a starter brings your best reserve into his place. If there’s nobody to replace him, the sale can’t go through.</p>
    </section>
  )
}

/** The club's awards for a season. */
function Awards({ awards }) {
  if (!awards || !Object.keys(awards).length) return null
  return (
    <ul className="career-awards">
      {awards.pots && <li>🏅 Player of the season: <b>{awards.pots.name}</b> ({awards.pots.avg})</li>}
      {awards.boot && <li>👟 Top scorer: <b>{awards.boot.name}</b> ({awards.boot.goals} goal{awards.boot.goals === 1 ? '' : 's'})</li>}
      {awards.young && <li>⭐ Young player of the season: <b>{awards.young.name}</b> ({awards.young.avg})</li>}
    </ul>
  )
}

/** Every career you've finished. */
function HallOfFame() {
  const hall = useCareerStore((s) => s.hall)
  if (!hall?.length) return null
  return (
    <section className="card card-pad" aria-label="Hall of Fame">
      <h2 className="saved-h">Hall of Fame</h2>
      <ul className="saved-history">
        {hall.slice(0, 10).map((h, i) => (
          <li key={i}>
            <span />
            <span className="saved-score"><b>{h.club}</b> · {h.seasons} season{h.seasons === 1 ? '' : 's'} · reached the {DIVISIONS[h.best]?.name}</span>
            <span />
            <small className="muted saved-when">{h.promotions} promotion{h.promotions === 1 ? '' : 's'} · {h.titles} title{h.titles === 1 ? '' : 's'} · {h.cups} cup{h.cups === 1 ? '' : 's'} · {h.ended === 'sacked' ? 'Sacked' : 'Retired'} {h.at}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Play a career fixture the way this career is played: solo, or hosting a friend online or over LAN. */
function playCareerFixture(career, kind, fixture) {
  playConfirm()
  const ts = useTournamentStore.getState()
  if (career.mode === 'online') ts.playLanFixture(kind, fixture, ME, 'internet')
  else if (career.mode === 'lan') ts.playLanFixture(kind, fixture, ME, 'lan')
  else ts.playFixture(kind, fixture)
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
  const [squad] = useState(() => startingSquad(Date.now()))
  const [duration, setDuration] = useState(120)
  const [kitOpen, setKitOpen] = useState(false)
  const [mode, setMode] = useState('solo')
  const start = () => {
    playConfirm()
    useCareerStore.getState().start({ ...club, name: club.name.trim() || 'My Club' }, duration, squad, mode)
  }
  return (
    <div className="career-start">
      <section className="card card-pad">
        <h2 className="saved-h">How you’ll play</h2>
        <ModePicker mode={mode} onPick={setMode} />
      </section>
      <section className="card card-pad">
        <h2 className="saved-h">Your club</h2>
        <p className="muted t-note">Start in the {DIVISIONS[0].name} against five computer clubs. Finish in the top {PROMOTED} to go up a division. Finish bottom and you go down. Win the {DIVISIONS[TOP].name} to be champions.</p>
        <div className="career-club">
          <CapPreview config={{ ...club, players: squadSurnames(squad) }} size={96} number={club.numbers?.atk1 ?? 10} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="eyebrow" htmlFor="career-name" style={{ display: 'block', marginBottom: 6 }}>Club name</label>
            <input id="career-name" className="field" value={club.name} maxLength={TEAM_NAME_MAX} onChange={(e) => setClub({ ...club, name: e.target.value })} />
          </div>
        </div>
        <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Kit</div>
        <p className="muted t-note">Pick a design, or open Edit team for colours, pattern, badge, text and squad numbers. Your club keeps this kit all season — you can change it again before the next season kicks off.</p>
        <button className="btn btn-secondary btn-block" style={{ margin: '8px 0 10px' }} onClick={() => { playButtonSelect(); setKitOpen(true) }}><Icon name="settings" size={18} /> Edit team</button>
        <CapDesigns config={club} onPick={(patch) => setClub({ ...club, ...patch })} />
        <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Time per half</div>
        <div className="segmented stretch" role="group" aria-label="Time per half">
          {MATCH_DURATIONS.map((d) => (
            <button key={d} aria-pressed={duration === d} onClick={() => { playButtonSelect(); setDuration(d) }}>{formatClock(d)}</button>
          ))}
        </div>
      </section>
      <button className="btn btn-gold btn-lg btn-block" onClick={start} onMouseEnter={playHoverTick}><Icon name="play" size={20} /> Start career</button>
      {kitOpen && <KitEditor team={club} withName squadNames={squadSurnames(squad)} onUpdate={(patch) => setClub((c) => ({ ...c, ...patch }))} onClose={() => setKitOpen(false)} />}
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
  // Shown while saving and for a few seconds after; an error stays until it's sorted
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (saving || error) { setVisible(true); return undefined }
    if (!savedAt) return undefined
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(timer)
  }, [savedAt, saving, error])
  if (!visible) return null
  return (
    <div className="career-save" role="status" data-error={error ? 'true' : undefined}>
      <Icon name="check" size={16} />
      <span>{saving ? 'Saving…' : `Saved to ${username}${savedAt ? ` · ${timeAgo(savedAt)}` : ''}`}{error ? ` — ${error}` : ''}</span>
      {error && <button className="btn btn-ghost" onClick={() => { playButtonSelect(); useAccountStore.getState().save({ force: true }) }} disabled={saving}>Try again</button>}
    </div>
  )
}

function Ladder({ level, promotions, titles, cups = 0 }) {
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
      <p className="muted t-note">{promotions} promotion{promotions === 1 ? '' : 's'} · {titles} title{titles === 1 ? '' : 's'} · {cups} {CUP_NAME}{cups === 1 ? '' : 's'}</p>
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
  const met = career.target ? targetMet(career.target, pos, count) : false
  const cup = cupRun(career.cup?.tournament)
  const waitingCup = cupPending(career)
  const bonus = seasonBonus(outcome) + (met ? TARGET_BONUS[career.target] : 0) + (cup ? CUP_PRIZE[cup] : 0)
  const doomed = career.target && !met && career.warning
  const warned = career.target && !met && !career.warning
  return (
    <section className="card card-pad career-end" data-tone={doomed ? 'bad' : o.tone}>
      <div className="eyebrow">Season {career.season} · {DIVISIONS[career.level].name}</div>
      <h2 className="display career-end-title">{o.title}</h2>
      <p className="career-end-pos">Finished <b>{ordinal(pos)}</b> of {count}{row ? ` · ${row.w}W ${row.d}D ${row.l}L · ${row.pts} pts` : ''}</p>
      <p className="muted">{o.line(DIVISIONS[nextLevel].name)}</p>
      {career.target && <p className="career-target-line" data-met={met ? 'true' : undefined}>Board target: {TARGETS[career.target]} · <b>{met ? 'Met' : 'Missed'}</b></p>}
      <Awards awards={seasonAwards(career)} />
      {cup && <p className="career-target-line">{CUP_NAME}: <b>{cup === 'won' ? 'Winners!' : cup === 'final' ? 'Runners-up' : cup === 'semi' ? 'Semi-finals' : 'Quarter-finals'}</b></p>}
      {warned && <p className="t-note career-warning"><b>Final warning.</b> The board isn’t happy. Miss next season’s target too and you’re sacked.</p>}
      {doomed
        ? <p className="t-note">You missed the board’s target again, on a final warning. They want to see you.</p>
        : <p className="muted">Season bonus: <b>{money(bonus)}</b>. Over the summer young players improve, older ones slow down, and veterans may retire. The transfer window opens before the new season.</p>}
      {waitingCup ? (
        <p className="t-note" role="status">Play your {CUP_NAME} tie first; the season ends once you’re out or it’s won.</p>
      ) : doomed ? (
        <button className="btn btn-danger btn-lg btn-block" onClick={() => { playConfirm(); useCareerStore.getState().nextSeason() }}>Meet the board</button>
      ) : (
        <button className="btn btn-gold btn-lg btn-block" onClick={() => { playConfirm(); useCareerStore.getState().nextSeason() }}>
          <Icon name="next" size={20} /> Start season {career.season + 1}
        </button>
      )}
    </section>
  )
}

/** The board has sacked you: the career's record, and a fresh start. */
function Sacked({ career, onBack }) {
  const s = career.sacked
  const best = Math.max(...career.past.map((p) => p.level ?? 0), career.level)
  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head">
          <div>
            <div className="eyebrow shell-eyebrow">Career over · {career.club.name}</div>
            <h1 className="display shell-title">Sacked</h1>
          </div>
        </header>
        <main className="shell-body career-start">
          <section className="card card-pad career-end" data-tone="bad">
            <div className="eyebrow">Season {s.season} · {s.division}</div>
            <h2 className="display career-end-title">The board has sacked you</h2>
            <p className="t-note">You finished <b>{ordinal(s.position)}</b>. The board wanted: <b>{TARGETS[s.target]}</b>.</p>
            <ul className="club-lines">
              <li><span>Seasons in charge</span><b>{career.past.length}</b></li>
              <li><span>Promotions</span><b>{career.promotions}</b></li>
              <li><span>Titles</span><b>{career.titles}</b></li>
              <li><span>{CUP_NAME}s</span><b>{career.cups || 0}</b></li>
              <li><span>Highest division</span><b>{DIVISIONS[best].name}</b></li>
            </ul>
            <button className="btn btn-gold btn-lg btn-block" onClick={() => { playConfirm(); useCareerStore.getState().retire() }}>Start a new career</button>
          </section>
          {career.past.length > 0 && (
            <section className="card card-pad">
              <h2 className="saved-h">Your seasons</h2>
              <ul className="saved-history">
                {career.past.slice(0, 10).map((p) => (
                  <li key={p.season}>
                    <span />
                    <span className="saved-score">Season {p.season} · {p.division} · <b>{ordinal(p.position)}</b></span>
                    <span />
                    <small className="muted saved-when">{p.sacked ? 'Sacked' : OUTCOME[p.outcome]?.title || ''}{p.record ? ` · ${p.record.w}W ${p.record.d}D ${p.record.l}L` : ''}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
        <footer className="shell-foot"><div className="shell-foot-inner">
          <button className="btn btn-secondary" onClick={onBack}><Icon name="back" size={18} /> Menu</button>
        </div></footer>
      </div>
    </div>
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
  const [guide, setGuide] = useState(false)
  // Career mode is a set of pages: a home with the next match and a menu, then Squad, Transfers...
  const [page, setPage] = useState('home')
  const mainRef = useRef(null)
  // After a match: open its report first
  const reportId = career?.lastMatch && !career.lastMatch.seen ? career.lastMatch.fixtureId : null
  useEffect(() => { if (reportId) setPage('report') }, [reportId])
  // Each page opens at its top: reset every scrolling box up from the page
  const go = (next) => {
    playButtonSelect()
    setPage(next)
    requestAnimationFrame(() => {
      for (let el = mainRef.current; el; el = el.parentElement) if (el.scrollTop) el.scrollTop = 0
      document.scrollingElement && (document.scrollingElement.scrollTop = 0)
    })
  }

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
              <h1 className="display shell-title">{isLagos() ? 'Lagos Life sign-in' : 'Create your account'}</h1>
            </div>
          </header>
          <main className="shell-body career-start">
            <section className="card card-pad">
              {!isLagos() && <p className="t-note">Your career is saved to your account as you play — every season, result and trophy — so you can pick it up on any phone. It only takes a username and a password.</p>}
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
          <main className="shell-body"><StartCareer /><HallOfFame /></main>
          <footer className="shell-foot"><div className="shell-foot-inner">
            <button className="btn btn-secondary" onClick={back}><Icon name="back" size={18} /> Menu</button>
          </div></footer>
        </div>
      </div>
    )
  }

  if (career.sacked) return <Sacked career={career} onBack={back} />

  const league = career.league
  const division = DIVISIONS[career.level]
  // One calendar: a cup tie on its date is played before the league carries on
  const due = careerNext(career)
  const leagueNext = nextMatch(league)
  const next = due?.kind === 'league' ? due.fixture : null
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
  const play = () => playCareerFixture(career, 'career', next)
  // Overall ratings: yours against this opponent's
  const myOvr = averageRating(squadRatings(career.squad))
  const ovrOf = (team, level = career.level) => (team ? opponentOvr(career, team.name, level) : 0)
  const theirOvr = ovrOf(opponent)
  const MATCHUP = { favourite: 'Favourites', even: 'Evenly matched', underdog: 'Underdogs' }
  // The Cap Cup
  const tie = due?.kind === 'cup' ? due.fixture : null
  const cupT = career.cup?.tournament
  const cupUpcoming = cupNext(career)
  const cupOut = cupRun(cupT)
  const cupOpp = tie ? teamById(cupT, tie.home === ME ? tie.away : tie.home) : null
  const cupOppOvr = cupOpp ? ovrOf(cupOpp, career.cup.levels?.[cupOpp.id] ?? career.level) : 0
  const cupRoundName = (t) => roundName(t.round, cupT.rounds.length)
  const pos = myPosition(league)
  // Where your squad ranks on OVR among the division's clubs (what the board judges you on)
  const squadRank = 1 + league.teams.filter((t) => t.cpu && ovrOf(t) > myOvr).length

  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head">
          <div className="career-head">
            <div className="eyebrow shell-eyebrow">{MODE_INFO[career.mode || 'solo'].label} career · Season {career.season} · {division.name}</div>
            <div className="career-title-row">
              <CapPreview config={{ ...career.club, players: squadSurnames(career.squad) }} size={46} />
              <h1 className="display shell-title">{career.club.name}</h1>
            </div>
            <small className="career-rep">Manager: {repLabel(career.rep ?? REP_START)} · {career.rep ?? REP_START}</small>
          </div>
        </header>

        <main className="shell-body career-body" ref={mainRef}>
          {page === 'home' ? (
            <div className="career-col career-home">
          <SaveBar />
          {career.target && !done && played === 0 && (
            <section className="card card-pad career-board" aria-label="The board’s target">
              <div className="eyebrow">Season {career.season} · the board</div>
              <h2 className="saved-h">{TARGETS[career.target]}</h2>
              {career.warning
                ? <p className="t-note career-warning"><b>Final warning.</b> You missed last season’s target. Miss this one and the board sacks you: your career ends and you start again.</p>
                : <p className="t-note">Miss it and you get a final warning; miss again and you’re sacked. Meet it for a <b>{money(TARGET_BONUS[career.target])}</b> bonus.</p>}
              <p className="muted t-note">Your squad’s OVR of <b>{myOvr}</b> ranks <b>{ordinal(squadRank)}</b> of {count} in the {division.name}.{squadRank > PROMOTED && career.target === 'promotion' ? ' Strengthen it in the transfer market before matchday 1.' : ''}</p>
            </section>
          )}
          {done ? <SeasonEnd career={career} /> : next && (
            <section className="card card-pad career-next">
              <div className="eyebrow">Matchday {played + 1} of {fixtures.length} · {next.home === ME ? 'Home' : 'Away'}</div>
              <div className="career-vs">
                <TeamTag team={teamById(league, ME)} size={34} strong />
                <span className="vs-badge">VS</span>
                <TeamTag team={opponent} size={34} strong mirror />
              </div>
              <div className="career-ovr" data-matchup={matchupOf(myOvr, theirOvr)}>
                <span><b>{myOvr}</b><small>OVR</small></span>
                <span className="career-ovr-word">{MATCHUP[matchupOf(myOvr, theirOvr)]}</span>
                <span><b>{theirOvr}</b><small>OVR</small></span>
              </div>
              <button className="btn btn-gold btn-lg btn-block" onClick={play} onMouseEnter={playHoverTick}>
                <Icon name={MODE_INFO[career.mode || 'solo'].icon} size={20} /> {career.mode === 'online' ? 'Play your friend online' : career.mode === 'lan' ? 'Play your friend over LAN' : 'Play match'}
              </button>
              <p className="muted t-note">{career.mode === 'online' || career.mode === 'lan'
                ? 'Your friend plays the opposition and joins from their phone. The result saves to your career on this device.'
                : `Computer level: ${career.difficulty && career.difficulty !== 'auto' ? career.difficulty : division.difficulty}.`} Other clubs’ games play out by themselves.</p>
            </section>
          )}

          {tie && (
            <section className="card card-pad career-next career-cup" aria-label={CUP_NAME}>
              <div className="eyebrow">{CUP_NAME} · {cupRoundName(tie)}</div>
              <div className="career-vs">
                <TeamTag team={teamById(cupT, ME)} size={30} strong />
                <span className="vs-badge">VS</span>
                <TeamTag team={cupOpp} size={30} strong mirror />
              </div>
              <div className="career-ovr" data-matchup={matchupOf(myOvr, cupOppOvr)}>
                <span><b>{myOvr}</b><small>OVR</small></span>
                <span className="career-ovr-word">{MATCHUP[matchupOf(myOvr, cupOppOvr)]}{(career.cup.levels?.[cupOpp?.id] ?? career.level) !== career.level ? ` · ${DIVISIONS[career.cup.levels[cupOpp.id]].name}` : ''}</span>
                <span><b>{cupOppOvr}</b><small>OVR</small></span>
              </div>
              <button className="btn btn-purple btn-lg btn-block" onClick={() => playCareerFixture(career, 'careerCup', tie)}><Icon name="trophy" size={20} /> {career.mode === 'solo' || !career.mode ? 'Play cup tie' : 'Play your friend in the cup'}</button>
              <p className="muted t-note">Knockout: a draw goes to penalties.</p>
              {leagueNext && !done && (
                <p className="muted t-note">Next in the league, after this tie: matchday {played + 1} v <b>{teamById(league, leagueNext.home === ME ? leagueNext.away : leagueNext.home)?.name}</b>.</p>
              )}
            </section>
          )}

          {!tie && cupT && (
            <button className="career-strip career-cup-link" onClick={() => go('cup')}>
              <Icon name="trophy" size={14} />
              <span>{CUP_NAME}: {cupT.championId === ME ? 'Winners this season!' : cupOut ? `out in the ${cupOut === 'final' ? 'final' : cupOut === 'semi' ? 'semi-finals' : 'quarter-finals'}` : cupUpcoming
                ? <>{cupRoundName(cupUpcoming.tie)} v <b>{teamById(cupT, cupUpcoming.tie.home === ME ? cupUpcoming.tie.away : cupUpcoming.tie.home)?.name || 'TBD'}</b> · after league matchday {cupUpcoming.opensAfter}</>
                : 'waiting for the draw'}</span>
              <span className="career-cup-more">View cup <Icon name="next" size={14} /></span>
            </button>
          )}

          {career.target && !done && played > 0 && (
            <p className="career-strip" data-met={targetMet(career.target, pos, count) ? 'true' : undefined}>
              Board target: <b>{TARGETS[career.target]}</b> · now {ordinal(pos)}{career.warning ? ' · final warning' : ''}
            </p>
          )}

          <nav className="career-menu" aria-label="Career pages">
            {[
              { key: 'squad', icon: 'users', title: 'Squad', line: `${squadSize(career)}/${MAX_SQUAD} players · OVR ${myOvr}` },
              { key: 'transfers', icon: 'next', title: 'Transfers', line: `${transferWindow(career) ? 'Window open' : 'Window shut'}${inboxOffers(career).length ? ` · ${inboxOffers(career).length} offer${inboxOffers(career).length === 1 ? '' : 's'}` : ''}` },
              { key: 'youth', icon: 'ball', title: 'Youth team', line: `${(career.youthTeam || []).length} player${(career.youthTeam || []).length === 1 ? '' : 's'}` },
              { key: 'club', icon: 'cpu', title: 'Club', line: `${money(career.coins)} · ${(career.biz?.fans ?? 0).toLocaleString('en-NG')} fans` },
              { key: 'cup', icon: 'trophy', title: CUP_NAME, line: cupT?.championId === ME ? 'Winners!' : cupOut ? 'Knocked out' : tie ? `${cupRoundName(tie)} · ready to play` : cupUpcoming ? `${cupRoundName(cupUpcoming.tie)} · after matchday ${cupUpcoming.opensAfter}` : 'The draw' },
              { key: 'league', icon: 'menu', title: 'League', line: `${ordinal(pos)} of ${count} · ${division.name}` },
              { key: 'history', icon: 'restart', title: 'History', line: `${career.past.length} season${career.past.length === 1 ? '' : 's'} · ${career.promotions} promotion${career.promotions === 1 ? '' : 's'}` },
              { key: 'settings', icon: 'settings', title: 'Settings', line: 'Kit, match time, difficulty' },
              ...(career.lastMatch ? [{ key: 'report', icon: 'ball', title: 'Last match', line: `${teamById(career.lastMatch.competition === 'cup' ? career.cup?.tournament || league : league, career.lastMatch.home)?.name || ''} ${career.lastMatch.result.home}–${career.lastMatch.result.away} ${teamById(career.lastMatch.competition === 'cup' ? career.cup?.tournament || league : league, career.lastMatch.away)?.name || ''}` }] : []),
            ].map((t) => (
              <button key={t.key} className="career-tile" onClick={() => go(t.key)}>
                <Icon name={t.icon} size={22} />
                <span className="career-tile-title">{t.title}</span>
                <small>{t.line}</small>
              </button>
            ))}
          </nav>

          {career.lastSummer?.season === career.season && played === 0 && (career.lastSummer.retired.length > 0 || career.lastSummer.changes.length > 0 || career.lastSummer.youthIn?.length > 0 || career.lastSummer.world?.length > 0 || career.lastSummer.left?.length > 0) && (
            <section className="card card-pad" aria-label="Summer news">
              <h2 className="saved-h">Over the summer</h2>
              <ul className="career-summer">
                {career.lastSummer.retired.map((r) => <li key={`r${r.role}`}><b>{r.name}</b> retired at {r.age}. {r.left ? 'His place in the reserves is free.' : 'A youth player comes in.'}</li>)}
                {career.lastSummer.changes.map((c) => <li key={`c${c.role}`} data-up={c.to > c.from ? 'true' : undefined}>{c.name}: {c.from} → <b>{c.to}</b></li>)}
                {(career.lastSummer.loansBack || []).map((p) => <li key={`l${p.name}`}><b>{p.name}</b> is back from loan, now {p.rating}.</li>)}
                {(career.lastSummer.youthIn || []).map((p) => <li key={`y${p.name}`} data-up="true">Academy: <b>{p.name}</b> ({p.pos}, {p.rating}) joins the youth team.</li>)}
                {(career.lastSummer.youthOut || []).map((p) => <li key={`o${p.name}`}><b>{p.name}</b> turned 19 and left the youth team.</li>)}
                {(career.lastSummer.left || []).map((n) => <li key={`x${n}`}><b>{n}</b>’s contract ran out; he has left on a free.</li>)}
                {(career.lastSummer.unhappy || []).map((n) => <li key={`u${n}`}><b>{n}</b> is unhappy and wants to leave.</li>)}
              </ul>
              {(career.lastSummer.world || []).length > 0 && <h3 className="squad-sub-h">Around the leagues</h3>}
              <ul className="career-summer">
                {(career.lastSummer.world || []).map((n, i) => (
                  <li key={`w${i}`}>{n.type === 'transfer'
                    ? <><b>{n.name}</b> ({n.ovr}) {n.from ? `${n.from} → ${n.to}` : `signs for ${n.to} on a free`}{n.fee ? `, ${money(n.fee)}` : ''}</>
                    : <><b>{n.name}</b> of {n.club} retires at {n.age}.</>}</li>
                ))}
              </ul>
            </section>
          )}

          <OfferInbox career={career} />

            </div>
          ) : (
            <div className="career-col career-page">
              <div className="career-page-head">
                <button className="btn btn-ghost career-back" onClick={() => { if (page === 'report') useCareerStore.getState().reportSeen(); go('home') }}><Icon name="back" size={16} /> Career</button>
                <h2 className="display career-page-title">{PAGE_TITLE[page]}</h2>
              </div>
              {page === 'report' && <MatchReport career={career} onDone={() => { useCareerStore.getState().reportSeen(); go('home') }} />}
              {page === 'squad' && <>
                {played > 0 && <PlayerRatings career={career} />}
                <SquadPanel career={career} show="squad" />
              </>}
              {page === 'transfers' && <>
                <OfferInbox career={career} />
                <SquadPanel career={career} show="transfers" />
              </>}
              {page === 'youth' && <SquadPanel career={career} show="youth" />}
              {page === 'cup' && <CupPage career={career} myOvr={myOvr} onPlay={(t) => playCareerFixture(career, 'careerCup', t)} />}
              {page === 'club' && <><BoardObjectives career={career} /><ClubPanel career={career} /></>}
              {page === 'league' && <>
          <section className="card card-pad">
            <h2 className="saved-h">{division.name} table</h2>
            <Table t={league} mine={[ME]} zoneOf={zoneOf} />
            <p className="muted t-note career-key">
              {career.level < TOP ? <><i className="career-dot up" /> Promotion</> : <><i className="career-dot up" /> Champions</>}
              {career.level > 0 && <> <i className="career-dot down" /> Relegation</>}
            </p>
          </section>

                <LeagueClubs career={career} />
                <Ladder level={career.level} promotions={career.promotions} titles={career.titles} cups={career.cups} />
              </>}
              {page === 'history' && <>
          {career.past.length > 0 && (
            <section className="card card-pad">
              <h2 className="saved-h">Past seasons</h2>
              <ul className="saved-history">
                {career.past.slice(0, 20).map((p) => (
                  <li key={p.season}>
                    <span />
                    <span className="saved-score">Season {p.season} · {p.division} · <b>{ordinal(p.position)}</b></span>
                    <span />
                    <small className="muted saved-when">{p.sacked ? 'Sacked' : OUTCOME[p.outcome]?.title || ''}{p.record ? ` · ${p.record.w}W ${p.record.d}D ${p.record.l}L` : ''}{p.warned ? ' · final warning' : ''}</small>
                    {p.awards && <Awards awards={p.awards} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

                {career.past.length === 0 && <p className="muted t-note">Your finished seasons, with each season’s awards, will be listed here.</p>}
                <HallOfFame />
              </>}
              {page === 'settings' && <>
          <section className="card card-pad career-kit-card">
            <CapPreview config={{ ...career.club, players: squadSurnames(career.squad) }} size={64} number={career.club.numbers?.atk1 ?? 10} />
            <div>
              <h2 className="saved-h">Your team</h2>
              {kitOpen
                ? <p className="muted t-note">The new season hasn’t kicked off yet — you can change your name, kit and squad numbers now. They’re locked once matchday 1 is played.</p>
                : <p className="muted t-note"><Icon name="lock" size={13} /> Name, kit and numbers are locked for this season. Change them before next season starts.</p>}
            </div>
            {kitOpen && <button className="btn btn-secondary" onClick={() => { playButtonSelect(); setEditing(true) }}>Edit team</button>}
          </section>
                <section className="card card-pad" aria-label="Match settings">
                  <h2 className="saved-h">Match settings</h2>
                  <div className="eyebrow" style={{ margin: '8px 0' }}>Time per half</div>
                  <div className="segmented stretch" role="group" aria-label="Time per half">
                    {MATCH_DURATIONS.map((d) => (
                      <button key={d} aria-pressed={career.matchDuration === d} onClick={() => { playButtonSelect(); useCareerStore.getState().setSettings({ matchDuration: d }) }}>{formatClock(d)}</button>
                    ))}
                  </div>
                  <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Computer difficulty</div>
                  <div className="segmented stretch" role="group" aria-label="Computer difficulty">
                    {[['auto', 'By division'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([k, label]) => (
                      <button key={k} aria-pressed={(career.difficulty || 'auto') === k} onClick={() => { playButtonSelect(); useCareerStore.getState().setSettings({ difficulty: k }) }}>{label}</button>
                    ))}
                  </div>
                  <p className="muted t-note">{(career.difficulty || 'auto') === 'auto'
                    ? `By division: the computer gets harder as you climb (${division.difficulty} in the ${division.name}).`
                    : `Every computer club plays at ${career.difficulty} level.`} Changes apply from your next match.</p>
                </section>
                <button className="btn btn-secondary btn-block" onClick={() => { playButtonSelect(); setGuide(true) }}><Icon name="help" size={16} /> How career mode works</button>
                <button className="btn btn-ghost btn-block" onClick={() => { playButtonSelect(); setConfirmRetire(true) }}>Retire and start again</button>
              </>}
            </div>
          )}
        </main>

        <footer className="shell-foot"><div className="shell-foot-inner">
          {page === 'home'
            ? <button className="btn btn-secondary" onClick={back}><Icon name="back" size={18} /> Menu</button>
            : <button className="btn btn-secondary" onClick={() => { if (page === 'report') useCareerStore.getState().reportSeen(); go('home') }}><Icon name="back" size={18} /> Career home</button>}
        </div></footer>
      </div>

      {editing && kitOpen && (
        <KitEditor
          team={career.club}
          squadNames={squadSurnames(career.squad)}
          withName
          onUpdate={(patch) => useCareerStore.getState().updateClub(patch)}
          onClose={() => setEditing(false)}
        />
      )}
      {guide && <RatingsGuide onClose={() => setGuide(false)} />}
      {confirmRetire && (
        <Modal title="Retire?" onClose={() => setConfirmRetire(false)}>
          <p>This ends {career.club.name}’s career for good: season {career.season}, {career.promotions} promotions, {career.titles} titles and {career.cups || 0} {CUP_NAME}s.</p>
          <button className="btn btn-danger btn-block" onClick={() => { playButtonSelect(); useCareerStore.getState().retire(); setConfirmRetire(false) }}>Retire</button>
          <button className="btn btn-secondary btn-block" onClick={() => setConfirmRetire(false)}>Keep playing</button>
        </Modal>
      )}
    </div>
  )
}
