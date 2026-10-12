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
import App from '../App'
import { initPersistence } from '../state/persistence'
import { initTournamentWatch, useTournamentStore } from '../state/tournamentStore'
import { initAudioUnlock } from '../audio/SoundManager'
import { initSavedMatches } from '../state/savedMatch'
import { initClips } from '../game/clips'
import { useLagosStore, watchMatches } from './lagosStore'

initPersistence()
initTournamentWatch()
// Tournaments are played on this phone only (no LAN inside Lagos Life)
useTournamentStore.getState().setLocalTransport('device')
initAudioUnlock()
initSavedMatches()
initClips()
watchMatches()
useLagosStore.getState().boot()

createRoot(document.getElementById('root')).render(<App />)
