import { useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useAccountStore } from '../state/accountStore'
import { DIVISIONS } from '../game/divisions'
import { otherTeam } from '../game/rules'
import { kitsApart } from '../game/kitClash'
import { personalTeams, quickClubKit, quickOpponent } from '../game/quickMatch'
import { editKit } from '../data/TeamOptions'
import { FORMATIONS } from '../data/TeamData'
import { sendFormation, sendTeamConfig } from '../multiplayer/MultiplayerManager'
import { playButtonSelect, playWhistle } from '../audio/SoundManager'
import { FormationCard } from './FormationScreen'
import { TableSettings } from './StadiumSelectScreen'
import { CapStudio, MatchBallPicker } from './TeamSelectScreen'
import SetupShell from '../ui/SetupShell'
import CapPreview from '../ui/CapPreview'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import '../ui/quickMatch.css'

function MatchSettings({ side, teams, onClose }) {
  const [section, setSection] = useState('formation')
  const mode = useMatchStore((s) => s.gameMode)
  const forms = useMatchStore((s) => s.formations)
  const level = useMatchStore((s) => s.aiDifficulty)
  const other = otherTeam(side)
  const setFormation = (key) => {
    useMatchStore.getState().setFormation(side, key)
    if (mode === 'online' && side === 'team2') sendFormation(key)
  }
  return <Modal title="Match settings" onClose={onClose}>
    <div className="quick-settings">
      <div className="segmented stretch" role="group" aria-label="Settings section">
        <button aria-pressed={section === 'formation'} onClick={() => setSection('formation')}>Formation</button>
        <button aria-pressed={section === 'table'} onClick={() => setSection('table')}>Table &amp; rules</button>
      </div>
      {section === 'formation' ? <>
        <FormationCard team={side} config={teams[side]} formation={forms[side]} onSelect={setFormation}
          tag={mode === 'local' ? (side === 'team1' ? 'Player 1' : 'Player 2') : 'You'} />
        {mode !== 'local' && <p className="quick-opponent-shape"><Icon name="lock" size={16} />
          {teams[other].name} · {FORMATIONS[mode === 'ai' ? 'default' : forms[other]].name}
        </p>}
        {mode === 'ai' && <label className="quick-field">Computer level
          <select aria-label="Computer level" value={level} onChange={(e) => useMatchStore.getState().setAiDifficulty(e.target.value)}>
            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
          </select>
        </label>}
      </> : <><TableSettings compact teams={teams} /><MatchBallPicker /></>}
    </div>
  </Modal>
}

export default function QuickMatchScreen() {
  const mode = useMatchStore((s) => s.gameMode)
  const aiTeam = useMatchStore((s) => s.aiTeam)
  const myTeam = useMatchStore((s) => s.onlineMyTeam)
  const synced = useMatchStore((s) => s.teamConfig)
  const username = useAccountStore((s) => s.username)
  const [personal, setPersonal] = useState(() => personalTeams(useMatchStore.getState(), username))
  const [picks, setPicks] = useState({ team1: null, team2: null })
  const [localSeat, setLocalSeat] = useState('team1')
  const [division, setDivision] = useState(0)
  const [panel, setPanel] = useState(null)
  const [draw] = useState(Math.random)
  const local = mode === 'local'
  const online = mode === 'online'
  const side = local ? localSeat : online ? myTeam || 'team1' : otherTeam(aiTeam)
  const other = otherTeam(side)
  const teams = { team1: picks.team1 || personal.team1, team2: picks.team2 || personal.team2 }
  if (mode === 'ai') teams[other] = quickClubKit(quickOpponent(teams[side], draw), other)
  if (online) teams[other] = synced[other]
  const canStart = local ? !!(picks.team1 && picks.team2) : !!picks[side]
  const choices = [personal[side], ...DIVISIONS[division].clubs.filter((club) => club.name !== personal[side].name).map((club) => quickClubKit(club, side))]

  function select(kit) {
    playButtonSelect()
    setPicks((previous) => ({ ...previous, [side]: kit }))
    if (online) {
      useMatchStore.getState().setTeamConfig(side, kit)
      if (side === 'team2') sendTeamConfig(kit)
    }
    if (local && !picks[other]) setLocalSeat(other)
  }

  function editPersonalKit(patch) {
    const match = useMatchStore.getState()
    let edited = editKit(personal[side], patch)
    if (patch.customName === false) {
      edited = personalTeams({ ...match, teamConfig: { ...personal, [side]: edited } }, username)[side]
    }
    match.setTeamConfig(side, online || patch.customName === false ? edited : patch)
    setPersonal((old) => ({ ...old, [side]: edited }))
    setPicks((old) => ({ ...old, [side]: edited }))
    if (online && side === 'team2') sendTeamConfig(edited)
  }

  function kickOff() {
    if (!canStart) return
    playWhistle()
    const match = useMatchStore.getState()
    if (online) {
      const kits = kitsApart(match.teamConfig)
      if (kits !== match.teamConfig) useMatchStore.setState({ teamConfig: kits })
      match.startGame()
    } else {
      match.startQuickMatch(kitsApart(teams))
    }
  }

  return <SetupShell title={local ? 'Pick your teams' : 'Pick your team'} onBack={() => useMatchStore.getState().goToScreen(SCREEN.MENU)}
    next={{ label: 'Kick off', icon: 'ball', color: 'orange', onClick: kickOff, disabled: !canStart }} onBothReady={kickOff}>
    <div className="quick-picker">
      {local && <div className="segmented stretch" role="group" aria-label="Player choosing a team">
        {['team1', 'team2'].map((team, n) => <button key={team} aria-pressed={team === side} onClick={() => setLocalSeat(team)}>Player {n + 1}</button>)}
      </div>}
      <section className="card quick-board" aria-label="Teams">
        <div className="quick-board-head">
          <span className="display">{local ? (side === 'team1' ? 'Player 1' : 'Player 2') : 'Clubs'}</span>
          <select aria-label="Club league" value={division} onChange={(e) => setDivision(Number(e.target.value))}>
            {DIVISIONS.map((league, i) => <option key={league.name} value={i}>{league.name}</option>)}
          </select>
        </div>
        <div className="quick-clubs" role="group" aria-label="Choose a team">
          {choices.map((kit) => <button key={kit.name} aria-pressed={picks[side]?.name === kit.name}
            disabled={local && picks[other]?.name === kit.name} onClick={() => select(kit)}>
            <CapPreview config={kit} size={58} number={kit.numbers.atk1} />
            <strong>{kit.name}</strong>
            {picks[side]?.name === kit.name && <Icon name="check" size={16} />}
          </button>)}
        </div>
        <button className="quick-edit" onClick={() => setPanel('kit')}>Edit my caps</button>
      </section>
      <div className="quick-fixture" aria-live="polite">
        <span>{picks[side]?.name || (local ? 'Choose a team' : 'Your team')}</span><small>VS</small>
        <span>{local && !picks[other] ? (other === 'team1' ? 'Player 1' : 'Player 2') : teams[other].name}</span>
      </div>
      <button className="btn btn-secondary quick-options" onClick={() => setPanel('settings')}><Icon name="settings" size={17} /> Match settings</button>
    </div>
    {panel === 'settings' && <MatchSettings side={side} teams={teams} onClose={() => setPanel(null)} />}
    {panel === 'kit' && <Modal title="Your caps" onClose={() => setPanel(null)}>
      <CapStudio teamKey={side} config={personal[side]} onUpdate={editPersonalKit} />
    </Modal>}
  </SetupShell>
}
