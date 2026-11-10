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
  plus: ['M12 5v14M5 12h14'],
  search: ['M11 4a7 7 0 1 1 0 14a7 7 0 1 1 0-14', 'm21 21-4.3-4.3'],
  left: ['m15 18-6-6 6-6'],
  right: ['m9 18 6-6-6-6'],
  up: ['m18 15-6-6-6 6'],
  down: ['m6 9 6 6 6-6'],
  x: ['M18 6 6 18M6 6l12 12'],
  'cloud-off': ['m2 2 20 20M5.8 8.6A5 5 0 0 0 7 18h10.5M20.6 15.6A4 4 0 0 0 17 9h-1.3A7 7 0 0 0 10 5.1'],
  lock: ['M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  // HU-15 (prototipo categories.html)
  tag: ['M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z', 'M7.5 6a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  dots: ['M5 10.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3', 'M12 10.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3', 'M19 10.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3'],
  edit: ['M4 20h4L19 9l-4-4L4 16z'],
  power: ['M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0'],
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
