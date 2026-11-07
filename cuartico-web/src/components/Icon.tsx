/**
 * Iconos SVG en línea (los mismos trazos que el prototipo de Lienzo): cero descargas extra.
 * Son decorativos (`aria-hidden`): el texto accesible lo pone siempre el botón o enlace que los contiene.
 */
const PATHS = {
  home: ['m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  box: ['M21 8 12 3 3 8v8l9 5 9-5z', 'm3 8 9 5 9-5M12 13v8'],
  user: ['M4 21a8 8 0 0 1 16 0', 'M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
  alert: ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18', 'M12 8v5M12 16h.01'],
  info: ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18', 'M12 11v5M12 8h.01'],
  check: ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18', 'm8 12 3 3 5-6'],
  empty: ['M21 8 12 3 3 8v8l9 5 9-5z', 'm3 8 9 5 9-5M12 13v8', 'M7.5 5.5l9 5'],
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'icon' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** Monograma de la marca (~300 bytes, sin imagen que descargar). */
export function BrandMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect width="28" height="28" rx="6" fill="currentColor" />
      <path d="M19 9.5a6 6 0 1 0 0 9" fill="none" stroke="var(--color-surface)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
