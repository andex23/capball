import { DEFAULT_TEAM_CONFIG } from '../state/MatchStore'
import { CAP_ROLES } from '../data/TeamOptions'
import { printedSurname } from '../game/squad'
import { legendById } from '../data/Legends'
import CapPreview from './CapPreview'

export function careerNumber(club, role) {
  if (!CAP_ROLES.includes(role)) return null
  return club.numbers?.[role] ?? DEFAULT_TEAM_CONFIG.team1.numbers[role]
}

export default function CareerPlayerCap({ club, player, role, size = 54 }) {
  const slot = CAP_ROLES.includes(role) ? role : null
  const keeper = slot ? slot === 'gk' : player.pos === 'GK'
  // Bench players have their own print, and take a numbered slot when selected.
  const printRole = slot || (keeper ? 'gk' : 'atk1')
  const kit = {
    ...DEFAULT_TEAM_CONFIG.team1, ...club,
    players: { [printRole]: printedSurname(player) },
    bandEnabled: !!slot && club.bandEnabled === true,
    ...(legendById(player.id) ? { edge: '#ffcf57', skirtColor: '#b8862e' } : {}),
  }
  return <span className="roster-cap" aria-hidden="true">
    <CapPreview config={kit} role={printRole} number={careerNumber(club, role)} size={size} standing={keeper} />
  </span>
}
