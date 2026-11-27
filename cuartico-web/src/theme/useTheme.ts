import { useSyncExternalStore } from 'react'
import { getTheme, subscribeTheme, toggleTheme, type Theme } from './theme'

/**
 * Tema actual y cómo cambiarlo, para los componentes. Es un hook "fino" sobre `theme.ts`, como `useSession` sobre
 * `session.ts`: `useSyncExternalStore` vuelve a pintar el componente cada vez que el servicio avisa de un cambio
 * (el usuario pulsa el botón, el móvil pasa a modo noche, otra pestaña elige tema).
 */
export function useTheme(): { theme: Theme; toggle: () => Theme } {
  const theme = useSyncExternalStore(subscribeTheme, getTheme)
  return { theme, toggle: toggleTheme }
}
