import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import handFont from '@tldraw/assets/fonts/Shantell_Sans-Informal_Regular.woff2?url'
import { App } from './App'
import './styles.css'

// The agent writes in the same hand as the canvas pen, everywhere it speaks.
const face = new FontFace('VP Hand', `url(${handFont})`)
face.load().then((f) => document.fonts.add(f)).catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
