/**
 * Tema claro / oscuro (design system v0.2 §7.12). SIN React: es un pequeño "servicio" con estado y suscriptores,
 * como `auth/session.ts`. Los componentes lo leen con el hook `useTheme`.
 *
 * Reglas:
 * - Sin elección guardada: sigue al dispositivo (`prefers-color-scheme`), también en vivo. Los colores los cambia el
 *   CSS solo (bloque @media de tokens.css); aquí solo hace falta saberlo para el icono y la etiqueta del botón.
 * - Al elegir: `<html data-theme="light|dark">` y se guarda en ESTE navegador (`localStorage`, `cuartico.theme`).
 *   No es del usuario: no va al servidor ni se borra al cerrar sesión.
 * - Sin `localStorage` (navegación privada, bloqueado): la elección vale en memoria mientras dure la pestaña.
 * - Al cargar la página, `public/theme-init.js` ya puso `data-theme` antes de pintar (sin destello).
 */
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'cuartico.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
/** Color de la barra del navegador por tema (= `--theme-color` de tokens.css). */
const THEME_COLOR: Record<Theme, string> = { light: '#134e4a', dark: '#102624' }

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null // almacenamiento bloqueado: como si no hubiera elección
  }
}

/** Elección del usuario en este navegador (`null` = sigue al dispositivo). Se lee una vez y luego vive en memoria. */
let choice: Theme | null = readStored()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

function deviceTheme(): Theme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'
}

/** Pone (o quita) el atributo en `<html>` y ajusta el color de la barra del navegador. */
function apply(theme: Theme | null) {
  const root = document.documentElement
  if (theme) root.setAttribute('data-theme', theme)
  else root.removeAttribute('data-theme')
  // Con elección, las dos <meta name="theme-color"> (una por media query) llevan el color del tema elegido.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const media = meta.getAttribute('media')?.includes('dark') ? 'dark' : 'light'
    meta.content = THEME_COLOR[theme ?? media]
  })
}

/** Tema que se ve ahora: el elegido o, si no hay, el del dispositivo. */
export function getTheme(): Theme {
  return choice ?? deviceTheme()
}

/** Elige un tema: se aplica al instante (sin transición) y se recuerda en este navegador. */
export function setTheme(theme: Theme) {
  choice = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Sin almacenamiento: vale en memoria para esta pestaña; no se avisa al usuario (no es un error para él).
  }
  apply(theme)
  notify()
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

/**
 * Avisa de cualquier cambio: el del dispositivo (si no hay elección) y el de otra pestaña (evento `storage`).
 * Devuelve la función para darse de baja (el contrato de `useSyncExternalStore`).
 */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) stopListening = listenToBrowser() // una sola escucha del navegador para todos
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stopListening?.()
      stopListening = null
    }
  }
}
let stopListening: (() => void) | null = null

function listenToBrowser(): () => void {
  const mql = window.matchMedia?.(DARK_QUERY)
  const onDevice = () => {
    if (!choice) notify() // con elección, el dispositivo ya no manda
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return // otra pestaña eligió tema: la seguimos
    choice = isTheme(e.newValue) ? e.newValue : null
    apply(choice)
    notify()
  }
  mql?.addEventListener('change', onDevice)
  window.addEventListener('storage', onStorage)
  return () => {
    mql?.removeEventListener('change', onDevice)
    window.removeEventListener('storage', onStorage)
  }
}

/** Al arrancar (main.tsx): reaplica la elección guardada (theme-init.js ya puso el atributo) y ajusta las <meta>. */
export function initTheme() {
  if (choice) apply(choice)
}

/** Solo para tests: vuelve al estado de una pestaña nueva, sin elección. */
export function resetThemeForTests() {
  choice = readStored()
  apply(choice)
}
