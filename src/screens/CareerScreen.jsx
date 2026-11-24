import SeasonOverview, { FormLine } from '../ui/SeasonOverview'
import { fixtureBrief } from '../game/careerBrief'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useMatchStore, SCREEN, MATCH_DURATIONS } from '../state/MatchStore'
import { useCareerStore } from '../state/careerStore'
import { useTournamentStore } from '../state/tournamentStore'
import { cclPending, DIVISIONS, TOP, PROMOTED, RELEGATED, ME, LEGS, opponentOvr, careerNext, careerDate, cupDate, leagueDate, formatGameDate, seasonOver, myPosition, outcomeFor, cupNext, cupRun, cupPending, CUP_NAME, CUP_PRIZE, TARGETS, TARGET_BONUS, targetMet } from '../game/career'
import { teamById, allFixtures, standings, roundName } from '../game/tournament'
import { formatClock } from '../game/rules'
import { TEAM_NAME_MAX, RARE_DESIGNS, designPatch, isDesign } from '../data/TeamOptions'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'
import { Table } from './TournamentHubScreen'
import { KitEditor } from './TournamentSetupScreen'
import { TeamTag } from '../ui/TournamentBits'
import CapPreview from '../ui/CapPreview'
import CapDesigns, { PLAIN } from '../ui/CapDesigns'
import ColorPicker from '../ui/ColorPicker'
import { useCapDesigns } from '../game/capOverrides'
import { SHOP_DESIGNS } from '../data/shop'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import AccountPanel from '../ui/AccountPanel'
import { useAccountStore } from '../state/accountStore'
import { isLagos } from '../platform'
import SquadPanel, { PlayerRatings } from '../ui/SquadPanel'
import { seasonBonus, startingSquad, squadSurnames, squadRatings, averageRating, matchupOf, money, START_COINS } from '../game/squad'
import LeagueClubs from '../ui/LeagueClubs'
import TransferMarket from '../ui/TransferMarket'
import MatchReport from '../ui/MatchReport'
import CupPage from '../ui/CupPage'
import { inboxOffers, seasonAwards } from '../game/clubLife'
import { SeasonNumbers, SummerReview } from '../ui/SeasonReview'
import { JobOfferCard } from '../ui/JobOffer'
import { IntroButton } from '../ui/ModeIntro'
import { CclMatchCard, CclPanel } from '../ui/ChampionsLeague'
import { isDerby, derbyName, headToHead, DERBY_PRIZE } from '../game/rivals'
import '../ui/careerSeason.css'
import RatingsGuide from '../ui/RatingsGuide'
import ClubPanel, { CLUB_PAGES } from '../ui/ClubPanel'

/** Pages reached from the More tab. */
const MORE_PAGES = ['more', 'youth', 'league', 'cup', 'history', 'settings']

const PAGE_TITLE = { ...CLUB_PAGES, more: 'More', cup: 'Cap Cup', report: 'Match report', squad: 'Squad', transfers: 'Transfers', youth: 'Youth team', club: 'Club', league: 'League', history: 'History', settings: 'Settings' }

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
  // Inside Lagos Life there's no playing a friend yet: those careers play the computer meanwhile
  const mode = isLagos() ? 'solo' : career.mode
  if (mode === 'online') ts.playLanFixture(kind, fixture, ME, 'internet')
  else if (mode === 'lan') ts.playLanFixture(kind, fixture, ME, 'lan')
  else ts.playFixture(kind, fixture)
}

/** The club's starting kit: the player's own team 1 kit, under their club name. */
function startingKit(teamConfig) {
  const own = teamConfig.team1
  return {
    name: own.name && own.name !== 'Team 1' ? own.name : 'My Club',
    primary: own.primary, edge: own.edge, badge: own.badge, pattern: own.pattern, finish: own.finish,
    capText: own.capText || '', textColor: own.textColor || '', skirtColor: own.skirtColor || '', numbers: own.numbers,
    art: own.art || '', bands: own.bands || {}, capNames: own.capNames || 'player',
  }
}

const STEP_TITLES = ['Start your career', 'Your club', 'Ready?']
/** The look of a cap (not its name or numbers). */
const LOOK = ['primary', 'edge', 'pattern', 'badge', 'finish', 'capText', 'textColor', 'skirtColor', 'art']
const pickLook = (c) => Object.fromEntries(LOOK.map((k) => [k, c[k] ?? '']))
const DESIGN_TABS = [['free', 'Free'], ['earn', 'Earn'], ['lagos', 'Lagos'], ['colours', 'Colours']]
const QUICK_PICKS = 7 // after "Your own"

/** "All designs & colours": the cap picker split into tabs, so nothing is one long scroll. */
function KitSheet({ club, onPick, onCustom, onClose }) {
  const tabs = DESIGN_TABS.filter(([k]) => k !== 'lagos' || isLagos())
  const [tab, setTab] = useState('free')
  return (
    <Modal title="Kit designs" onClose={onClose} footer={<button className="btn btn-gold btn-block" onClick={() => { playConfirm(); onClose() }}>Done <Icon name="check" size={18} /></button>}>
      <div className="segmented stretch csu-tabs" role="tablist" aria-label="Kit designs">
        {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => { playButtonSelect(); setTab(k) }}>{label}</button>)}
      </div>
      <div className="t-kit-preview"><CapPreview config={club} size={96} number={club.numbers?.atk1 ?? 10} /></div>
      {tab === 'colours' ? (
        <div className="csu-colours">
          <ColorPicker label="Top colour" value={club.primary} onPick={(c) => onPick({ primary: c || club.primary })} />
          <ColorPicker label="Pattern & ring colour" value={club.edge} onPick={(c) => onPick({ edge: c || club.edge })} />
          <button className="btn btn-secondary btn-block" onClick={() => { playButtonSelect(); onCustom() }}><Icon name="settings" size={18} /> More: pattern, badge, text, numbers</button>
        </div>
      ) : <CapDesigns config={club} onPick={onPick} section={tab} onCustom={tab === 'free' ? onCustom : null} />}
    </Modal>
  )
}

/** Starting a career, in three short steps: how you'll play, your club, then go. */
function CareerSetup({ onMenu }) {
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const [club, setClub] = useState(() => startingKit(teamConfig))
  const [squad] = useState(() => startingSquad(Date.now()))
  const [duration, setDuration] = useState(120)
  const [mode, setMode] = useState('solo')
  const [step, setStep] = useState(0)
  const [sheet, setSheet] = useState(false)
  const [maker, setMaker] = useState(false)
  const designs = useCapDesigns()
  const bodyRef = useRef(null)
  useLayoutEffect(() => { for (let el = bodyRef.current; el; el = el.parentElement) el.scrollTop = 0 }, [step])
  const name = club.name.trim() || 'My Club'
  const caps = { ...club, players: squadSurnames(squad) }
  // The last cap you made yourself, so "Your own" still shows it after trying a ready-made design
  const [own, setOwn] = useState(null)
  const pick = (patch) => setClub((c) => {
    if (![...designs, ...RARE_DESIGNS, ...SHOP_DESIGNS].some((d) => isDesign(c, d))) setOwn(c)
    return { ...c, ...patch }
  })
  const openMaker = () => {
    setSheet(false)
    // Back to the cap you made, if you'd tried a ready-made one since
    if (own && [...designs, ...RARE_DESIGNS, ...SHOP_DESIGNS].some((d) => isDesign(club, d))) setClub((c) => ({ ...c, ...pickLook(own) }))
    setMaker(true)
  }
  const start = () => {
    playConfirm()
    useCareerStore.getState().start({ ...club, name }, duration, squad, mode)
  }
  const next = () => { playConfirm(); setStep((n) => n + 1) }
  const prev = () => { playButtonSelect(); if (step === 0) onMenu(); else setStep((n) => n - 1) }
  // The quick picks: "Your own", the first drink caps, and whatever's on now if it's from further in
  const quick = designs.slice(0, QUICK_PICKS)
  const onNow = [...designs, ...RARE_DESIGNS, ...SHOP_DESIGNS].find((d) => isDesign(club, d))
  if (onNow && !quick.includes(onNow)) quick.splice(QUICK_PICKS - 1, 1, onNow)
  // A plain cap is where your own starts, so it counts as yours
  const isCustom = !onNow
  const seasonMatches = DIVISIONS[0].clubs.length * LEGS
  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head">
          <div>
            <div className="eyebrow shell-eyebrow">Career mode · step {step + 1} of 3</div>
            <h1 className="display shell-title">{STEP_TITLES[step]}</h1>
          </div>
          {step === 0 && <IntroButton mode="career" />}
        </header>
        <div className="csu-progress" aria-hidden>{STEP_TITLES.map((t, i) => <i key={t} data-on={i <= step ? 'true' : undefined} />)}</div>
        <main className="shell-body career-start csu" ref={bodyRef}>
          {step === 0 && (
            <>
              <div className="eyebrow">How will you play?</div>
              <div className="csu-modes" role="radiogroup" aria-label="Career type">
                {Object.entries(MODE_INFO).map(([k, m]) => {
                  // Inside Lagos Life, careers with a friend wait until Lagos Life opens matches between players
                  const off = isLagos() && k !== 'solo'
                  return (
                    <button key={k} role="radio" aria-checked={mode === k} aria-disabled={off ? 'true' : undefined} className="csu-mode" data-off={off ? 'true' : undefined} onClick={() => { if (off) return; playButtonSelect(); setMode(k) }}>
                      <span className="csu-mode-ic"><Icon name={m.icon} size={24} /></span>
                      <span><b>{m.label}{off ? ' · soon' : ''}</b><small>{off ? 'Playing a friend opens when Lagos Life turns on matches between players.' : m.line}</small></span>
                    </button>
                  )
                })}
              </div>
              <section className="csu-ladder" aria-label="The ladder">
                <b>The ladder</b>
                <ol>{DIVISIONS.map((d, i) => <li key={d.name} data-start={i === 0 ? 'true' : undefined}>{d.name}{i === 0 ? ' (you start here)' : ''}</li>)}</ol>
                <p>{DIVISIONS[0].clubs.length + 1} clubs a division. Top {PROMOTED} go up, bottom {RELEGATED} go down. Win the {DIVISIONS[TOP].name} to be champions.</p>
              </section>
              <HallOfFame />
            </>
          )}
          {step === 1 && (
            <>
              <div className="csu-cap"><CapPreview config={caps} size={132} number={club.numbers?.atk1 ?? 10} /></div>
              <label className="eyebrow" htmlFor="career-name">Club name</label>
              <input id="career-name" className="field csu-name" value={club.name} maxLength={TEAM_NAME_MAX} onChange={(e) => pick({ name: e.target.value })} />
              <div className="eyebrow">Kit</div>
              <div className="cap-designs csu-quick" role="group" aria-label="Kit">
                <button className="cap-design cap-design-own" aria-pressed={isCustom} onClick={() => { playButtonSelect(); openMaker() }}>
                  <span className="cap-design-art"><CapPreview config={isCustom ? club : own ? { ...club, ...pickLook(own) } : { ...club, ...designPatch(PLAIN) }} size={58} /><span className="cap-design-edit" aria-hidden>✎</span></span>
                  <span>Your own</span>
                </button>
                {quick.map((d) => (
                  <button key={d.key} className="cap-design" aria-pressed={isDesign(club, d)} onClick={() => { playButtonSelect(); pick(designPatch(d)) }}>
                    <CapPreview config={d} size={58} />
                    <span>{d.name}</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary btn-block csu-more" onClick={() => { playButtonSelect(); setSheet(true) }}>All designs &amp; colours <Icon name="next" size={16} /></button>
              <p className="muted t-note">Your club keeps this kit all season. You can change it again before the next season.</p>
            </>
          )}
          {step === 2 && (
            <>
              <section className="csu-summary">
                <CapPreview config={caps} size={72} number={club.numbers?.atk1 ?? 10} />
                <div><b className="display">{name}</b><small>{MODE_INFO[mode].label} · {DIVISIONS[0].name} · Season 1</small></div>
              </section>
              <div className="eyebrow">Time per half</div>
              <div className="segmented stretch" role="group" aria-label="Time per half">
                {MATCH_DURATIONS.map((d) => (
                  <button key={d} aria-pressed={duration === d} onClick={() => { playButtonSelect(); setDuration(d) }}>{formatClock(d)}</button>
                ))}
              </div>
              <div className="csu-facts">
                <div className="csu-fact"><small>Season</small><b>{seasonMatches} league matches</b></div>
                <div className="csu-fact"><small>Your goal</small><b>Top {PROMOTED} to go up</b></div>
                <div className="csu-fact"><small>Budget</small><b>{money(START_COINS)}</b></div>
                <div className="csu-fact"><small>Your squad</small><b>{averageRating(squadRatings(squad))} OVR</b></div>
              </div>
              <p className="muted t-note">There’s a cup too. You can change the time per half before any match.</p>
            </>
          )}
        </main>
        <footer className="shell-foot"><div className="shell-foot-inner csu-foot">
          <button className="btn btn-secondary" onClick={prev}><Icon name="back" size={18} /> {step === 0 ? 'Menu' : 'Back'}</button>
          {step < 2
            ? <button className="btn btn-gold btn-lg" onClick={next}>Next <Icon name="next" size={18} /></button>
            : <button className="btn btn-gold btn-lg" onClick={start} onMouseEnter={playHoverTick}><Icon name="play" size={20} /> Start career</button>}
        </div></footer>
      </div>
      {sheet && <KitSheet club={club} onPick={pick} onCustom={openMaker} onClose={() => setSheet(false)} />}
      {maker && <KitEditor team={club} title="Your cap" designs={false} withName squadNames={squadSurnames(squad)} onUpdate={(patch) => setClub((c) => ({ ...c, ...patch }))} onClose={() => setMaker(false)} />}
    </div>
  )
}

function CareerSaveError() {
  const error = useAccountStore((s) => s.error)
  if (!error) return null
  return (
    <div className="career-save-error" role="alert">
      <span><strong>Save pending.</strong> {error}</span>
      <button className="btn btn-secondary" onClick={() => { playButtonSelect(); useAccountStore.getState().save({ force: true }) }}>Retry save</button>
    </div>
  )
}

function Ladder({ level, promotions, titles, cups = 0, ccl = 0 }) {
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
      <p className="muted t-note">{promotions} promotion{promotions === 1 ? '' : 's'} · {titles} title{titles === 1 ? '' : 's'} · {cups} {CUP_NAME}{cups === 1 ? '' : 's'}{ccl ? ` · ${ccl} Champions League${ccl === 1 ? '' : 's'}` : ''}</p>
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
  const waitingCup = cupPending(career) || cclPending(career)
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
      <SeasonNumbers career={career} awards={seasonAwards(career)} />
      <Awards awards={seasonAwards(career)} />
      {cup && <p className="career-target-line">{CUP_NAME}: <b>{cup === 'won' ? 'Winners!' : cup === 'final' ? 'Runners-up' : cup === 'semi' ? 'Semi-finals' : 'Quarter-finals'}</b></p>}
      {warned && <p className="t-note career-warning"><b>Final warning.</b> The board isn’t happy. Miss next season’s target too and you’re sacked.</p>}
      {doomed
        ? <p className="t-note">You missed the board’s target again, on a final warning. They want to see you.</p>
        : <p className="muted">Season bonus: <b>{money(bonus)}</b>. Over the summer young players improve, older ones slow down, and veterans may retire. The transfer window opens before the new season.</p>}
      {waitingCup ? (
        <p className="t-note" role="status">{cupPending(career) ? `Play your ${CUP_NAME} tie first; the season ends once you’re out or it’s won.` : 'Your Champions League isn’t over yet. Play it out first.'}</p>
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

/** Derby day: the rivalry's name and the record between you. */
function DerbyBanner({ career, rival }) {
  const r = headToHead(career, rival)
  const met = r.w + r.d + r.l
  return (
    <div className="derby-banner">
      <b className="derby-title">Derby day</b>
      <span className="derby-name">{derbyName(rival)}{met ? ` · played ${met}` : ' · the first one'}</span>
      {met > 0 && (
        <span className="derby-h2h">
          <span data-tone="good"><b>{r.w}</b> won</span>
          <span><b>{r.d}</b> drawn</span>
          <span data-tone="bad"><b>{r.l}</b> lost</span>
        </span>
      )}
      <small className="derby-note">Bigger crowd · win it for {DERBY_PRIZE}× prize money</small>
    </div>
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
            <div className="eyebrow shell-eyebrow">{career.jobOffer ? `Sacked by ${career.club.name} · a club is calling` : `Career over · ${career.club.name}`}</div>
            <h1 className="display shell-title">Sacked</h1>
          </div>
        </header>
        <main className="shell-body career-start">
          {career.jobOffer && <JobOfferCard career={career} />}
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
            <button className={`btn ${career.jobOffer ? 'btn-secondary' : 'btn-gold btn-lg'} btn-block`} onClick={() => { playConfirm(); useCareerStore.getState().retire() }}>Start a new career</button>
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

/** One stop on the season road: a match still to come, or a result. */
function RoadStop({ stop, onOpen }) {
  const { f, cup, date, label, opp } = stop
  const r = f.result
  let tone = null
  let score = cup && !r ? null : label
  if (r) {
    const mine = f.home === ME ? r.home : r.away
    const theirs = f.home === ME ? r.away : r.home
    const pens = r.pens ? (f.home === ME ? r.pens.home - r.pens.away : r.pens.away - r.pens.home) : 0
    tone = mine > theirs || pens > 0 ? 'W' : mine < theirs || pens < 0 ? 'L' : 'D'
    score = `${mine}-${theirs}`
  }
  const word = { W: 'Won', D: 'Drew', L: 'Lost' }[tone]
  const Tag = onOpen ? 'button' : 'div'
  return (
    <li className="road-stop" data-r={tone || undefined} data-cup={cup ? 'true' : undefined}>
      <span className="road-dot" aria-hidden>{cup && !r ? <Icon name="trophy" size={18} /> : score}</span>
      <Tag className="road-tag" {...(onOpen ? { onClick: onOpen, type: 'button' } : {})}>
        {cup && <b className="road-cup">{CUP_NAME} · {label}</b>}
        <span>{r ? `${word} v ` : 'v '}<b>{opp?.name || 'TBD'}</b>{r?.pens ? ' on pens' : ''}</span>
        <small>{r ? (onOpen ? 'Match report ►' : formatGameDate(date, { year: false })) : formatGameDate(date, { year: false })}</small>
      </Tag>
    </li>
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
  const season = career?.season
  useLayoutEffect(() => {
    if (!mainRef.current) return
    for (let el = mainRef.current; el; el = el.parentElement) el.scrollTop = 0
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0
  }, [page, season])
  const go = (next) => { playButtonSelect(); setPage(next) }

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

  if (!career) return <CareerSetup onMenu={back} />

  if (career.sacked) return <Sacked career={career} onBack={back} />

  const league = career.league
  const division = DIVISIONS[career.level]
  // One calendar: a cup tie on its date is played before the league carries on
  const due = careerNext(career)
  const next = due?.kind === 'league' ? due.fixture : null
  const done = seasonOver(league)
  // The career's own calendar: today is the date of your next match
  const today = careerDate(career)
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
  // Completed fixtures and the remaining dates share the club calendar.
  const road = (() => {
    const other = (f) => (f.home === ME ? f.away : f.home)
    const stops = fixtures.slice().sort((a, b) => a.round - b.round).map((f, i) => ({ f, date: leagueDate(career, f), label: `${i + 1}`, opp: teamById(league, other(f)) }))
    if (cupT) {
      for (const f of allFixtures(cupT)) {
        if ((f.home !== ME && f.away !== ME) || (!f.result && f.id !== cupUpcoming?.tie.id)) continue
        stops.push({ f, cup: true, date: cupDate(career, f.round), label: cupRoundName(f), opp: teamById(cupT, other(f)) })
      }
    }
    stops.sort((a, b) => a.date - b.date)
    const nowId = done ? null : due?.fixture.id
    return {
      ahead: stops.filter((st) => !st.f.result && st.f.id !== nowId),
      behind: stops.filter((st) => st.f.result).reverse(),
    }
  })()
  // Where your squad ranks on OVR among the division's clubs (what the board judges you on)
  const squadRank = 1 + league.teams.filter((t) => t.cpu && ovrOf(t) > myOvr).length

  const clubDetail = Object.hasOwn(CLUB_PAGES, page)
  const office = page === 'club' || clubDetail

  return (
    <div className={office || page === 'squad' ? 'screen career-office' : 'screen'}>
      <div className="shell">
        <header className="shell-head career-top">
          <button className="career-top-back" onClick={back} aria-label="Back to the menu"><Icon name="back" size={18} /></button>
          <CapPreview config={{ ...career.club, players: squadSurnames(career.squad) }} size={40} />
          <div className="career-top-text">
            <h1 className="career-top-name">{career.club.name}</h1>
            <div className="career-top-sub">{done ? `Season ${career.season} over` : played ? ordinal(pos) : 'Season ' + career.season} · {division.name}</div>
          </div>
          {page !== 'club' && <div className="career-top-money">{money(career.coins)}</div>}
          <IntroButton mode="career" className="career-top-help" />
        </header>

        <main className="shell-body career-body" ref={mainRef}>
          <CareerSaveError />
          {page === 'home' ? (
            <div className="career-col career-home">
          <div className="cs-matchday">
              {done && !due ? <SeasonEnd career={career} /> : due?.kind === 'ccl' ? (
                <CclMatchCard career={career} fixture={due.fixture} myOvr={myOvr} onPlay={() => playCareerFixture(career, 'careerCcl', due.fixture)} />
              ) : tie ? (
                <section className="card card-pad career-next career-cup" aria-label={CUP_NAME}>
                  <div className="career-date">{formatGameDate(today)} · {tie.home === ME ? 'Home' : 'Away'}</div>
                  <div className="eyebrow">{CUP_NAME} · {cupRoundName(tie)}</div>
                  <div className="career-vs">
                    <TeamTag team={teamById(cupT, ME)} size={52} strong />
                    <span className="vs-badge">VS</span>
                    <TeamTag team={cupOpp} size={52} strong mirror />
                  </div>
                  <p className="career-match-line" data-matchup={matchupOf(myOvr, cupOppOvr)}>OVR {myOvr} v {cupOppOvr} · <b>{MATCHUP[matchupOf(myOvr, cupOppOvr)]}</b>{(career.cup.levels?.[cupOpp?.id] ?? career.level) !== career.level ? ` · ${DIVISIONS[career.cup.levels[cupOpp.id]].name}` : ''}</p>
                  <button className="btn btn-purple btn-lg btn-block" onClick={() => playCareerFixture(career, 'careerCup', tie)}><Icon name="trophy" size={20} /> {career.mode === 'solo' || !career.mode ? 'Play cup tie' : 'Play your friend in the cup'}</button>
                  <p className="cs-preview-line">{fixtureBrief(career, due)}</p>
                </section>
              ) : next && (
                <section className="card card-pad career-next" data-derby={isDerby(career, league, next) ? 'true' : undefined}>
                  <div className="career-date">{formatGameDate(today)} · {next.home === ME ? 'Home' : 'Away'}</div>
                  {isDerby(career, league, next) && <DerbyBanner career={career} rival={opponent.name} />}
                  <div className="eyebrow">Matchday {played + 1} of {fixtures.length}</div>
                  <div className="career-vs">
                    <TeamTag team={teamById(league, ME)} size={52} strong />
                    <span className="vs-badge">VS</span>
                    <TeamTag team={opponent} size={52} strong mirror />
                  </div>
                  <FormLine league={league} opponent={opponent.id} />
                  <p className="cs-preview-line">{fixtureBrief(career, due)}</p>
                  <p className="career-match-line" data-matchup={matchupOf(myOvr, theirOvr)}>OVR {myOvr} v {theirOvr} · <b>{MATCHUP[matchupOf(myOvr, theirOvr)]}</b></p>
                  <button className="btn btn-gold btn-lg btn-block" onClick={play} onMouseEnter={playHoverTick}>
                    <Icon name={MODE_INFO[isLagos() ? 'solo' : career.mode || 'solo'].icon} size={20} /> {!isLagos() && career.mode === 'online' ? 'Play your friend online' : !isLagos() && career.mode === 'lan' ? 'Play your friend over LAN' : 'Play match'}
                  </button>
                  {!isLagos() && (career.mode === 'online' || career.mode === 'lan') && <p className="muted t-note">Your friend plays the opposition from their phone. The result saves here.</p>}
                </section>
              )}
              {career.target && !done && played > 0 && (
                <p className="road-board" data-met={targetMet(career.target, pos, count) ? 'true' : undefined}>
                  <span>Board</span> {TARGETS[career.target].replace(/:.*/, '')} · now <b>{ordinal(pos)}</b>{career.warning ? ' · final warning' : ''}
                </p>
              )}
          </div>
          <SeasonOverview career={career} go={go} />
          {career.ccl && <CclPanel career={career} />}
          <details className="card card-pad season-details"><summary>Fixtures &amp; results</summary>
            <ol className="road">
              {road.behind.map((st) => <RoadStop key={st.f.id} stop={st} onOpen={career.lastMatch?.fixtureId === st.f.id ? () => go('report') : null} />)}
              {road.ahead.map((st) => <RoadStop key={st.f.id} stop={st} />)}
            </ol>
          </details>
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

            </div>
          ) : (
            <div className="career-col career-page">
              <div className="career-page-head">
                {clubDetail && <button className="btn btn-ghost career-back" onClick={() => go('club')}><Icon name="back" size={16} /> Club</button>}
                {(page === 'report' || MORE_PAGES.includes(page)) && page !== 'more' && (
                  <button className="btn btn-ghost career-back" onClick={() => { if (page === 'report') { useCareerStore.getState().reportSeen(); go('home') } else go('more') }}><Icon name="back" size={16} /> {page === 'report' ? 'Season' : 'More'}</button>
                )}
                <h2 className="display career-page-title">{PAGE_TITLE[page]}</h2>
              </div>
              {page === 'more' && (
                <nav className="career-list" aria-label="More career pages">
                  {[
                    { key: 'youth', title: 'Youth team', line: `${(career.youthTeam || []).length} player${(career.youthTeam || []).length === 1 ? '' : 's'}` },
                    { key: 'league', title: 'League', line: `${ordinal(pos)} of ${count} · ${division.name}` },
                    { key: 'cup', title: CUP_NAME, line: cupT?.championId === ME ? 'Winners!' : cupOut ? 'Knocked out' : tie ? `${cupRoundName(tie)} · ready to play` : cupUpcoming ? `${cupRoundName(cupUpcoming.tie)} · ${formatGameDate(cupDate(career, cupUpcoming.tie.round), { year: false })}` : 'The draw' },
                    { key: 'history', title: 'History', line: `${career.past.length} season${career.past.length === 1 ? '' : 's'} · ${career.promotions} promotion${career.promotions === 1 ? '' : 's'}` },
                    { key: 'settings', title: 'Settings', line: 'Kit, match time, difficulty' },
                  ].map((t) => (
                    <button key={t.key} className="career-list-row" onClick={() => go(t.key)}>
                      <span className="career-list-title">{t.title}</span>
                      <small>{t.line}</small>
                      <span className="career-list-arrow" aria-hidden>►</span>
                    </button>
                  ))}
                  <button className="career-list-row" onClick={back}>
                    <span className="career-list-title">Main menu</span>
                    <small>Leave career mode</small>
                    <span className="career-list-arrow" aria-hidden>►</span>
                  </button>
                </nav>
              )}
              {page === 'report' && <MatchReport career={career} onDone={() => { useCareerStore.getState().reportSeen(); go('home') }} />}
              {page === 'squad' && <>
                <SquadPanel career={career} show="squad" />
                {career.lastReport && <details className="card card-pad season-details"><summary>Last match ratings</summary><PlayerRatings career={career} /></details>}
              </>}
              {page === 'transfers' && <>
                <OfferInbox career={career} />
                <TransferMarket career={career} />
              </>}
              {page === 'youth' && <SquadPanel career={career} show="youth" />}
              {page === 'cup' && <CupPage career={career} myOvr={myOvr} onPlay={(t) => playCareerFixture(career, 'careerCup', t)} />}
              {office && <ClubPanel career={career} page={page} onOpen={go} />}
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
                <Ladder level={career.level} promotions={career.promotions} titles={career.titles} cups={career.cups} ccl={career.cclTitles} />
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

        <footer className="shell-foot career-foot">
          <nav className="career-tabs" aria-label="Career">
            {[
              { key: 'home', icon: 'ball', title: 'Season', on: page === 'home' || page === 'report' },
              { key: 'squad', icon: 'users', title: 'Squad' },
              { key: 'transfers', icon: 'next', title: 'Market', badge: inboxOffers(career).length || null },
              { key: 'club', icon: 'cpu', title: 'Club', on: office },
              { key: 'more', icon: 'menu', title: 'More', on: MORE_PAGES.includes(page) },
            ].map((t) => {
              const on = t.on ?? page === t.key
              return (
                <button key={t.key} className="career-tab" aria-current={on ? 'page' : undefined} onClick={() => { if (page === 'report') useCareerStore.getState().reportSeen(); go(t.key) }}>
                  <span className="career-tab-icon"><Icon name={t.icon} size={22} />{t.badge ? <em>{t.badge}</em> : null}</span>
                  <span>{t.title}</span>
                </button>
              )
            })}
          </nav>
        </footer>
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
      {/* A new season has just started: the summer review, once */}
      {career.lastSummer?.season === career.season && !career.lastSummer.seen && played === 0 && <SummerReview career={career} />}
      {/* After the summer review: a club wants you */}
      {career.jobOffer && played === 0 && (career.lastSummer?.seen || career.lastSummer?.season !== career.season) && <JobOfferCard career={career} overlay />}
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
