import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import './i18n'
import { App } from './app/App'
import { wireApiClient } from './app/wiring'

// Punto de entrada, como el `main` de una aplicación Spring Boot.
wireApiClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
