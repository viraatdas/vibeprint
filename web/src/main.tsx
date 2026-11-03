import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import handFont from './fonts/ShantellSans-Informal-Regular.woff2?url'
import { App } from './App'
import './styles.css'

// Shantell Sans (SIL OFL 1.1, see fonts/OFL.txt): your typed text and the agent's notes share it.
const face = new FontFace('VP Hand', `url(${handFont})`)
face.load().then((f) => document.fonts.add(f)).catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
