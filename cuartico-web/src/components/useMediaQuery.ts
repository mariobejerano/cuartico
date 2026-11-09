import { useSyncExternalStore } from 'react'

/**
 * ¿Cumple la pantalla esta media query? (p. ej. `'(min-width: 768px)'`). Se actualiza al girar el móvil o
 * redimensionar. Sirve para pintar UNA de dos vistas (tabla o tarjetas) en vez de las dos ocultando una con CSS.
 * Sin `matchMedia` (tests en jsdom) responde `false`: vista móvil.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia?.(query)
      mql?.addEventListener('change', onChange)
      return () => mql?.removeEventListener('change', onChange)
    },
    () => window.matchMedia?.(query).matches ?? false,
  )
}

export const DESKTOP_QUERY = '(min-width: 768px)'
