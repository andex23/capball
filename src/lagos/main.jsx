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

prepareLagosLaunch().then(async (connection) => {
  const { startGame } = await import('./startGame')
  startGame(connection)
})
