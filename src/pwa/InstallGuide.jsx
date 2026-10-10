import Icon from '../ui/Icon'
import { isIos } from './install'

/** Which device and browser this is, for the right set of steps. */
export function platformOf(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  const ua = nav.userAgent || ''
  if (/FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok/i.test(ua)) return 'inapp'
  if (isIos(nav)) return /CriOS|FxiOS|EdgiOS/i.test(ua) ? 'ios-other' : 'ios-safari'
  if (/Android/i.test(ua)) return /SamsungBrowser/i.test(ua) ? 'samsung' : 'android'
  return 'desktop'
}

const STEPS = {
  'ios-safari': ['Tap the Share button (the square with an arrow) at the bottom of Safari.', 'Scroll down and tap Add to Home Screen.', 'Tap Add — Counter Ball appears on your home screen.'],
  'ios-other': ['Tap the Share button next to the address bar.', 'Tap Add to Home Screen. (Not there? Open capball.vercel.app in Safari and do it from there.)', 'Tap Add.'],
  android: ['Tap the ⋮ menu at the top right of Chrome.', 'Tap Install app (or Add to Home screen).', 'Tap Install — Counter Ball opens full screen like any other app.'],
  samsung: ['Tap the ☰ menu at the bottom right.', 'Tap Add page to → Home screen.', 'Tap Add.'],
  desktop: ['In Chrome or Edge, click the install icon at the right end of the address bar (a screen with a down arrow).', 'Or open the browser menu and choose Install Counter Ball / Apps → Install this site as an app.', 'Counter Ball opens in its own window and gets a desktop and Start menu icon.'],
  inapp: ['You’re in an app’s built-in browser, which can’t install games.', 'Tap ⋯ or the share icon and choose Open in Safari / Open in Chrome.', 'Then come back here and tap Add to Home Screen again.'],
}

/** Step-by-step install instructions for this device. */
export default function InstallGuide() {
  const p = platformOf()
  return (
    <div className="install-guide">
      <p className="t-note">Put Counter Ball on your home screen and it opens full screen, like an app — no app store, and it still works when your signal drops.</p>
      <ol className="install-steps">
        {STEPS[p].map((s, i) => <li key={i}><span className="install-step-n">{i + 1}</span><span>{s}</span></li>)}
      </ol>
      {p !== 'desktop' && p !== 'inapp' && <p className="muted t-note"><Icon name="check" size={14} /> Sign in on the home-screen app and your saved games, kits and career come with you.</p>}
    </div>
  )
}
