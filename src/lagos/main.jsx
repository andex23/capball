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
    + '<p class="iss-press lg-wait" role="status" aria-label="Loading">Press start<span class="lg-cap" aria-hidden="true"><span class="lg-face"><svg viewBox="0 0 120 120" width="56" height="56"><defs><linearGradient id="lgE" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".45" stop-color="#d6a81e"/><stop offset="1" stop-color="#7a5200"/></linearGradient><radialGradient id="lgT" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#5b8cff"/><stop offset=".55" stop-color="#1d3fc4"/><stop offset="1" stop-color="#0d1f73"/></radialGradient></defs><polygon points="60.0,10.0 66.8,15.0 74.7,12.2 79.7,19.0 88.2,18.7 90.9,26.6 99.1,28.8 99.4,37.2 106.5,41.7 104.4,49.9 109.9,56.3 105.4,63.4 108.7,71.1 102.4,76.6 103.3,85.0 95.6,88.4 94.0,96.7 85.6,97.6 81.7,105.0 73.4,103.5 67.5,109.4 60.0,105.5 52.5,109.4 46.6,103.5 38.3,105.0 34.4,97.6 26.0,96.7 24.4,88.4 16.7,85.0 17.6,76.6 11.3,71.1 14.6,63.4 10.1,56.3 15.6,49.9 13.5,41.7 20.6,37.3 20.9,28.8 29.1,26.6 31.8,18.7 40.3,19.0 45.3,12.2 53.2,15.0" fill="url(#lgE)" stroke="#0b0830" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="60" r="38" fill="url(#lgT)" stroke="#0b0830" stroke-width="2.5"/><circle cx="60" cy="60" r="30" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="3.2 2.6"/><text x="60" y="70" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-style="italic" font-weight="800" font-size="30" fill="#ffd23f" stroke="#0b0830" stroke-width="2" paint-order="stroke">CB</text><ellipse cx="46" cy="40" rx="15" ry="8" fill="#fff" opacity=".28" transform="rotate(-30 46 40)"/></svg></span><span class="lg-face lg-back"><svg viewBox="0 0 120 120" width="56" height="56"><defs><linearGradient id="lgS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#a9b2bb"/><stop offset="1" stop-color="#5d6670"/></linearGradient><radialGradient id="lgK" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#e7c48d"/><stop offset="1" stop-color="#b98a4a"/></radialGradient></defs><polygon points="60.0,10.0 66.8,15.0 74.7,12.2 79.7,19.0 88.2,18.7 90.9,26.6 99.1,28.8 99.4,37.2 106.5,41.7 104.4,49.9 109.9,56.3 105.4,63.4 108.7,71.1 102.4,76.6 103.3,85.0 95.6,88.4 94.0,96.7 85.6,97.6 81.7,105.0 73.4,103.5 67.5,109.4 60.0,105.5 52.5,109.4 46.6,103.5 38.3,105.0 34.4,97.6 26.0,96.7 24.4,88.4 16.7,85.0 17.6,76.6 11.3,71.1 14.6,63.4 10.1,56.3 15.6,49.9 13.5,41.7 20.6,37.3 20.9,28.8 29.1,26.6 31.8,18.7 40.3,19.0 45.3,12.2 53.2,15.0" fill="url(#lgS)" stroke="#0b0830" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="60" r="38" fill="#7f8891" stroke="#0b0830" stroke-width="2"/><circle cx="60" cy="60" r="33" fill="url(#lgK)"/><circle cx="52" cy="54" r="1.6" fill="#8a5f2c"/><circle cx="66" cy="62" r="1.3" fill="#8a5f2c"/><circle cx="58" cy="71" r="1.5" fill="#8a5f2c"/><circle cx="70" cy="49" r="1.2" fill="#8a5f2c"/></svg></span></span><span class="lg-shadow" aria-hidden="true"></span></p><footer class="iss-foot"><span>© 2026 Counterball</span></footer></div></div>'
}
// ...and the fonts start downloading now too, instead of after signing in
for (const f of ['800 20px "Barlow Condensed"', 'italic 800 20px "Barlow Condensed"', '700 20px Inter', '700 20px Silkscreen']) document.fonts?.load?.(f).catch(() => {})

prepareLagosLaunch().then(async (connection) => {
  const { startGame } = await import('./startGame')
  startGame(connection)
})
