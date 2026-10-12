import { lanSignalToken, lanSignalFromToken } from './lan'
import { inviteUrl } from '../utils/inviteUrl'

const AUTO_PREFIX = 'COUNTERBALL-AUTO1:'
export const isAutomaticLanInvite = value => typeof value === 'string' && /^COUNTERBALL-AUTO1:[A-Z2-9]{12}$/.test(value)
export const automaticLanInvite = code => AUTO_PREFIX + code
export const automaticLanRoomCode = value => isAutomaticLanInvite(value) ? value.slice(AUTO_PREFIX.length) : ''

export function lanInviteUrl(code, location = window.location) {
  const url = new URL(inviteUrl('lan', '', location))
  url.search = ''
  url.hash = 'lan=' + (isAutomaticLanInvite(code) ? 'join.' + automaticLanRoomCode(code) : lanSignalToken(code))
  return url.href
}

export function readLanInvite(value) {
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || !url.hash.startsWith('#lan=')) return ''
    const token = url.hash.slice(5)
    if (token.startsWith('join.')) {
      const invite = automaticLanInvite(token.slice(5))
      return isAutomaticLanInvite(invite) ? invite : ''
    }
    return lanSignalFromToken(token)
  } catch { return '' }
}
