import { createRoot } from 'react-dom/client'
// Self-hosted fonts (latin subset): no third-party requests, works offline
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800.css'
import '@fontsource/barlow-condensed/latin-800-italic.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import './styles/theme.css'
import App from './App'
import { initPersistence } from './state/persistence'

// Restore saved teams, settings and records before the first render
initPersistence()

createRoot(document.getElementById('root')).render(<App />)
