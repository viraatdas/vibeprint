import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import handFont from './fonts/ShantellSans-Informal-Regular.woff2?url'
import mapFont from './fonts/DejaVuSans.ttf?url'
import { App } from './App'
import './styles.css'

// Shantell Sans (SIL OFL 1.1, see fonts/OFL.txt): your typed text and the agent's notes share it.
const face = new FontFace('VP Hand', `url(${handFont})`)
document.fonts.add(face)
face.load().catch(() => {})
// Bundle the map face: server-computed wrapping must match the iPad and PNG export.
const sans = new FontFace('VP Map', `url(${mapFont})`)
document.fonts.add(sans)
sans.load().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
