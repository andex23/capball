import { lanSignalToken, lanSignalFromToken } from './lan'
import { inviteUrl } from '../utils/inviteUrl'

export function lanInviteUrl(code, location = window.location) {
  const url = new URL(inviteUrl('lan', '', location))
  url.search = ''
  url.hash = 'lan=' + lanSignalToken(code)
  return url.href
}

export function readLanInvite(value) {
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || !url.hash.startsWith('#lan=')) return ''
    return lanSignalFromToken(url.hash.slice(5))
  } catch { return '' }
}
