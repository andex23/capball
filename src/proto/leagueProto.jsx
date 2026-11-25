import { createRoot } from 'react-dom/client'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/silkscreen/latin-400.css'
import '@fontsource/silkscreen/latin-700.css'
import '../styles/theme.css'
import '../ui/weekend.css'
import { loadArtFonts } from '../game/capArt'
import { CAP_DESIGNS, designPatch } from '../data/TeamOptions'
import { RetroBackdrop, RetroLogo } from '../ui/Retro'
import CapPreview from '../ui/CapPreview'
import Icon from '../ui/Icon'
import { CrownRank } from '../lagos/LagosPanels'
import { LeagueCup, LeagueFixtures, LeagueTable, LeaguePrizes, LeagueMonday, TrophyCabinet, Fold, LeagueTeamPick, LeagueFullTime } from '../ui/LeagueBits'

loadArtFonts?.()
const PLACES = ['Surulere', 'Yaba', 'Ikeja', 'Lekki', 'Eko', 'Ajegunle', 'Mushin', 'Oshodi', 'Ikoyi', 'Festac', 'Agege', 'Apapa', 'Ebute Metta', 'Victoria Is', 'Ojota']
const NAMES = ['Strikers', 'Rovers', 'United', 'Lions', 'Kings', 'Stars', 'Eagles', 'City', 'Sharks', 'Bulls']
const designs = CAP_DESIGNS.filter((d) => d.key !== 'plain')
const clubs = PLACES.map((p, k) => ({ ...designPatch(designs[(k * 3 + 1) % designs.length]), capNames: 'none', name: `${p} ${NAMES[(k * 3) % NAMES.length]}`.slice(0, 16) }))
const res = [[2, 0], [1, 1], [0, 2]]
const fixtures = clubs.map((club, i) => ({ club, result: res[i] ? { gf: res[i][0], ga: res[i][1] } : null }))
const champCap = { key: 'champ', primary: '#0A4D33', edge: '#D4AF37', finish: 'chrome', pattern: 'none', badge: 'none', capText: 'CHAMPION', capNames: 'none' }
const rows = [
  ['Adebowale', 5, 5, 0, 0, 9], ['Asiwaju', 5, 4, 1, 0, 7], ['Emrys', 4, 4, 0, 0, 6], ['Alex', 5, 3, 1, 1, 3], ['Daniel', 5, 3, 0, 2, 2],
  ['Mista', 5, 2, 2, 1, 2], ['Kemi', 4, 2, 1, 1, 2], ['Tobi', 5, 2, 1, 2, 1], ['Bayo', 3, 2, 1, 0, 3], ['Scity', 4, 2, 1, 1, 1], ['Chidi', 4, 2, 0, 2, 0],
].map(([name, p, w, d, l, gd], i) => ({ rank: i + 1, name, p, w, d, l, gd, pts: w * 3 + d }))
const me = { rank: 14, name: 'You', p: 3, w: 1, d: 1, l: 1, gd: 0, pts: 4 }

const Phone = ({ id, label, children }) => (
  <div className="proto-phone" id={id}>
    <div className="proto-label">{label}</div>
    <div className="screen proto-screen">{children}</div>
  </div>
)

function Menu({ variant, app = 'lagos' }) {
  const lg = {
    locked: { title: 'Weekend League', sub: 'Win 10 matches to enter · you have 7', tag: '7/10', lock: true },
    soon: { title: 'Weekend League', sub: 'Opens Friday · 15 matches · winner takes the Champion cap', tag: 'FRI' },
    live: { title: 'Weekend League', sub: 'Live · 2 to play today · you #14 of 86', tag: 'LIVE' },
  }[variant]
  const lagos = app === 'lagos'
  const rows = [
    lg,
    { title: 'Quick Match', sub: lagos ? 'Computer or two on one phone' : 'Computer, local, LAN or online', tag: '►' },
    { title: 'Career', sub: 'Dru FC · Season 2 · Sunday League', tag: 'PRO' },
    { title: 'Tournament', sub: 'Leagues and cups', tag: '►' },
    { title: 'Daily Challenge', sub: 'Today: Wall of Three', tag: 'x3' },
    ...(lagos ? [{ title: 'Leaderboard', sub: 'Your wins: 7', tag: '#41' }] : []),
    { title: 'Options', sub: 'Rankings, my games, settings', tag: '►' },
  ]
  return (
    <div className={`screen iss iss-menu is-started${lagos ? ' is-lagos' : ''}`} style={{ position: 'relative', height: '100%' }}>
      <RetroBackdrop />
      <div className="iss-layout">
        <RetroLogo />
        <main className="iss-window"><div className="iss-window-tab">Main menu</div>
          <ul className="iss-list">
            {rows.map((m, i) => (
              <li key={i} className={`iss-row${i === 0 ? ' is-on' : ''}${m.lock ? ' is-off' : ''}`}>
                <button className="iss-item">{m.title}{i === 0 && <small className="iss-sub">{m.sub}</small>}
                  {i === 0 && m.lock && <span className="proto-bar"><i /></span>}
                </button>
                {m.tag && <span className="iss-tag" data-arrow={m.tag === '►' ? 'true' : undefined} style={m.tag === 'LIVE' ? { background: '#ffc83d', color: '#1b1400' } : undefined}>{m.lock ? <><Icon name="lock" size={11} /> {m.tag}</> : m.tag}</span>}
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  )
}

const myKit = { ...designPatch(designs[0]), name: 'Dru FC', capNames: 'none' }
const pickOptions = [
  { name: 'Dru FC', from: 'Your team', kit: myKit },
  { name: 'Surulere Kings', from: 'Career club', kit: { ...designPatch(designs[4]), capNames: 'none' } },
  ...[2, 5, 7, 9].map((k) => ({ name: designs[k].name || designs[k].key, from: 'Cap design', kit: { ...designPatch(designs[k]), capNames: 'none' } })),
]

function Head() {
  return (
    <header className="shell-head tour-top">
      <button className="tour-back"><Icon name="back" size={18} /></button>
      <div><h1 className="display tour-title">Weekend League</h1><div className="tour-sub">10+ wins to enter · Friday to Sunday</div></div>
    </header>
  )
}

function Overview() {
  return (
    <section className="wk-poster">
      <div className="wk-live"><i aria-hidden /> Live · Friday</div>
      <div className="wk-poster-row">
        <div>
          <p>15 matches against the computer on hard, five a day, on the Cap Arena board. One go at each. Top of the table on Sunday night is champion.</p>
          <div className="wk-facts"><span><b>86</b> playing</span><span><b>2d 9h</b> left</span><span><b>#14</b> you</span></div>
        </div>
        <div className="wk-prize-cap"><CapPreview config={champCap} size={70} /><small>1st wins it</small></div>
      </div>
      <div className="lg-club"><CapPreview config={myKit} size={40} /><div><small>Your club this weekend</small><b>Dru FC</b></div><span><Icon name="lock" size={12} /> Locked</span></div>
      <div className="lg-chase">3 points off the top 10. Two matches left today.</div>
    </section>
  )
}

function League() {
  return (
    <div className="shell"><Head />
      <main className="shell-body wk">
        <Overview />
        <Fold title="Your fixtures" summary="3 of 15 played"><LeagueFixtures fixtures={fixtures} day={0} today={0} opensIn="9h" /></Fold>
        <Fold title="The table" summary="You #14 · 4 pts" open={false}><LeagueTable rows={rows} me={me} players={86} /></Fold>
        <Fold title="Prizes" summary="Champion cap · cups · ₦1m" open={false}><LeaguePrizes champCap={champCap} /></Fold>
      </main>
    </div>
  )
}

function Folded() {
  return (
    <div className="shell"><Head />
      <main className="shell-body wk">
        <Overview />
        <Fold title="Your fixtures" summary="3 of 15 played · next Lekki Bulls" open={false}><span /></Fold>
        <Fold title="The table" summary="You #14 · 4 pts"><LeagueTable rows={rows.slice(0, 11)} me={me} players={86} /></Fold>
        <Fold title="Prizes" summary="Champion cap · cups · ₦1m" open={false}><span /></Fold>
      </main>
    </div>
  )
}

function Pick() {
  return (
    <div className="shell"><Head />
      <main className="shell-body wk">
        <section className="wk-card">
          <div className="wk-card-h"><h2 className="display">Your club</h2><span>Before match 1</span></div>
          <LeagueTeamPick options={pickOptions} chosen="Dru FC" />
          <button className="btn btn-gold btn-lg btn-block"><Icon name="lock" size={16} /> Lock in Dru FC</button>
          <p className="muted wk-note">You can’t change club until next weekend.</p>
        </section>
      </main>
    </div>
  )
}

function FullTime() {
  const around = [
    { rank: 7, name: 'Kemi', p: 4, pts: 7 }, { rank: 8, name: 'Tobi', p: 5, pts: 7 },
    { rank: 9, me: true, p: 4, pts: 7 }, { rank: 10, name: 'Scity', p: 4, pts: 7 }, { rank: 11, name: 'Chidi', p: 4, pts: 6 },
  ]
  return (
    <div className="shell"><main className="shell-body wk">
      <LeagueFullTime no={4} gf={3} ga={1} mine={myKit} club={clubs[3]} line="Okafor’s double sends Dru FC into the top ten." rankFrom={14} rankTo={9} around={around} next={clubs[4]} />
    </main></div>
  )
}

function Table() {
  return (
    <div className="shell"><main className="shell-body wk">
      <div className="proto-champ-last"><LeagueCup size={28} /><span>Last weekend’s champion: <b>Adebowale</b> · 37 pts</span></div>
      <LeagueTable rows={rows} me={me} players={86} />
      <LeaguePrizes champCap={champCap} />
    </main></div>
  )
}

function Moments() {
  return (
    <div className="shell"><main className="shell-body wk" style={{ gap: 18 }}>
      <div className="proto-sub">Monday, opening the game</div>
      <LeagueMonday rank={1} players={86} tier="gold" cap={champCap} pts={37} money="₦1m" />
    </main></div>
  )
}

function Cabinet() {
  const items = [
    { tier: 'gold', rank: 1, date: '28 Nov', cap: champCap },
    { tier: 'silver', rank: 2, date: '5 Dec' },
    { rank: 6, date: '12 Dec' },
    { tier: 'bronze', rank: 3, date: '19 Dec' },
    { tier: 'gold', rank: 1, date: '26 Dec' },
  ]
  return (
    <div className="shell"><main className="shell-body wk">
      <div className="proto-sub">Profile → Trophy cabinet</div>
      <section className="wk-card">
        <div className="wk-card-h"><h2 className="display">Trophy cabinet</h2><span>Weekend League</span></div>
        <TrophyCabinet items={items} best={1} weekends={6} />
      </section>
      <div className="proto-sub">The rankings: the champion’s cup next to their name all week</div>
      <section className="wk-card">
        <ol className="rankings-list">
          <li data-medal="gold"><span className="rankings-rank"><CrownRank /></span><span className="rankings-name">Adebowale <LeagueCup size={20} /></span><span className="rankings-num"><b>62</b><small>wins</small></span></li>
          <li data-medal="silver"><span className="rankings-rank">2</span><span className="rankings-name">Asiwaju</span><span className="rankings-num"><b>57</b><small>wins</small></span></li>
          <li data-medal="bronze"><span className="rankings-rank">3</span><span className="rankings-name">Emrys</span><span className="rankings-num"><b>51</b><small>wins</small></span></li>
        </ol>
      </section>
      <div className="proto-sub">The Champion cap</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, alignItems: 'end' }}>
        <CapPreview config={champCap} size={120} />
      </div>
    </main></div>
  )
}

const css = `
.proto-row{display:flex;gap:28px;padding:28px;align-items:flex-start;flex-wrap:wrap}
.proto-phone{width:390px;flex:none}
.proto-label{font:700 11px/1.3 Silkscreen,monospace;color:#fff;text-transform:uppercase;margin-bottom:8px;letter-spacing:.06em}
.proto-screen{position:relative;width:390px;height:844px;overflow:hidden;border-radius:28px;box-shadow:0 20px 40px rgba(0,0,0,.4)}
.proto-screen .shell{padding-top:28px}
.proto-sub{font:700 9px/1 Silkscreen,monospace;text-transform:uppercase;color:#aab3d6;letter-spacing:.08em}
.proto-bar{display:block;height:6px;margin-top:8px;background:rgba(255,255,255,.12);position:relative}
.proto-bar i{position:absolute;inset:0 30% 0 0;background:#ffc83d}
.proto-champ-last{display:flex;align-items:center;gap:10px;padding:10px 12px;color:#fff;font-size:13px;background:rgba(255,200,61,.1);border:1px solid rgba(255,200,61,.4)}
.rankings-name .lg-cup{display:inline-block;vertical-align:-3px;margin-left:6px}
`
const VIEWS = { locked: <Menu variant="locked" />, soon: <Menu variant="soon" />, live: <Menu variant="live" />, web: <Menu variant="live" app="web" />, pick: <Pick />, folded: <Folded />, fulltime: <FullTime />, league: <League />, table: <Table />, moments: <Moments />, cabinet: <Cabinet /> }
function Proto() {
  const v = new URLSearchParams(location.search).get('v') || 'league'
  const menu = ['locked', 'soon', 'live', 'web'].includes(v)
  return (
    <>
      <style>{css + 'html,body,#root{height:100%;margin:0}'}</style>
      {menu ? VIEWS[v] : <div className="screen">{VIEWS[v]}</div>}
    </>
  )
}
createRoot(document.getElementById('root')).render(<Proto />)
