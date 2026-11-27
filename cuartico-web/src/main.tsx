import './config/zod' // el primero: configura Zod antes de que se cree ningún esquema (CSP, ver el archivo)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './i18n'
import { App } from './app/App'
import { wireApiClient } from './app/wiring'
import { initTheme } from './theme/theme'

// Punto de entrada, como el `main` de una aplicación Spring Boot.
wireApiClient()
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
