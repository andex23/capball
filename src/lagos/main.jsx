// Counterball inside Lagos Life. Same game as the website; this entry only
// leaves out what the Lagos Life frame doesn't allow (install prompt, service
// worker, analytics, Counterball accounts) and adds the Lagos Life SDK.
import './flag'
import { createRoot } from 'react-dom/client'
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
import { loadArtFonts } from '../game/capArt'
import App from '../App'
import { initPersistence } from '../state/persistence'
import { initTournamentWatch, useTournamentStore } from '../state/tournamentStore'
import { initAudioUnlock } from '../audio/SoundManager'
import { initSavedMatches } from '../state/savedMatch'
import { initClips } from '../game/clips'
import { initCapOverrides } from '../game/capOverrides'
import { useLagosStore, watchMatches } from './lagosStore'
import { initIosAudio } from './iosAudio'

initPersistence()
initTournamentWatch()
// Tournaments are played on this phone only (no LAN inside Lagos Life)
useTournamentStore.getState().setLocalTransport('device')
initAudioUnlock()
// Sound on iPhones with the silent switch on (see iosAudio.js)
initIosAudio()
initSavedMatches()
initClips()
initCapOverrides()
watchMatches()
useLagosStore.getState().boot()

// Cap artwork is drawn with the game's fonts: have them ready first (they're local, so this is quick)
Promise.race([loadArtFonts(), new Promise((r) => setTimeout(r, 1500))]).finally(() => {
  createRoot(document.getElementById('root')).render(<App />)
})
