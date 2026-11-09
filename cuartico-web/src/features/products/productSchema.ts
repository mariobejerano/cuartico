import { z } from 'zod'
import { UNITS, type CreateProductRequest, type ProductResponse, type UnitOfMeasure } from '../../api/types'
import { decimalToInput, inputToDecimal } from './format'

/** Monedas del precio (CA-6/CA-25). Igual que `app.currencies.supported` del backend; se amplía aquí y allí. */
export const CURRENCIES = ['CUP', 'USD'] as const
/** Moneda preseleccionada en un producto nuevo: siempre USD (decisión de la supervisión, 2026-11-05). */
export const DEFAULT_CURRENCY = 'USD'

/**
 * Mensaje de error con variables. Zod solo guarda un texto, así que lo codificamos como `clave|{"max":120}` y
 * `fieldErrorText` lo traduce al pintar. Seguimos guardando CLAVES, no textos (cambian con el idioma).
 */
export const msg = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}|${JSON.stringify(vars)}` : key)

export function parseMsg(message: string): { key: string; vars?: Record<string, unknown> } {
  const i = message.indexOf('|')
  if (i < 0) return { key: message }
  return { key: message.slice(0, i), vars: JSON.parse(message.slice(i + 1)) as Record<string, unknown> }
}

/** Mismas reglas que la API (HU-02, campos del producto). Sin `trim` previo en los números: lo hace la regex. */
const PRICE_RE = /^\d{1,10}([.,]\d{1,2})?$/
const MIN_STOCK_RE = /^\d{1,9}([.,]\d{1,3})?$/
const SKU_RE = /^[A-Za-z0-9._-]*$/

/**
 * Esquema del formulario: el equivalente al `CreateProductRequest` con Bean Validation. Todos los valores son
 * TEXTO (lo que hay en los `<input>`); `toRequest` los convierte a lo que espera la API.
 */
export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, msg('validation.required'))
    .max(120, msg('validation.max_length', { max: 120 })),
  sku: z
    .string()
    .trim()
    .max(50, msg('validation.max_length', { max: 50 }))
    .regex(SKU_RE, msg('product.sku_pattern')),
  category: z.string().trim().max(50, msg('validation.max_length', { max: 50 })),
  // '' = «Elige una unidad» (aún sin elegir): se rechaza con «obligatorio».
  unit: z.union([z.enum(UNITS), z.literal('')]).refine((v) => v !== '', msg('validation.required')),
  minStock: z
    .string()
    .trim()
    .min(1, msg('validation.required'))
    .regex(MIN_STOCK_RE, msg('product.min_stock_format')),
  salePrice: z
    .string()
    .trim()
    .refine((v) => v === '' || PRICE_RE.test(v), msg('product.price_format')),
  salePriceCurrency: z.string().min(1),
})

/** Valores del formulario (lo que se escribe). `z.input` porque `unit` admite '' mientras se rellena. */
export type ProductFormValues = z.input<typeof productFormSchema>

/** Valores iniciales: vacíos en un alta (mínimo 0 y USD), los del producto en una edición. */
export function toFormValues(product: ProductResponse | null, lang: string): ProductFormValues {
  if (!product) {
    return { name: '', sku: '', category: '', unit: '', minStock: '0', salePrice: '', salePriceCurrency: DEFAULT_CURRENCY }
  }
  return {
    name: product.name,
    sku: product.sku ?? '',
    category: product.category ?? '',
    unit: product.unit,
    minStock: decimalToInput(product.minStock, lang),
    salePrice: decimalToInput(product.salePrice, lang),
    salePriceCurrency: product.salePriceCurrency ?? DEFAULT_CURRENCY,
  }
}

/**
 * Del formulario al cuerpo de la API. Normaliza igual que el backend (CA-2): recorta, SKU en mayúsculas,
 * vacío → `null`. Si el importe está vacío, precio y moneda van a `null` (CA-25): así nunca se produce
 * `product.price_currency_mismatch` desde la interfaz.
 */
export function toRequest(values: ProductFormValues): CreateProductRequest {
  const sku = values.sku.trim().toUpperCase()
  const category = values.category.trim()
  const salePrice = inputToDecimal(values.salePrice)
  return {
    name: values.name.trim(),
    sku: sku || null,
    unit: values.unit as UnitOfMeasure,
    category: category || null,
    minStock: inputToDecimal(values.minStock) ?? 0,
    salePrice,
    salePriceCurrency: salePrice === null ? null : values.salePriceCurrency,
  }
}

/** Campos del formulario a los que se pueden asignar los `errors` de un 400 `validation.failed`. */
export const FORM_FIELDS = ['name', 'sku', 'category', 'unit', 'minStock', 'salePrice', 'salePriceCurrency'] as const
export type ProductFormField = (typeof FORM_FIELDS)[number]
export const isFormField = (f: string): f is ProductFormField => (FORM_FIELDS as readonly string[]).includes(f)
