import { useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useTournamentStore } from '../state/tournamentStore'
import { progress, teamById, readyFixtures, needsHuman, standings, roundName, allFixtures } from '../game/tournament'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'
import Icon from '../ui/Icon'
import CapPreview from '../ui/CapPreview'
import { TeamTag, scoreText, ProgressBar } from '../ui/TournamentBits'
import { displayColor } from '../ui/color'

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function fixtureLabel(t, f) {
  if (t.format === 'league') return `Matchday ${f.round + 1}`
  return roundName(f.round, t.rounds.length)
}

function modeLabel(t, f) {
  const home = teamById(t, f.home)
  const away = teamById(t, f.away)
  const cpu = home?.cpu ? home : away?.cpu ? away : null
  return cpu ? `Against the computer · ${DIFF_LABEL[cpu.difficulty] || 'Medium'}` : 'Pass and play on this phone'
}

/* ── Next match ── */

function NextMatch({ t, fixture, onPlay }) {
  const home = teamById(t, fixture.home)
  const away = teamById(t, fixture.away)
  return (
    <section className="card t-next" aria-label="Next match">
      <div className="t-next-head">
        <span className="eyebrow">Up next · {fixtureLabel(t, fixture)}</span>
        <span className="eyebrow t-next-mode">{modeLabel(t, fixture)}</span>
      </div>
      <div className="t-next-body">
        <div className="t-next-team" style={{ '--team': displayColor(home.primary) }}>
          <CapPreview config={home} size={64} />
          <b className="display">{home.name}</b>
          <small className="muted">Home{home.cpu ? ' · CPU' : ''}</small>
        </div>
        <span className="vs-badge">VS</span>
        <div className="t-next-team" style={{ '--team': displayColor(away.primary) }}>
          <CapPreview config={away} size={64} />
          <b className="display">{away.name}</b>
          <small className="muted">Away{away.cpu ? ' · CPU' : ''}</small>
        </div>
      </div>
      <button className="btn btn-gold btn-lg btn-block t-next-play" onClick={() => onPlay(fixture)} onMouseEnter={playHoverTick}>
        Play match <Icon name="play" size={20} />
      </button>
    </section>
  )
}

function Champion({ t, onNew }) {
  const champ = teamById(t, t.championId)
  const runner = teamById(t, t.runnerUpId)
  if (!champ) return null
  return (
    <section className="card t-champion" style={{ '--team': displayColor(champ.primary) }} aria-label="Champions">
      <div className="t-champion-cap"><CapPreview config={champ} size={84} /></div>
      <div className="t-champion-text">
        <div className="eyebrow t-champion-eyebrow"><Icon name="trophy" size={14} /> {t.format === 'league' ? 'League champions' : 'Cup winners'}</div>
        <h2 className="display t-champion-name">{champ.name}</h2>
        {runner && <p className="muted">{t.format === 'league' ? 'Runners-up' : 'Beat'} {runner.name}{t.format === 'league' ? '' : ' in the final'}</p>}
      </div>
      <button className="btn btn-gold" onClick={onNew} onMouseEnter={playHoverTick}>New tournament</button>
    </section>
  )
}

/* ── Knockout bracket ── */

function TieRow({ team, goals, pens, won, lost, bye }) {
  return (
    <div className="t-tie-row" data-won={won ? 'true' : undefined}>
      <TeamTag team={team} size={22} strong={won} out={lost} placeholder={bye ? 'Bye' : 'TBD'} />
      <span className="t-tie-score tabular">
        {goals ?? ''}{pens != null && <small> ({pens})</small>}
      </span>
    </div>
  )
}

function Bracket({ t, nextId, playable, onPlay }) {
  const count = t.rounds.length
  return (
    <div className="t-bracket" style={{ '--rounds': count }}>
      {t.rounds.map((round, r) => (
        <div className="t-round" key={r}>
          <div className="eyebrow t-round-name">{roundName(r, count)}</div>
          <div className="t-round-ties">
            {round.map((tie) => {
              const home = teamById(t, tie.home)
              const away = teamById(t, tie.away)
              const bye = r === 0 && tie.home && !tie.away
              const res = tie.result
              const canPlay = playable.has(tie.id)
              return (
                <div className="t-tie" key={tie.id} data-next={tie.id === nextId ? 'true' : undefined} data-bye={bye ? 'true' : undefined}>
                  <TieRow team={home} goals={res?.home} pens={res?.pens?.home} won={tie.winner && tie.winner === tie.home && !bye} lost={tie.winner && tie.winner !== tie.home} />
                  <TieRow team={away} goals={res?.away} pens={res?.pens?.away} won={tie.winner && tie.winner === tie.away} lost={tie.winner && tie.winner !== tie.away && !!away} bye={bye} />
                  {canPlay && (
                    <button className="t-tie-play" onClick={() => onPlay(tie)} aria-label={`Play ${home.name} v ${away.name}`}>
                      <Icon name="play" size={14} /> Play
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── League ── */

function Table({ t, mine }) {
  const rows = standings(t)
  return (
    <table className="t-table">
      <thead>
        <tr>
          <th scope="col" className="t-pos">#</th>
          <th scope="col" className="t-col-team">Team</th>
          <th scope="col" title="Played">P</th>
          <th scope="col" className="t-wdl" title="Won">W</th>
          <th scope="col" className="t-wdl" title="Drawn">D</th>
          <th scope="col" className="t-wdl" title="Lost">L</th>
          <th scope="col" title="Goal difference">GD</th>
          <th scope="col" title="Points">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const team = teamById(t, row.id)
          return (
            <tr key={row.id} data-mine={mine.includes(row.id) ? 'true' : undefined} data-champ={t.championId === row.id ? 'true' : undefined}>
              <td className="t-pos tabular">{i + 1}</td>
              <td className="t-col-team"><TeamTag team={team} size={20} /></td>
              <td className="tabular">{row.p}</td>
              <td className="tabular t-wdl">{row.w}</td>
              <td className="tabular t-wdl">{row.d}</td>
              <td className="tabular t-wdl">{row.l}</td>
              <td className="tabular">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
              <td className="tabular t-pts">{row.pts}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function FixtureList({ t, nextId, playable, onPlay }) {
  const byRound = new Map()
  for (const f of allFixtures(t)) {
    if (!byRound.has(f.round)) byRound.set(f.round, [])
    byRound.get(f.round).push(f)
  }
  return (
    <div className="t-fixtures">
      {[...byRound.entries()].map(([round, list]) => (
        <div key={round} className="t-fixture-group">
          <div className="eyebrow t-round-name">Matchday {round + 1}</div>
          <ul>
            {list.map((f) => {
              const home = teamById(t, f.home)
              const away = teamById(t, f.away)
              const score = scoreText(f.result)
              const canPlay = playable.has(f.id)
              return (
                <li key={f.id} className="t-fixture" data-next={f.id === nextId ? 'true' : undefined}>
                  <TeamTag team={home} size={20} strong={f.result && f.result.home > f.result.away} />
                  {canPlay ? (
                    <button className="t-fixture-play" onClick={() => onPlay(f)} aria-label={`Play ${home.name} v ${away.name}`}>
                      <Icon name="play" size={13} /> Play
                    </button>
                  ) : (
                    <span className="t-fixture-score tabular">{score || 'v'}</span>
                  )}
                  <TeamTag team={away} size={20} strong={f.result && f.result.away > f.result.home} />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default function TournamentHubScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const t = useTournamentStore((s) => s.local)
  const playFixture = useTournamentStore((s) => s.playFixture)
  const [tab, setTab] = useState('table')

  const back = () => { playButtonSelect(); goToScreen(SCREEN.TOURNAMENT_HOME) }

  if (!t) {
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 'var(--gutter)' }}>
        <div className="card card-pad" style={{ width: 'min(420px, 100%)', display: 'grid', gap: 14 }}>
          <p className="muted">There’s no tournament on this device.</p>
          <button className="btn btn-gold" onClick={back}>Tournaments <Icon name="next" size={18} /></button>
        </div>
      </div>
    )
  }

  const league = t.format === 'league'
  const ready = readyFixtures(t).filter((f) => needsHuman(t, f))
  const next = ready[0] || null
  const playable = new Set(ready.map((f) => f.id))
  const mine = t.teams.filter((x) => !x.cpu).map((x) => x.id)
  const p = progress(t)

  const play = (f) => { playConfirm(); playFixture('local', f) }

  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head">
          <div>
            <div className="eyebrow shell-eyebrow">
              {league ? `League${t.legs === 2 ? ' · home & away' : ''}` : 'Knockout cup'} · {t.teams.length} teams
            </div>
            <h1 className="display shell-title">{league ? 'The League' : 'The Cup'}</h1>
          </div>
          <span className="mode-icon"><Icon name="trophy" size={24} /></span>
        </header>

        <main className="shell-body t-hub" data-format={t.format}>
          {t.championId
            ? <Champion t={t} onNew={() => { playButtonSelect(); goToScreen(SCREEN.TOURNAMENT_SETUP) }} />
            : (
              <div className="t-hub-top">
                {next && <NextMatch t={t} fixture={next} onPlay={play} />}
                <div className="card card-pad t-hub-progress">
                  <ProgressBar played={p.played} total={p.total} label={league ? 'Season' : 'Cup'} />
                  <p className="muted t-note">
                    {league
                      ? 'Win 3 pts · draw 1. Computer-only games play out by themselves.'
                      : 'Lose and you’re out. Level at full time goes to penalties.'}
                  </p>
                </div>
              </div>
            )}

          {league ? (
            <section className="t-league" data-tab={tab}>
              <div className="tabs t-league-tabs" role="tablist">
                <button role="tab" aria-selected={tab === 'table'} onClick={() => { playButtonSelect(); setTab('table') }}>Table</button>
                <button role="tab" aria-selected={tab === 'fixtures'} onClick={() => { playButtonSelect(); setTab('fixtures') }}>Fixtures</button>
              </div>
              <div className="card t-panel t-panel-table">
                <div className="eyebrow t-panel-title">Table</div>
                <Table t={t} mine={mine} />
              </div>
              <div className="card t-panel t-panel-fixtures">
                <div className="eyebrow t-panel-title">Fixtures &amp; results</div>
                <FixtureList t={t} nextId={next?.id} playable={playable} onPlay={play} />
              </div>
            </section>
          ) : (
            <section className="card t-panel t-panel-bracket" aria-label="Bracket">
              <Bracket t={t} nextId={next?.id} playable={playable} onPlay={play} />
            </section>
          )}
        </main>

        <footer className="shell-foot">
          <div className="shell-foot-inner">
            <button className="btn btn-secondary" onClick={back} onMouseEnter={playHoverTick}>
              <Icon name="back" size={18} /> Tournaments
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
