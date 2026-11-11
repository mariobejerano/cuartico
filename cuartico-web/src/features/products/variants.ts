import type { ProductResponse, VariantRequest, VariantResponse } from '../../api/types'
import { inputToDecimal } from './format'

/**
 * Lógica pura de las variantes (HU-16): orden, normalización, generador talla × color y SKU sugerido.
 * Sin React ni DOM: se prueba con tests unitarios simples y se reutilizará tal cual en React Native.
 * Analogía: un `VariantHelper` con métodos estáticos.
 */

/** Las opciones de una variante (talla, color o ambos). */
export interface VariantOptions {
  size: string | null
  color: string | null
}

/** Una fila «por guardar» (alta del producto o «Añadir variantes»). SKU y mínimo son TEXTO: lo que hay en los inputs. */
export interface DraftVariant extends VariantOptions {
  /** Identificador local de la fila (no es de la API): sirve de `key` en React y para los `id` de los campos. */
  key: string
  sku: string
  minStock: string
}

export const MAX_VARIANTS = 100
export const SIZE_MAX = 20
export const COLOR_MAX = 30
/** Tallas «habituales» del generador (un toque por talla). */
export const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

// ----- Normalización (la misma que el backend, CA-6) -----

/** Talla: recortada y en mayúsculas (« m » → «M»); vacía → `null`. */
export const normalizeSize = (s: string | null | undefined) => (s ?? '').trim().toUpperCase() || null
/** Color: recortado y como se escribió («Azul marino»); vacío → `null`. */
export const normalizeColor = (s: string | null | undefined) => (s ?? '').trim() || null

/**
 * Clave para comparar opciones: la talla ya va en mayúsculas y el color se compara en minúsculas, como hace la BD
 * (`color_key = LOWER(TRIM(color))`): «Rojo» y «rojo» son el mismo color (CA-7). Las tildes SÍ cuentan.
 */
export const optionKey = (o: VariantOptions) =>
  `${normalizeSize(o.size) ?? ''}|${(normalizeColor(o.color) ?? '').toLowerCase()}`

/** Quita las tildes («Marrón» → «Marron»). `normalize('NFD')` separa la letra de su tilde y `\p{M}` borra la tilde. */
const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')

/**
 * Aviso (no bloquea, igual que en categorías): un color que solo se diferencia de otro en las tildes
 * («Marron» y «Marrón»). Para la BD son colores distintos; casi siempre es un despiste. Devuelve el parecido o `null`.
 */
export function findSimilarColor(color: string, others: readonly (string | null)[]): string | null {
  const key = color.trim().toLowerCase()
  if (!key) return null
  const loose = stripAccents(key)
  return others.find((o) => !!o && o.trim().toLowerCase() !== key && stripAccents(o.trim().toLowerCase()) === loose) ?? null
}

/** El primer color de `colors` que se parece (solo por tildes) a otro elegido o a uno de `existing`. */
export function firstSimilarColor(colors: readonly string[], existing: readonly (string | null)[]) {
  const known = [...existing, ...colors]
  for (const color of colors) {
    const other = findSimilarColor(color, known)
    if (other) return { color, other }
  }
  return null
}

/** Nombre visible de una variante: «M · Blanco», «38», «Rojo». */
export const variantName = (o: VariantOptions) => [o.size, o.color].filter(Boolean).join(' · ')

/** Las opciones como las escribe el backend en `variant.options_conflict` (`{0}` = «M / Rojo»). */
export const optionsLabel = (o: VariantOptions) => [o.size, o.color].filter(Boolean).join(' / ')

// ----- Orden (CA-14). La API ya devuelve `variants[]` ordenadas; el generador ordena igual sus filas -----

const CANONICAL_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
const SIZE_ALIASES: Record<string, string> = { '2XL': 'XXL', '3XL': 'XXXL' }
const NUMERIC_SIZE = /^\d+([.,]\d+)?$/

/** Rango de una talla: [grupo, número, texto]. Grupos: 0 canónicas, 1 numéricas, 2 resto, 3 sin talla. */
function sizeRank(size: string | null): [number, number, string] {
  if (size === null) return [3, 0, '']
  const s = SIZE_ALIASES[size] ?? size
  const canonical = CANONICAL_SIZES.indexOf(s)
  if (canonical >= 0) return [0, canonical, '']
  if (NUMERIC_SIZE.test(s)) return [1, Number(s.replace(',', '.')), '']
  return [2, 0, s.toLowerCase()]
}

/** Comparador de CA-14: tallas canónicas, numéricas, resto alfabético, sin talla al final; luego color; luego id. */
export function compareVariants(a: VariantOptions & { id?: number }, b: VariantOptions & { id?: number }): number {
  const ra = sizeRank(normalizeSize(a.size))
  const rb = sizeRank(normalizeSize(b.size))
  return (
    ra[0] - rb[0] ||
    ra[1] - rb[1] ||
    ra[2].localeCompare(rb[2], 'es') ||
    // Sin color al final del grupo («￿» ordena detrás de cualquier letra).
    (a.color ?? '￿').localeCompare(b.color ?? '￿', 'es', { sensitivity: 'base' }) ||
    (a.id ?? 0) - (b.id ?? 0)
  )
}

// ----- Generador talla × color (CA-21, D-2) -----

/** «S, m ,, L» → ['S', 'm', 'L']: separa por comas y quita los vacíos. */
export const splitTokens = (text: string) =>
  text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

/** Añade tallas: en mayúsculas, sin repetir y ordenadas como la API. */
export function addSizes(current: readonly string[], text: string): string[] {
  const next = [...current]
  for (const raw of splitTokens(text)) {
    const size = raw.toUpperCase().slice(0, SIZE_MAX)
    if (!next.includes(size)) next.push(size)
  }
  return next.sort((a, b) => compareVariants({ size: a, color: null }, { size: b, color: null }))
}

/** Añade colores: se respeta cómo se escriben, sin repetir sin distinguir mayúsculas («Rojo» = «rojo»). */
export function addColors(current: readonly string[], text: string): string[] {
  const next = [...current]
  for (const raw of splitTokens(text)) {
    const color = raw.slice(0, COLOR_MAX)
    if (!next.some((c) => c.toLowerCase() === color.toLowerCase())) next.push(color)
  }
  return next
}

/** Todas las combinaciones. Sin tallas → solo colores (y al revés). Sin nada → ninguna. */
export function combinations(sizes: readonly string[], colors: readonly string[]): VariantOptions[] {
  if (sizes.length === 0 && colors.length === 0) return []
  const ss = sizes.length ? sizes : [null]
  const cs = colors.length ? colors : [null]
  return ss.flatMap((size) => cs.map((color) => ({ size, color })))
}

/** Separa las combinaciones nuevas de las que ya existen (en el producto o en la lista por guardar). */
export function splitNew<T extends VariantOptions>(combos: readonly T[], existing: readonly VariantOptions[]) {
  const keys = new Set(existing.map(optionKey))
  const fresh = combos.filter((c) => !keys.has(optionKey(c)))
  return { fresh, skipped: combos.length - fresh.length }
}

/** Prefijo de SKU tal como se usará: mayúsculas y solo los caracteres que admite un SKU. */
export const cleanPrefix = (s: string) => s.toUpperCase().replace(/[^A-Z0-9._-]/g, '')

/**
 * Código corto de un color para el SKU, sin tildes: «Blanco» → «BLA», «Azul marino» → «AZM», «Marrón» → «MAR».
 * Una palabra: sus 3 primeras letras; varias: 2 de la primera + la inicial de las demás (máximo 4).
 */
export function colorCode(color: string): string {
  const words = stripAccents(color)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 3)
  return (words[0].slice(0, 2) + words.slice(1).map((w) => w[0]).join('')).slice(0, 4)
}

/**
 * SKU sugerido (D-2): `PREFIJO-TALLA-COLOR` («CAM-M-BLA»). Si ya está en `taken`, añade «-2», «-3»…
 * Sin prefijo no sugiere nada (el SKU es opcional). Añade el elegido a `taken` para que la siguiente fila no choque.
 */
export function suggestSku(prefix: string, o: VariantOptions, taken: Set<string>): string {
  const p = cleanPrefix(prefix)
  if (!p) return ''
  const size = o.size ? o.size.replace(/[^A-Z0-9.]/g, '') : ''
  const base = [p, size, o.color ? colorCode(o.color) : ''].filter(Boolean).join('-').slice(0, 46)
  let sku = base
  for (let n = 2; taken.has(sku); n++) sku = `${base}-${n}`
  taken.add(sku)
  return sku
}

/** Id del campo «Tallas» de un generador (`<VariantGenerator idPrefix>`), para llevar el foco ahí desde fuera. */
export const generatorSizeId = (idPrefix: string) => `${idPrefix}-size`

let draftSeq = 0
/** Crea las filas por guardar de unas combinaciones, con su SKU sugerido y el mínimo común. */
export function draftsFor(
  combos: readonly VariantOptions[],
  opts: { prefix: string; minStock: string; takenSkus: Iterable<string> },
): DraftVariant[] {
  const taken = new Set([...opts.takenSkus].filter(Boolean))
  return combos.map((c) => ({
    key: `d${++draftSeq}`,
    size: c.size,
    color: c.color,
    sku: suggestSku(opts.prefix, c, taken),
    minStock: opts.minStock,
  }))
}

/** Une filas nuevas a las que ya había, sin duplicar opciones, en el orden de la API. */
export function mergeDrafts(current: readonly DraftVariant[], added: readonly DraftVariant[]): DraftVariant[] {
  return [...current, ...splitNew(added, current).fresh].sort(compareVariants)
}

/** La primera fila nueva en el orden en que se ven (para llevarle el foco). */
export const firstAdded = (merged: readonly DraftVariant[], added: readonly DraftVariant[]) =>
  merged.find((r) => added.some((a) => a.key === r.key)) ?? null

/** Fila por guardar → cuerpo de la API (SKU en mayúsculas, vacío → `null`; mínimo como número). */
export const draftToRequest = (d: DraftVariant): VariantRequest => ({
  sku: d.sku.trim().toUpperCase() || null,
  size: normalizeSize(d.size),
  color: normalizeColor(d.color),
  minStock: inputToDecimal(d.minStock) ?? 0,
})

// ----- Errores del servidor que hay que llevar a una fila (CA-21) -----

/** `errors["variants[2].sku"]` → `{ index: 2, field: 'sku' }`. */
export function parseVariantErrorPath(path: string): { index: number; field: string } | null {
  const m = /^variants\[(\d+)\]\.(\w+)$/.exec(path)
  return m ? { index: Number(m[1]), field: m[2] } : null
}

/**
 * ¿Qué fila provocó un `product.sku_conflict`? La API no lo dice en un campo: el SKU va dentro del `detail`
 * («El SKU CAM-M-BLA ya lo usa…»). Buscamos la fila cuyo SKU aparece como palabra completa (así «CAM-M» no
 * coincide con «CAM-M-BLA»). Si no se puede saber, `-1` y el error va arriba.
 */
export function rowForSkuConflict(skus: readonly string[], detail: string | undefined): number {
  if (!detail) return -1
  const text = detail.toUpperCase()
  return skus.findIndex((raw) => {
    const sku = raw.trim().toUpperCase()
    if (!sku) return false
    const escaped = sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^A-Z0-9._-])${escaped}($|[^A-Z0-9._-])`).test(text)
  })
}

/** Igual para `variant.options_conflict` (`{0}` = «M / Rojo», sin distinguir mayúsculas). */
export function rowForOptionsConflict(rows: readonly VariantOptions[], detail: string | undefined): number {
  if (!detail) return -1
  const text = detail.toLowerCase()
  // Las de más texto primero: «M / Rojo» antes que «M».
  const candidates = rows
    .map((r, i) => ({ i, label: optionsLabel(r).toLowerCase() }))
    .filter((c) => c.label)
    .sort((a, b) => b.label.length - a.label.length)
  return candidates.find((c) => text.includes(c.label))?.i ?? -1
}

/** Un error del servidor ya asignado a una fila por guardar. `options` = talla/color de la fila. */
export interface RowError {
  index: number
  field: 'sku' | 'minStock' | 'options'
  message: string
}

/**
 * Lleva un error de la API a las filas por guardar (CA-21): `validation.failed` con `errors["variants[2].sku"]`,
 * `product.sku_conflict` y `variant.options_conflict` (en la fila que se pueda identificar). Lista vacía = no se pudo:
 * quien llama lo muestra arriba. Recibe datos simples (no el `ApiError`) para seguir siendo lógica pura.
 */
export function rowErrorsFrom(
  problem: { code?: string; detail?: string; errors?: Record<string, string> },
  rows: readonly (VariantOptions & { sku: string })[],
): RowError[] {
  const fallback = problem.detail ?? ''
  switch (problem.code) {
    case 'product.sku_conflict': {
      const index = rowForSkuConflict(
        rows.map((r) => r.sku),
        problem.detail,
      )
      return index < 0 ? [] : [{ index, field: 'sku', message: fallback }]
    }
    case 'variant.options_conflict':
    case 'variant.options_required': {
      const index = rowForOptionsConflict(rows, problem.detail)
      return index < 0 ? [] : [{ index, field: 'options', message: fallback }]
    }
    case 'validation.failed':
      return Object.entries(problem.errors ?? {}).flatMap(([path, message]) => {
        const p = parseVariantErrorPath(path)
        if (!p || p.index >= rows.length) return []
        const field = p.field === 'sku' || p.field === 'minStock' ? p.field : 'options'
        return [{ index: p.index, field, message }]
      })
    default:
      return []
  }
}

// ----- Respuestas de la API -----

/**
 * Tras una operación de VARIANTE, nos quedamos con lo que cambia (variantes, contador y stock agregado) pero NO con la
 * `version` ni los campos del producto: el formulario sigue protegido por la versión con la que se abrió (CA-13b).
 * Si copiáramos la versión de la respuesta, un cambio de otra persona en el producto se pisaría sin 409.
 */
export function mergeVariantData(current: ProductResponse, fromApi: ProductResponse): ProductResponse {
  return {
    ...current,
    hasVariants: fromApi.hasVariants,
    variantCount: fromApi.variantCount,
    variants: fromApi.variants,
    stock: fromApi.stock,
    lowStock: fromApi.lowStock,
  }
}

/** Las variantes de un producto (vacío en el listado, donde la API no las manda). */
export const variantsOf = (p: Pick<ProductResponse, 'variants'>): VariantResponse[] => p.variants ?? []
