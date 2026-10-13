import { createRoot } from 'react-dom/client'
// Self-hosted fonts (latin subset): no third-party requests, works offline
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800.css'
import '@fontsource/barlow-condensed/latin-800-italic.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/silkscreen/latin-400.css'
import '@fontsource/silkscreen/latin-700.css'
import './styles/theme.css'
import { loadArtFonts } from './game/capArt'
import App from './App'
import { initPersistence } from './state/persistence'
import { initTournamentWatch } from './state/tournamentStore'
import { initAudioUnlock } from './audio/SoundManager'
import { initAccount } from './state/accountStore'
import { initSavedMatches } from './state/savedMatch'
import { initClips } from './game/clips'
import { initInstallPrompt } from './pwa/install'
import { initAnalytics } from './analytics'
import { initCapOverrides } from './game/capOverrides'

// Restore saved teams, settings and records before the first render
initPersistence()
// Tournament fixtures: record results as matches finish
initTournamentWatch()
initAudioUnlock()
initAccount()
initSavedMatches()
initClips()
// The install prompt can fire before the menu mounts, so catch it early
initInstallPrompt()
initAnalytics()
// Ready-made cap names and wording set from the admin console
initCapOverrides()

// #dbcheck: a one-off live test of the online-tournament database
if (location.hash === '#dbcheck') {
  import('./online/DbCheckPage').then(({ default: DbCheckPage }) => {
    createRoot(document.getElementById('root')).render(<DbCheckPage />)
  })
} else {
  // Cap artwork is drawn with the game's fonts: have them ready first (they're local, so this is quick)
  Promise.race([loadArtFonts(), new Promise((r) => setTimeout(r, 1500))]).finally(() => {
    createRoot(document.getElementById('root')).render(<App />)
  })
}
