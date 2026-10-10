import { SITE } from '../seo/meta'
import { useAnytimeStore } from '../state/anytimeStore'
import { useState, useEffect } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useTournamentStore } from '../state/tournamentStore'
import { useAccountStore } from '../state/accountStore'
import { progress, teamById, readyFixtures, needsHuman, standings, roundName, allFixtures } from '../game/tournament'
import { fixtureAction, myTeamIds, waitText } from '../game/onlineActions'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import CapPreview from '../ui/CapPreview'
import TournamentFinale from '../ui/TournamentFinale'
import { TeamTag, scoreText, ProgressBar } from '../ui/TournamentBits'
import { KitEditor } from './TournamentSetupScreen'
import { displayColor } from '../ui/color'

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
// How often an online hub checks for new results, taken seats and open rooms
const POLL_MS = 7000
const POLL_WAITING_MS = 3000

function fixtureLabel(t, f) {
  if (t.format === 'league') return `Matchday ${f.round + 1}`
  return roundName(f.round, t.rounds.length)
}

function modeLabel(t, f, action) {
  const home = teamById(t, f.home)
  const away = teamById(t, f.away)
  if (t.playMode === 'anytime') return 'Play anytime · saved turns'
  const cpu = home?.cpu ? home : away?.cpu ? away : null
  if (cpu) return `Against the computer · ${DIFF_LABEL[cpu.difficulty] || 'Medium'}`
  if (action?.kind === 'host' || action?.kind === 'join' || action?.reason === 'home-to-start') return 'Live · phone v phone'
  if (action?.reason === 'open-seat') return 'Needs a player'
  return 'Pass and play on this phone'
}

const ACTION_LABEL = { anytime: 'Open saved match', play: 'Play match', host: 'Start match', join: 'Join match' }
const SHORT_LABEL = { anytime: 'Open', play: 'Play', host: 'Start', join: 'Join' }

/* ── Next match ── */

function NextMatch({ t, fixture, action, onAct, lan = false }) {
  const home = teamById(t, fixture.home)
  const away = teamById(t, fixture.away)
  return (
    <section className="card t-next" aria-label="Next match">
      <div className="t-next-head">
        <span className="eyebrow">Up next · {fixtureLabel(t, fixture)}</span>
        <span className="eyebrow t-next-mode">{lan ? 'LAN · two devices' : modeLabel(t, fixture, action)}</span>
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
      {action.kind === 'wait' ? (
        <div className="t-next-wait" role="status"><span className="t-spinner" aria-hidden /> {waitText(action)}</div>
      ) : (
        <button className="btn btn-gold btn-lg btn-block t-next-play" onClick={() => onAct(fixture, action)} onMouseEnter={playHoverTick}>
          {lan ? 'Play over LAN' : ACTION_LABEL[action.kind]} <Icon name={action.kind === 'play' ? 'play' : 'globe'} size={20} />
        </button>
      )}
    </section>
  )
}

function Champion({ t, onNew, onReplay }) {
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
      <div className="t-champion-actions">
        {onNew && <button className="btn btn-gold" onClick={onNew} onMouseEnter={playHoverTick}>New tournament</button>}
        <button className="btn btn-ghost" onClick={onReplay}>Watch the ending again</button>
      </div>
    </section>
  )
}

function ActButton({ fixture, action, onAct, className }) {
  if (!action || action.kind === 'wait') return null
  const home = fixture.homeTeam
  const away = fixture.awayTeam
  return (
    <button className={className} onClick={() => onAct(fixture, action)} aria-label={`${ACTION_LABEL[action.kind]}: ${home?.name} v ${away?.name}`}>
      <Icon name={action.kind === 'play' ? 'play' : 'globe'} size={13} /> {SHORT_LABEL[action.kind]}
    </button>
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

// Bracket layout (px): every tie is a card of TIE_H; each round's ties sit
// centred between the two ties that feed them, joined by elbow lines.
const TIE_W = 172
const TIE_H = 62
const ROW_GAP = 18
const COL_GAP = 46
const HEAD_H = 28
const TROPHY_W = 120

function Bracket({ t, nextId, actionFor, onAct }) {
  const count = t.rounds.length
  const first = t.rounds[0].length
  const slot = TIE_H + ROW_GAP
  const height = HEAD_H + first * slot
  const width = count * (TIE_W + COL_GAP) + TROPHY_W
  const centreY = (r, m) => HEAD_H + (m + 0.5) * slot * 2 ** r
  const left = (r) => r * (TIE_W + COL_GAP)
  const champ = teamById(t, t.championId)

  // Connector lines: from each tie's right edge to the tie it feeds
  const lines = []
  t.rounds.forEach((round, r) => {
    if (r + 1 >= count) return
    round.forEach((tie, m) => {
      const x1 = left(r) + TIE_W
      const y1 = centreY(r, m)
      const x2 = left(r + 1)
      const y2 = centreY(r + 1, Math.floor(m / 2))
      const xm = x1 + COL_GAP / 2
      const next = t.rounds[r + 1][Math.floor(m / 2)]
      const through = !!tie.winner && (next.home === tie.winner || next.away === tie.winner)
      lines.push({ d: `M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`, through, key: tie.id })
    })
  })
  // The final into the trophy
  const finalTie = t.rounds[count - 1][0]
  const fx = left(count - 1) + TIE_W
  const fy = centreY(count - 1, 0)
  lines.push({ d: `M ${fx} ${fy} H ${fx + COL_GAP}`, through: !!finalTie?.winner, key: 'final' })

  return (
    <div className="tb-scroll">
      <div className="tb" style={{ width, height }}>
        <svg className="tb-lines" width={width} height={height} aria-hidden="true">
          {lines.map((l) => <path key={l.key} d={l.d} data-through={l.through ? 'true' : undefined} />)}
        </svg>
        {t.rounds.map((round, r) => (
          <div key={`h${r}`} className="eyebrow tb-head" style={{ left: left(r), width: TIE_W }}>{roundName(r, count)}</div>
        ))}
        {t.rounds.map((round, r) => round.map((tie, m) => {
          const home = teamById(t, tie.home)
          const away = teamById(t, tie.away)
          const bye = r === 0 && tie.home && !tie.away
          const res = tie.result
          const action = actionFor(tie)
          return (
            <div
              className="t-tie tb-tie"
              key={tie.id}
              style={{ left: left(r), top: centreY(r, m) - TIE_H / 2, width: TIE_W, height: TIE_H }}
              data-next={tie.id === nextId ? 'true' : undefined}
              data-bye={bye ? 'true' : undefined}
            >
              <TieRow team={home} goals={res?.home} pens={res?.pens?.home} won={tie.winner && tie.winner === tie.home && !bye} lost={tie.winner && tie.winner !== tie.home} />
              <TieRow team={away} goals={res?.away} pens={res?.pens?.away} won={tie.winner && tie.winner === tie.away} lost={tie.winner && tie.winner !== tie.away && !!away} bye={bye} />
              <ActButton fixture={{ ...tie, homeTeam: home, awayTeam: away }} action={action} onAct={onAct} className="t-tie-play tb-play" />
            </div>
          )
        }))}
        {/* The trophy at the end of the tree */}
        <div className="tb-trophy" style={{ left: left(count - 1) + TIE_W + COL_GAP, top: fy - 52, width: TROPHY_W - 12 }} data-won={champ ? 'true' : undefined}>
          <span className="tb-cup"><Icon name="trophy" size={34} /></span>
          {champ
            ? <TeamTag team={champ} size={20} strong />
            : <span className="eyebrow">Champion</span>}
        </div>
      </div>
    </div>
  )
}

/* ── League ── */

/** League table. `zoneOf(i)` may mark a position 'up' (promotion) or 'down' (relegation). */
export function Table({ t, mine, zoneOf }) {
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
            <tr key={row.id} data-mine={mine.includes(row.id) ? 'true' : undefined} data-champ={t.championId === row.id ? 'true' : undefined} data-zone={zoneOf?.(i) || undefined}>
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

function FixtureList({ t, nextId, actionFor, onAct }) {
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
              const action = actionFor(f)
              const canAct = action && action.kind !== 'wait'
              return (
                <li key={f.id} className="t-fixture" data-next={f.id === nextId ? 'true' : undefined}>
                  <TeamTag team={home} size={20} strong={f.result && f.result.home > f.result.away} />
                  {canAct
                    ? <ActButton fixture={{ ...f, homeTeam: home, awayTeam: away }} action={action} onAct={onAct} className="t-fixture-play" />
                    : <span className="t-fixture-score tabular">{score || 'v'}</span>}
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

/* ── Online extras ── */

function CodeCard({ code }) {
  const [copied, setCopied] = useState(false)
  const url = `${SITE}/?tournament=${code}`
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked: the code is on screen */ }
  }
  const share = async () => {
    playButtonSelect()
    const text = `Join my COUNTER BALL tournament. Code ${code}`
    if (navigator.share) {
      try { await navigator.share({ title: 'COUNTER BALL tournament', text, url }); return } catch { /* cancelled */ }
    }
    copy(`${text}\n${url}`)
  }
  return (
    <div className="t-code">
      <div>
        <div className="eyebrow">Tournament code</div>
        <div className="display tabular t-code-value">{code}</div>
      </div>
      <div className="t-code-actions">
        <button className="btn btn-primary" onClick={share}><Icon name="share" size={18} /> Invite</button>
        <button className="btn btn-secondary" onClick={() => { playButtonSelect(); copy(code) }}>
          <Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function Seats({ t, snapshot, busy, onClaim, onRelease, onEdit }) {
  const seats = snapshot?.seats || []
  if (!seats.length) return null
  return (
    <div className="t-seats">
      <div className="eyebrow" style={{ marginBottom: 8 }}>Players</div>
      <p className="muted">Choose an open team slot, then bring your own name, kit and squad.</p>
      <ul>
        {seats.map((s) => {
          const team = teamById(t, s.teamId)
          if (!team) return null
          return (
            <li key={s.teamId} className="t-seat" data-mine={s.mine ? 'true' : undefined}>
              <TeamTag team={team} size={24} strong={s.mine} />
              {s.mine ? (
                <span className="t-seat-right">
                  <span className="chip t-static-chip t-seat-you">You</span>
                  {!t.championId && !snapshot.closed && <button className="btn btn-blue t-seat-btn" onClick={() => onEdit(team)} disabled={busy}>Edit team</button>}
                  {!t.championId && <button className="btn btn-ghost t-seat-btn" onClick={() => onRelease(s.teamId)} disabled={busy}>Let go</button>}
                </span>
              ) : s.claimed ? (
                <span className="chip t-static-chip">Taken</span>
              ) : (
                <button className="btn btn-blue t-seat-btn" onClick={() => onClaim(s.teamId)} disabled={busy || !!t.championId}>Choose team</button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Waiting for the other phone in a live fixture. */
function LiveWait({ t, playing, onCancel }) {
  const status = useMatchStore((s) => s.onlineStatus)
  if (!playing?.live || playing.live === 'connected') return null
  const failed = status?.status === 'error' || status?.status === 'disconnected'
  const home = teamById(t, playing.fixture.home)
  const away = teamById(t, playing.fixture.away)
  const hosting = playing.live === 'hosting'
  return (
    <Modal
      title={hosting ? 'Match room open' : 'Joining…'}
      footer={<button className="btn btn-secondary btn-block" onClick={onCancel}><Icon name="close" size={18} /> Cancel</button>}
    >
      <div className="t-live">
        <TeamTag team={home} size={36} strong />
        <span className="vs-badge">VS</span>
        <TeamTag team={away} size={36} strong />
      </div>
      {failed && status.msg && <p className="t-warn" role="alert" style={{ marginTop: 0 }}>{status.msg}</p>}
      <p className="muted" role="status">
        {!failed && <><span className="t-spinner" aria-hidden />{' '}</>}
        {hosting
          ? `Waiting for ${away?.name || 'the away team'}. A “Join match” button appears on their screen — the match starts as soon as they tap it.`
          : `Connecting to ${home?.name || 'the home team'}…`}
      </p>
    </Modal>
  )
}

export default function TournamentHubScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const kind = useTournamentStore((s) => s.hubKind)
  const local = useTournamentStore((s) => s.local)
  const anytimeError = useAnytimeStore(s => s.error)
  const onlineView = useTournamentStore((s) => s.online)
  const playing = useTournamentStore((s) => s.playing)
  const busy = useTournamentStore((s) => s.busy)
  const storeError = useTournamentStore((s) => s.error)
  const store = useTournamentStore.getState()
  const [tab, setTab] = useState('table')
  const [teamDraft, setTeamDraft] = useState(null)

  const guestLan = kind === 'lanGuest'
  const guestTeamId = useTournamentStore(s => s.lanGuestTeamId)
  const remoteTournament = useTournamentStore(s => s.lanGuestTournament)
  const useLan = useTournamentStore(s => s.localTransport === 'lan')
  const setUseLan = value => store.setLocalTransport(value ? 'lan' : 'device')
  const [lanFixture, setLanFixture] = useState(null)
  const isOnline = kind === 'online'
  const finaleSeen = useTournamentStore((s) => s.finaleSeen)
  const [finale, setFinale] = useState(false)
  // Local tournaments are kept on this phone after every result (and on the account when signed in)
  const saveAndExit = () => {
    playConfirm()
    useAccountStore.getState().save({ force: true })
    useMatchStore.getState().goToScreen(SCREEN.MENU)
  }
  const t = guestLan ? remoteTournament : isOnline ? onlineView?.tournament : local
  const snapshot = isOnline ? onlineView?.snapshot : null
  const code = onlineView?.code

  // Online: keep results, seats and match rooms fresh
  const waiting = isOnline && t && readyFixtures(t).some((f) => fixtureAction(t, snapshot, f)?.kind === 'wait')
  useEffect(() => {
    if (!isOnline || !code) return
    const refresh = () => { if (document.visibilityState !== 'hidden') useTournamentStore.getState().openOnline(code, { quiet: true }).catch(() => {}) }
    const id = setInterval(refresh, waiting ? POLL_WAITING_MS : POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [isOnline, code, waiting])

  const back = () => { playButtonSelect(); goToScreen(SCREEN.TOURNAMENT_HOME) }

  if (!t) {
    const loading = isOnline && onlineView?.loading
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 'var(--gutter)' }}>
        <div className="card card-pad" style={{ width: 'min(420px, 100%)', display: 'grid', gap: 14 }}>
          {loading
            ? <p className="muted" role="status"><span className="t-spinner" aria-hidden /> Loading tournament {code}…</p>
            : <p className="muted">{isOnline ? (onlineView?.error || 'That tournament couldn’t be loaded.') : 'There’s no tournament on this device.'}</p>}
          {isOnline && !loading && code && (
            <button className="btn btn-blue" onClick={() => store.openOnline(code).catch(() => {})}><Icon name="restart" size={18} /> Try again</button>
          )}
          <button className="btn btn-secondary" onClick={back}><Icon name="back" size={18} /> Tournaments</button>
        </div>
      </div>
    )
  }

  const league = t.format === 'league'
  const mine = guestLan ? [guestTeamId] : isOnline ? myTeamIds(snapshot) : t.teams.filter((x) => !x.cpu).map((x) => x.id)
  const readyIds = new Set(readyFixtures(t).map((f) => f.id))
  const actionFor = guestLan ? () => null : isOnline
    ? (f) => fixtureAction(t, snapshot, f)
    : (f) => (readyIds.has(f.id) && needsHuman(t, f) ? { kind: 'play' } : null)
  const ready = readyFixtures(t)
  // Best next fixture: one we can play now, else one we're waiting on
  const withActions = ready.map((f) => ({ f, a: actionFor(f) })).filter((x) => x.a)
  const next = withActions.find((x) => x.a.kind !== 'wait') || withActions[0] || null
  const p = progress(t)

  const act = (f, action) => {
    playConfirm()
    if (action.kind === 'anytime') useAnytimeStore.getState().openFixture(code, f.id)
    else if (action.kind === 'play') { if (useLan) setLanFixture(f); else store.playFixture(kind, f) }
    else if (action.kind === 'host') store.hostLiveFixture(f)
    else if (action.kind === 'join') store.joinLiveFixture(f, action.roomCode)
  }

  return (
    <div className="screen tournament-hub-screen">
      {lanFixture && <Modal title="Choose your team" onClose={() => setLanFixture(null)}>
        <p>Your friend will control the other team on their device.</p>
        {[lanFixture.home, lanFixture.away].map(id => <button key={id} className="btn btn-blue btn-block" onClick={() => store.playLanFixture('local', lanFixture, id)}>{teamById(t, id)?.name}</button>)}
      </Modal>}
      {anytimeError && <div role="alert" className="card card-pad t-warn">{anytimeError}</div>}
      {teamDraft && <KitEditor
        team={teamDraft}
        withName
        onUpdate={(patch) => setTeamDraft(draft => ({ ...draft, ...patch }))}
        onClose={() => setTeamDraft(null)}
        onSave={async () => { if (await store.updateOnlineTeam(teamDraft.id, teamDraft)) setTeamDraft(null) }}
        saving={busy}
        error={storeError}
      />}
      <div className="shell">
        <header className="shell-head">
          <div>
            <div className="eyebrow shell-eyebrow">
              {guestLan || useLan ? 'LAN · ' : isOnline ? 'Online · ' : ''}{league ? `League${t.legs === 2 ? ' · home & away' : ''}` : 'Knockout cup'} · {t.teams.length} teams
            </div>
            <h1 className="display shell-title">{league ? 'The League' : 'The Cup'}</h1>
          </div>
          <span className="mode-icon"><Icon name={isOnline ? 'globe' : 'trophy'} size={24} /></span>
        </header>

        <main className="shell-body t-hub" data-format={t.format}>
          {!isOnline && !guestLan && <section className="card card-pad">
            <div className="eyebrow">Play fixtures</div>
            <div className="segmented stretch">
              <button aria-pressed={!useLan} onClick={() => setUseLan(false)}>This device</button>
              <button aria-pressed={useLan} onClick={() => setUseLan(true)}>LAN · two devices</button>
            </div>
            {useLan && <p className="muted t-note">Pick a fixture and your team, then pair with your friend. Each player edits their own team before kick-off. This device saves the competition; pair for each fixture.</p>}
          </section>}
          {guestLan && <section className="card card-pad"><p className="muted">Latest results from the host’s competition. The host saves progress and starts the next fixture.</p><button className="btn btn-blue btn-block" onClick={() => goToScreen(SCREEN.LAN)}>Join next LAN fixture</button></section>}
          {storeError && !playing && <p className="t-warn t-hub-error" role="alert">{storeError}</p>}

          {t.championId
            ? <Champion t={t} onNew={guestLan ? null : () => { playButtonSelect(); store.startSetup(kind) }} onReplay={() => { playButtonSelect(); setFinale(true) }} />
            : (
              <div className="t-hub-top">
                {next && <NextMatch t={t} fixture={next.f} action={next.a} onAct={act} lan={!isOnline && useLan} />}
                <div className="card card-pad t-hub-progress">
                  <ProgressBar played={p.played} total={p.total} label={league ? 'Season' : 'Cup'} />
                  <p className="muted t-note">
                    {league
                      ? 'Win 3 pts · draw 1. Play one matchday at a time. Computer results follow when its player matches finish.'
                      : 'Lose and you’re out. Level at full time goes to penalties.'}
                  </p>
                  {isOnline && !next && mine.length > 0 && <p className="muted t-note">No match for you right now — waiting on other results.</p>}
                </div>
              </div>
            )}

          {isOnline && (
            <section className="card card-pad t-online-panel">
              <CodeCard code={code} />
              <Seats
                t={t}
                snapshot={snapshot}
                busy={busy}
                onEdit={(team) => setTeamDraft({ ...team })}
                onClaim={async (id) => {
                  playButtonSelect()
                  if (await store.claimSeat(id)) {
                    const team = teamById(useTournamentStore.getState().online.tournament, id)
                    setTeamDraft({ ...team, ...useMatchStore.getState().teamConfig.team1, id })
                  }
                }}
                onRelease={(id) => { playButtonSelect(); store.releaseSeat(id) }}
              />
              {!mine.length && !t.championId && <p className="muted t-note">Take a team above to play in this tournament.</p>}
            </section>
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
                <FixtureList t={t} nextId={next?.f.id} actionFor={actionFor} onAct={act} />
              </div>
            </section>
          ) : (
            <section className="card t-panel t-panel-bracket" aria-label="Bracket">
              <Bracket t={t} nextId={next?.f.id} actionFor={actionFor} onAct={act} />
            </section>
          )}
        </main>

        <footer className="shell-foot">
          <div className="shell-foot-inner">
            <button className="btn btn-secondary" onClick={back} onMouseEnter={playHoverTick}>
              <Icon name="back" size={18} /> Tournaments
            </button>
            {isOnline && (
              <button className="btn btn-ghost" onClick={() => { playButtonSelect(); store.openOnline(code, { quiet: true }).catch(() => {}) }} disabled={busy}>
                <Icon name="restart" size={18} /> Refresh
              </button>
            )}
            {!isOnline && !guestLan && (
              <button className="btn btn-primary" onClick={saveAndExit} onMouseEnter={playHoverTick}>
                <Icon name="check" size={18} /> Save &amp; exit
              </button>
            )}
          </div>
        </footer>
      </div>

      {t?.championId && (finale || !finaleSeen.includes(t.id)) && (
        <TournamentFinale
          t={t}
          mine={mine}
          onClose={() => { store.markFinaleSeen(t.id); setFinale(false) }}
          onNew={() => { store.markFinaleSeen(t.id); setFinale(false); if (guestLan) goToScreen(SCREEN.MENU); else store.startSetup(kind) }}
        />
      )}
      {isOnline && <LiveWait t={t} playing={playing} onCancel={() => { playButtonSelect(); store.cancelLive() }} />}
    </div>
  )
}
