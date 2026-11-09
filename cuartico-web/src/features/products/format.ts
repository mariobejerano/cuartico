/**
 * Formato de números, importes y fechas con `Intl` (CA-28): «3,50 USD» en español, «3.50 USD» en inglés.
 * Funciones puras (sin React): reutilizables en React Native.
 * `useGrouping: 'always'` porque en español Intl no agrupa los números de 4 cifras (3200 → «3.200»).
 */
const NBSP = ' ' // espacio duro: «36 u» nunca se parte en dos líneas

export function formatMoney(amount: number, currency: string, lang: string): string {
  const n = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })
  return `${n.format(amount)}${NBSP}${currency}`
}

export function formatQuantity(amount: number, unitShort: string, lang: string): string {
  const n = new Intl.NumberFormat(lang, { maximumFractionDigits: 3, useGrouping: 'always' })
  return `${n.format(amount)}${NBSP}${unitShort}`
}

export function formatDateTime(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

/** Número de la API → texto del campo, con la coma decimal en español («12,5»). `null` → vacío. */
export function decimalToInput(n: number | null | undefined, lang: string): string {
  if (n === null || n === undefined) return ''
  const s = String(n)
  return lang.startsWith('es') ? s.replace('.', ',') : s
}

/** Texto del campo (con coma o punto) → número JSON para la API. Vacío → `null`. */
export function inputToDecimal(text: string): number | null {
  const s = text.trim()
  return s ? Number(s.replace(',', '.')) : null
}
