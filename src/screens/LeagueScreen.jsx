/**
 * The Weekend League, before it opens: what it is, what you can win, and
 * signing up with the club you'll play it with. Lagos Life and the website.
 */
import { useEffect, useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useLeagueStore, leagueWins } from '../state/leagueStore'
import { useLagosStore } from '../lagos/lagosStore'
import { useSavedStore } from '../state/savedMatch'
import { useAccountStore } from '../state/accountStore'
import { LEAGUE_ENTRY, qualifies, winsToGo, untilOpen, isLive, openFixtures, fixtureDay, leagueWindow } from '../game/leagueRules'
import { leagueClubs } from '../game/leagueClubs'
import { isLagos } from '../platform'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import CapPreview from '../ui/CapPreview'
import CapDesigns from '../ui/CapDesigns'
import Icon from '../ui/Icon'
import { KitEditor } from './TournamentSetupScreen'
import { LeaguePrizes, MysteryCap, LeagueFixtures, LeagueTable, LeagueResultCard } from '../ui/LeagueBits'
import '../ui/weekend.css'
import '../ui/league.css'

const TABS = [['club', 'Your club', 'users'], ['prizes', 'Prizes', 'trophy'], ['how', 'How it works', 'help']]
const DESIGN_TABS = [['free', 'Free'], ['earn', 'Earned'], ['lagos', 'Lagos']]

/** The club a player starts from: their own team's look and name. */
function startingClub(teamConfig) {
  const own = teamConfig?.team1 || {}
  const name = own.name && !/^team\s*\d$/i.test(own.name) ? own.name : ''
  return { ...own, name }
}

/** Days, hours, minutes and seconds until it opens, ticking. */
export function Countdown() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const t = untilOpen(now)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    <div className="lg-count" role="timer" aria-label={`Opens in ${t.days} days ${t.hours} hours ${t.mins} minutes`}>
      {[[t.days, 'days'], [pad(t.hours), 'hours'], [pad(t.mins), 'mins'], [pad(t.secs), 'secs']].map(([n, l]) => <div key={l}><b>{n}</b><small>{l}</small></div>)}
    </div>
  )
}

export function HowItWorks() {
  return (
    <ul className="lg-how">
      <li><b>15 matches</b> against the computer on hard, five a day, Friday to Sunday</li>
      <li><b>One club</b> for the whole weekend, on the best board in the game</li>
      <li><b>One go</b> at each match. Win 3, draw 1</li>
      <li><b>Top of the table</b> on Sunday night is champion</li>
      <li><b>Leave a match early</b> and it counts as a 3–0 loss</li>
      <li><b>{LEAGUE_ENTRY} wins</b> against the computer or friends to enter</li>
    </ul>
  )
}

function Register({ wins }) {
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const [club, setClub] = useState(() => startingClub(teamConfig))
  const [tab, setTab] = useState('free')
  const [maker, setMaker] = useState(false)
  const tabs = DESIGN_TABS.filter(([k]) => k !== 'lagos' || isLagos())
  const ok = club.name.trim().length > 0
  const join = () => { if (!ok) return; playConfirm(); useLeagueStore.getState().join(club) }
  return (
    <section className="wk-card">
      <div className="wk-card-h"><h2 className="display">Your club</h2><span>One club, all 15</span></div>
      <div className="lg-qual" data-ok="true"><Icon name="check" size={16} /><span>You qualify: <b>{wins} wins</b></span></div>
      <p className="muted wk-note" style={{ margin: 0 }}>Make your own cap, or use any cap you’ve unlocked. It’s locked in when you sign up.</p>
      <div className="lg-kit">
        <div className="lg-kit-top">
          <CapPreview config={club} size={96} number={10} />
          <label><small>Club name</small><input value={club.name} maxLength={18} placeholder="Your club" onChange={(e) => setClub((c) => ({ ...c, name: e.target.value }))} /></label>
        </div>
        <div className="segmented stretch csu-tabs" role="tablist" aria-label="Cap designs">
          {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => { playButtonSelect(); setTab(k) }}>{label}</button>)}
        </div>
        <CapDesigns config={club} onPick={(patch) => setClub((c) => ({ ...c, ...patch }))} section={tab} onCustom={tab === 'free' ? () => setMaker(true) : null} />
      </div>
      <button className="btn btn-gold btn-lg btn-block" disabled={!ok} onClick={join}><Icon name="check" size={18} /> Sign up</button>
      {maker && <KitEditor team={club} title="Your cap" designs={false} withName onUpdate={(patch) => setClub((c) => ({ ...c, ...patch }))} onClose={() => setMaker(false)} />}
    </section>
  )
}

function Joined({ club }) {
  return (
    <section className="wk-card">
      <div className="wk-card-h"><h2 className="display">You’re in</h2><span>Signed up</span></div>
      <div className="lg-club"><CapPreview config={club} size={56} number={10} /><div><small>Your club</small><b>{club.name}</b></div><span><Icon name="lock" size={12} /> Locked</span></div>
      <p className="muted wk-note" style={{ margin: 0 }}>We’ll let you know the moment it opens. Keep your form up until then.</p>
    </section>
  )
}

function NotYet({ wins, signedIn }) {
  const go = useMatchStore((s) => s.goToScreen)
  if (!signedIn) {
    return (
      <section className="wk-card">
        <div className="lg-qual"><Icon name="lock" size={14} /><span>The Weekend League needs an account</span></div>
        <p className="muted wk-note" style={{ margin: 0 }}>Sign in from the menu’s profile so your wins count towards the {LEAGUE_ENTRY} you need.</p>
      </section>
    )
  }
  const need = winsToGo(wins)
  return (
    <section className="wk-card">
      <div className="lg-qual"><Icon name="lock" size={14} /><span>You have <b>{wins} {wins === 1 ? 'win' : 'wins'}</b>. {need} more to enter.</span></div>
      <div className="lg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={LEAGUE_ENTRY} aria-valuenow={wins}><i style={{ width: `${Math.min(100, (wins / LEAGUE_ENTRY) * 100)}%` }} /></div>
      <p className="muted wk-note" style={{ margin: 0 }}>Every win counts, on any level: against the computer or a friend. Win {need} more and you’re in.</p>
      <button className="btn btn-gold btn-lg btn-block" onClick={() => { playConfirm(); useMatchStore.getState().setGameMode('ai'); go(SCREEN.TEAM_SELECT) }}><Icon name="play" size={18} /> Play the computer now</button>
    </section>
  )
}

const LIVE_TABS = [['fixtures', 'Fixtures', 'ball'], ['table', 'Table', 'menu'], ['prizes', 'Prizes', 'trophy'], ['how', 'How it works', 'help']]
const DAY_NAMES = ['Friday', 'Saturday', 'Sunday']

function timeLeft(ms) {
  const m = Math.max(0, Math.floor(ms / 60000))
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m % 60}m`
}

/** While it's on: your club, the fixtures, the table, prizes and rules, a tab each. */
function LiveLeague({ joined, tab }) {
  const key = useLeagueStore((s) => s.key)
  const results = useLeagueStore((s) => s.results)
  const table = useLeagueStore((s) => s.table)
  const error = useLeagueStore((s) => s.error)
  const last = useLeagueStore((s) => s.last)
  const [, tick] = useState(0)
  const [busy, setBusy] = useState(false)
  const now = Date.now()
  const open = openFixtures(key, now)
  const today = Math.max(0, fixtureDay(open - 1))
  const [day, setDay] = useState(today)
  useEffect(() => { const t = setInterval(() => { tick((n) => n + 1); useLeagueStore.getState().refreshTable() }, 45000); return () => clearInterval(t) }, [])
  const w = leagueWindow(key)
  const clubs = leagueClubs(key)
  const fixtures = clubs.map((club, i) => ({ club, result: results[i] }))
  const left = open < 15 ? (today === 0 ? w.sat : w.sun) - now : 0
  const me = table?.me
  const tenth = table?.top?.[9]
  const chase = !me ? 'Play your first match to get on the table.' : me.rank === 1 ? 'You’re top of the table. Stay there.' : me.rank <= 10 ? `You’re in the top ten. ${me.rank <= 3 ? 'A trophy place.' : `${(table.top[2]?.pts ?? me.pts) - me.pts} points off the top three.`}` : `${(tenth?.pts ?? 0) - me.pts} points off the top ten.`
  const toPlay = results.slice(0, open).filter((r) => !r).length
  const play = async (i) => { if (busy) return; setBusy(true); playConfirm(); const ok = await useLeagueStore.getState().play(i); if (!ok) setBusy(false) }
  return (
    <>
      <section className="wk-poster lg-compact">
        <div className="wk-live"><i aria-hidden /> Live · {DAY_NAMES[today]}</div>
        <div className="wk-facts">
          <span><b>{table?.players ?? '—'}</b> playing</span>
          <span><b>{timeLeft(w.end - now)}</b> left</span>
          {me && <span><b>#{me.rank}</b> you</span>}
        </div>
        <div className="lg-compact-row">
          <div className="lg-club"><CapPreview config={joined.club} size={40} /><div><small>Your club</small><b>{joined.club.name}</b></div><span><Icon name="lock" size={12} /></span></div>
          <div className="wk-prize-cap"><MysteryCap size={52} /><small>1st wins it</small></div>
        </div>
        <div className="lg-chase">{chase}{toPlay ? ` ${toPlay} to play now.` : ''}</div>
      </section>
      {last && tab === 'fixtures' && (
        <button className="lg-last" onClick={() => useLeagueStore.setState({ last: null })} aria-label="Close">
          <LeagueResultCard mine={joined.club.name} gf={last.gf} ga={last.ga} club={last.club} rankFrom={last.rankFrom} rankTo={last.rankTo} pts={last.pts} left={toPlay ? `${toPlay} left today` : 'that’s today done'} />
        </button>
      )}
      {error && <p className="t-warn" role="alert">{error}</p>}
      {tab === 'fixtures' && <LeagueFixtures fixtures={fixtures} day={Math.min(day, today)} today={today} opensIn={timeLeft(left)} onPlay={play} onDay={setDay} busy={busy} />}
      {tab === 'table' && (table
        ? <LeagueTable rows={table.top} me={table.me} players={table.players} />
        : <section className="wk-card"><p className="muted">Loading the table…</p></section>)}
      {tab === 'prizes' && <LeaguePrizes />}
      {tab === 'how' && <section className="wk-card"><div className="wk-card-h"><h2 className="display">How it works</h2><span>The rules</span></div><HowItWorks /></section>}
    </>
  )
}

export default function LeagueScreen() {
  const joined = useLeagueStore((s) => s.joined)
  const registered = useLeagueStore((s) => s.registered)
  // Re-read wins when either source changes
  useLagosStore((s) => s.wins + s.best)
  useSavedStore((s) => s.career)
  const signedIn = !!useAccountStore((s) => s.username) || isLagos()
  const wins = leagueWins()
  const live = isLive() && !!joined
  const tabs = live ? LIVE_TABS : TABS
  const [tab, setTab] = useState(live ? 'fixtures' : 'club')
  useEffect(() => {
    useLeagueStore.getState().roll(); useLeagueStore.getState().refresh()
    // Count each visit, by where the player stands: still winning their way in, can sign up, or in
    globalThis.__counterballCount?.('feature', `league_open_${joined ? 'joined' : signedIn && qualifies(wins) ? 'qualified' : 'notyet'}`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => { playButtonSelect(); useMatchStore.getState().goToScreen(SCREEN.MENU) }

  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head tour-top">
          <button className="tour-back" onClick={back} aria-label="Back to the menu"><Icon name="back" size={18} /></button>
          <div>
            <h1 className="display tour-title">Weekend League</h1>
            <div className="tour-sub">{LEAGUE_ENTRY}+ wins to enter · Friday to Sunday</div>
          </div>
        </header>
        <main className="shell-body wk lg-has-nav">
          {live ? <LiveLeague joined={joined} tab={tab} /> : <>
          <section className="wk-poster">
            <div className="lg-soon">{isLive() ? 'Live now · sign up and play' : 'Opens Friday · 4:30pm'}</div>
            {!isLive() && <Countdown />}
            <div className="wk-poster-row">
              <div>
                <p>Fifteen matches over one weekend. One club. The best players in {isLagos() ? 'Lagos' : 'Counterball'} on one table, and only one champion.</p>
                <div className="wk-facts">
                  {registered ? <span><b>{registered}</b> signed up</span> : null}
                  <span>The champion wears the <b>Kingmaker</b></span>
                </div>
              </div>
              <div className="wk-prize-cap"><MysteryCap size={64} /><small>1st wins it</small></div>
            </div>
          </section>
          {tab === 'club' && (joined ? <Joined club={joined.club} /> : signedIn && qualifies(wins) ? <Register wins={wins} /> : <NotYet wins={wins} signedIn={signedIn} />)}
          {tab === 'prizes' && <LeaguePrizes />}
          {tab === 'how' && <section className="wk-card"><div className="wk-card-h"><h2 className="display">How it works</h2><span>The rules</span></div><HowItWorks /></section>}
          </>}
        </main>
        <nav className="lg-nav" aria-label="Weekend League" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map(([k, label, icon]) => (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => { playButtonSelect(); setTab(k) }}>
              <Icon name={icon} size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
