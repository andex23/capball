// Establish the player's save before the game stores take their first snapshot.
import './flag'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800.css'
import '@fontsource/barlow-condensed/latin-800-italic.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/silkscreen/latin-400.css'
import '@fontsource/silkscreen/latin-700.css'
import '../styles/theme.css'
import './lagos.css'
import { prepareLagosLaunch } from './launch'

// The title card shows straight away, while Lagos Life signs the player in: the
// logo drops in and shines, and a bottle cap spins where "Press start" will be.
// The game then draws the same card with "Press start", so nothing jumps
const root = document.getElementById('root')
if (root && !root.firstChild) {
  root.innerHTML = '<div class="screen iss lg-loading"><div class="iss-backdrop" aria-hidden="true"><div class="iss-sky"></div><div class="iss-pitch"></div><div class="iss-scan"></div></div>'
    + '<div class="iss-layout"><header class="iss-brand"><h1 class="iss-logo" aria-label="Counterball"><span class="iss-logo-depth" aria-hidden="true">COUNTERBALL</span><span class="iss-logo-word">COUNTERBALL</span></h1><div class="iss-ribbon">Tabletop Football</div></header>'
    + '<p class="iss-press lg-wait" role="status" aria-label="Loading">Press start<span class="lg-cap" aria-hidden="true"></span></p><footer class="iss-foot"><span>© 2026 Counterball</span></footer></div></div>'
}
// ...and the fonts start downloading now too, instead of after signing in
for (const f of ['800 20px "Barlow Condensed"', 'italic 800 20px "Barlow Condensed"', '700 20px Inter', '700 20px Silkscreen']) document.fonts?.load?.(f).catch(() => {})

prepareLagosLaunch().then(async (connection) => {
  const { startGame } = await import('./startGame')
  startGame(connection)
})
