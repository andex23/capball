// The admin page (/admin): its own small app, not part of the game bundle.
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800.css'
import '@fontsource/barlow-condensed/latin-800-italic.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import './admin.css'
import AdminApp from './AdminApp'

createRoot(document.getElementById('root')).render(<AdminApp />)
