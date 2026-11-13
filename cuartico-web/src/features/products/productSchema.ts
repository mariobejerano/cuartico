import { z } from 'zod'
import {
  UNITS,
  type CreateProductRequest,
  type ProductResponse,
  type ProductType,
  type UnitOfMeasure,
  type UpdateProductRequest,
  type VariantResponse,
} from '../../api/types'
import { msg } from '../../components/fieldMessage'
import { DEFAULT_CURRENCY } from '../../config/currencies'
import { decimalToInput, inputToDecimal } from './format'
import { isUnitLocked, LOCKED_UNIT, usesApplianceFields } from './typeRules'
import {
  COLOR_MAX,
  draftToRequest,
  MAX_VARIANTS,
  normalizeColor,
  normalizeSize,
  optionKey,
  optionsLabel,
  SIZE_MAX,
  type DraftVariant,
} from './variants'

/** Mismas reglas que la API (HU-02 y HU-15, campos del producto). Sin `trim` previo en los números: lo hace la regex. */
const PRICE_RE = /^\d{1,10}([.,]\d{1,2})?$/
const MIN_STOCK_RE = /^\d{1,9}([.,]\d{1,3})?$/
const SKU_RE = /^[A-Za-z0-9._-]*$/
const WARRANTY_RE = /^\d{1,3}$/
const SKU_MAX = 50
export const MAX_WARRANTY_MONTHS = 120

/** Cómo sabe el formulario el tipo de la categoría elegida (lo resuelve quien tiene la lista de categorías). */
export type TypeOfCategory = (categoryId: string) => ProductType | null

/** Error de un SKU (o `null`): longitud y caracteres, como `@Size` + `@Pattern` del DTO. */
function skuError(raw: string): string | null {
  const sku = raw.trim()
  if (sku.length > SKU_MAX) return msg('validation.max_length', { max: SKU_MAX })
  if (!SKU_RE.test(sku)) return msg('product.sku_pattern')
  return null
}

/** Error de un stock mínimo (o `null`): obligatorio, ≥ 0 y hasta 3 decimales. */
function minStockError(raw: string): string | null {
  const v = raw.trim()
  if (!v) return msg('validation.required')
  if (!MIN_STOCK_RE.test(v)) return msg('product.min_stock_format')
  return null
}

/**
 * Valida una lista de filas por guardar (alta con variantes o «Añadir variantes», CA-21):
 * SKU y mínimo de cada fila, SKU repetido entre filas o con `takenSkus` (las variantes que ya existen),
 * al menos una fila y máximo `max`. Los errores van a `variants.<i>.sku`, etc.: React Hook Form los pinta en su fila.
 */
function checkDraftRows(rows: DraftVariant[], ctx: z.RefinementCtx, opts: { takenSkus: readonly string[]; max: number }) {
  if (rows.length === 0) ctx.addIssue({ code: 'custom', path: ['variants'], message: msg('variants.required') })
  if (rows.length > opts.max) ctx.addIssue({ code: 'custom', path: ['variants'], message: msg('variants.max') })
  const skus = rows.map((r) => r.sku.trim().toUpperCase())
  const taken = new Set(opts.takenSkus.map((s) => s.toUpperCase()))
  rows.forEach((row, i) => {
    const sku = skus[i]
    const repeated = !!sku && (skus.some((o, j) => j !== i && o === sku) || taken.has(sku))
    const skuMsg = skuError(row.sku) ?? (repeated ? msg('variant.sku_repeated') : null)
    if (skuMsg) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: skuMsg })
    const minMsg = minStockError(row.minStock)
    if (minMsg) ctx.addIssue({ code: 'custom', path: ['variants', i, 'minStock'], message: minMsg })
  })
}

/** Una fila por guardar tal como vive en el formulario (todo texto; talla y color no se editan en la fila). */
const draftRowSchema = z.object({
  key: z.string(),
  size: z.string().nullable(),
  color: z.string().nullable(),
  sku: z.string(),
  minStock: z.string(),
})

/**
 * Esquema del formulario: el equivalente al `CreateProductRequest` con Bean Validation. Todos los valores son TEXTO
 * (lo que hay en los `<input>`); `toRequest` los convierte a lo que espera la API.
 *
 * Es una FÁBRICA (`buildProductFormSchema(typeOf, mode)`) porque algunas reglas dependen de otro campo o del contexto:
 * modelo y garantía solo se validan si la categoría elegida es de electrodomésticos, la unidad no se pide si el tipo
 * la fija, y (HU-16) SKU y mínimo del producto solo se piden si NO tiene variantes; si tiene, en un ALTA se validan
 * las filas generadas (en una edición las variantes viven en su propia tarjeta, fuera de este formulario).
 * Como un validador de clase (`@ScriptAssert`/`ConstraintValidator` a nivel de clase) en Bean Validation.
 */
export function buildProductFormSchema(typeOf: TypeOfCategory, mode: 'create' | 'edit' = 'create') {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, msg('validation.required'))
        .max(120, msg('validation.max_length', { max: 120 })),
      categoryId: z.string().min(1, msg('validation.required')), // '' = «Elige una categoría» (CA-13)
      brand: z.string().trim().max(80, msg('validation.max_length', { max: 80 })),
      model: z.string(),
      warrantyMonths: z.string(),
      // '' = «Elige una unidad» (aún sin elegir). Si el tipo la fija, la pone el formulario (ver superRefine).
      unit: z.union([z.enum(UNITS), z.literal('')]),
      sku: z.string(),
      minStock: z.string(),
      salePrice: z
        .string()
        .trim()
        .refine((v) => v === '' || PRICE_RE.test(v), msg('product.price_format')),
      salePriceCurrency: z.string().min(1),
      /** HU-16: «Tiene tallas o colores». En una edición es el estado del producto (aquí no se cambia). */
      hasVariants: z.boolean(),
      /** Filas por guardar del alta con variantes (en una edición, siempre vacía). */
      variants: z.array(draftRowSchema),
    })
    .superRefine((values, ctx) => {
      const type = typeOf(values.categoryId)
      if (values.unit === '' && !isUnitLocked(type)) {
        ctx.addIssue({ code: 'custom', path: ['unit'], message: msg('validation.required') })
      }
      if (!values.hasVariants) {
        const skuMsg = skuError(values.sku)
        if (skuMsg) ctx.addIssue({ code: 'custom', path: ['sku'], message: skuMsg })
        const minMsg = minStockError(values.minStock)
        if (minMsg) ctx.addIssue({ code: 'custom', path: ['minStock'], message: minMsg })
      } else if (mode === 'create') {
        checkDraftRows(values.variants, ctx, { takenSkus: [], max: MAX_VARIANTS })
      }
      // Campos ocultos (otro tipo) no se validan: no se envían (ver toRequest).
      if (!usesApplianceFields(type)) return
      if (values.model.trim().length > 80) {
        ctx.addIssue({ code: 'custom', path: ['model'], message: msg('validation.max_length', { max: 80 }) })
      }
      const w = values.warrantyMonths.trim()
      if (w !== '' && (!WARRANTY_RE.test(w) || Number(w) > MAX_WARRANTY_MONTHS)) {
        ctx.addIssue({ code: 'custom', path: ['warrantyMonths'], message: msg('product.warranty_format') })
      }
    })
}

/** Valores del formulario (lo que se escribe). `z.input` porque `unit` admite '' mientras se rellena. */
export type ProductFormValues = z.input<ReturnType<typeof buildProductFormSchema>>

/** Valores iniciales: vacíos en un alta (mínimo 0 y USD), los del producto en una edición. */
export function toFormValues(product: ProductResponse | null, lang: string): ProductFormValues {
  if (!product) {
    return {
      name: '',
      categoryId: '',
      brand: '',
      model: '',
      warrantyMonths: '',
      unit: '',
      sku: '',
      minStock: '0',
      salePrice: '',
      salePriceCurrency: DEFAULT_CURRENCY,
      hasVariants: false,
      variants: [],
    }
  }
  return {
    name: product.name,
    categoryId: String(product.category.id),
    brand: product.brand ?? '',
    model: product.model ?? '',
    warrantyMonths: product.warrantyMonths === null ? '' : String(product.warrantyMonths),
    unit: product.unit,
    sku: product.sku ?? '',
    // Con variantes el producto no tiene mínimo propio (`null`): el campo no se ve y no se envía.
    minStock: product.minStock === null ? '0' : decimalToInput(product.minStock, lang),
    salePrice: decimalToInput(product.salePrice, lang),
    salePriceCurrency: product.salePriceCurrency ?? DEFAULT_CURRENCY,
    hasVariants: product.hasVariants,
    variants: [],
  }
}

const textOrNull = (s: string) => s.trim() || null

/** Campos del producto comunes al alta y a la edición. */
function productFields(values: ProductFormValues, type: ProductType | null) {
  const salePrice = inputToDecimal(values.salePrice)
  const appliance = usesApplianceFields(type)
  const warranty = values.warrantyMonths.trim()
  const simple = !values.hasVariants
  return {
    name: values.name.trim(),
    // HU-16: un producto con variantes no lleva SKU ni mínimo propios (si no, 400 product.variant_fields_not_allowed).
    sku: simple ? values.sku.trim().toUpperCase() || null : null,
    unit: isUnitLocked(type) ? LOCKED_UNIT : (values.unit as UnitOfMeasure),
    categoryId: Number(values.categoryId),
    brand: textOrNull(values.brand),
    model: appliance ? textOrNull(values.model) : null,
    warrantyMonths: appliance && warranty ? Number(warranty) : null,
    minStock: simple ? (inputToDecimal(values.minStock) ?? 0) : null,
    salePrice,
    salePriceCurrency: salePrice === null ? null : values.salePriceCurrency,
  }
}

/**
 * Del formulario al cuerpo del ALTA. Normaliza igual que el backend (CA-2): recorta, SKU en mayúsculas, vacío → `null`.
 * Si el importe está vacío, precio y moneda van a `null` (CA-25): así nunca se produce `product.price_currency_mismatch`.
 * Según el TIPO de la categoría (HU-15 CA-18, CA-26): modelo y garantía a `null` si no es electrodoméstico (el servidor
 * nunca los anula por su cuenta: lo hacemos aquí) y unidad «UNIT» si el tipo la fija.
 * HU-16 (CA-4): con variantes, `sku`/`minStock` a `null` y las filas en `variants`; sin variantes, `variants` no se envía.
 */
export function toRequest(values: ProductFormValues, type: ProductType | null): CreateProductRequest {
  const fields = productFields(values, type)
  return values.hasVariants
    ? { ...fields, hasVariants: true, variants: values.variants.map(draftToRequest) }
    : { ...fields, hasVariants: false }
}

/** Del formulario al cuerpo de la EDICIÓN: sin `hasVariants` ni `variants` (el `PUT` no los admite). */
export function toUpdateRequest(values: ProductFormValues, type: ProductType | null, version: number): UpdateProductRequest {
  return { ...productFields(values, type), version }
}

/** Campos del formulario a los que se pueden asignar los `errors` de un 400 `validation.failed`. */
export const FORM_FIELDS = [
  'name',
  'categoryId',
  'brand',
  'model',
  'warrantyMonths',
  'unit',
  'sku',
  'minStock',
  'salePrice',
  'salePriceCurrency',
] as const
export type ProductFormField = (typeof FORM_FIELDS)[number]
export const isFormField = (f: string): f is ProductFormField => (FORM_FIELDS as readonly string[]).includes(f)

// ===== «Añadir variantes» a un producto que ya tiene (CA-8, CA-22) =====

/** Las filas «por guardar» del panel «Añadir variantes»: un formulario aparte del del producto. */
export function buildAddVariantsSchema(existing: readonly VariantResponse[]) {
  return z.object({ variants: z.array(draftRowSchema) }).superRefine((values, ctx) =>
    checkDraftRows(values.variants, ctx, {
      takenSkus: existing.map((v) => v.sku ?? '').filter(Boolean),
      max: MAX_VARIANTS - existing.length,
    }),
  )
}
export type AddVariantsFormValues = z.input<ReturnType<typeof buildAddVariantsSchema>>

// ===== Editar una variante en su fila (CA-9, CA-22) =====

/**
 * Esquema de la fila en edición. `others` son las DEMÁS variantes del producto: con ellas comprobamos en el navegador
 * el SKU repetido y las opciones repetidas (el 409 del servidor sigue siendo la garantía final y se pinta igual).
 */
export function buildVariantEditSchema(others: readonly VariantResponse[]) {
  return z
    .object({ size: z.string(), color: z.string(), sku: z.string(), minStock: z.string() })
    .superRefine((values, ctx) => {
      const size = normalizeSize(values.size)
      const color = normalizeColor(values.color)
      if ((size ?? '').length > SIZE_MAX) {
        ctx.addIssue({ code: 'custom', path: ['size'], message: msg('validation.max_length', { max: SIZE_MAX }) })
      } else if ((color ?? '').length > COLOR_MAX) {
        ctx.addIssue({ code: 'custom', path: ['color'], message: msg('validation.max_length', { max: COLOR_MAX }) })
      } else if (!size && !color) {
        // Talla y color se validan juntos: el error va en `size` y se pinta bajo la pareja (CA-5).
        ctx.addIssue({ code: 'custom', path: ['size'], message: msg('variant.options_required') })
      } else if (others.some((o) => optionKey(o) === optionKey({ size, color }))) {
        ctx.addIssue({
          code: 'custom',
          path: ['size'],
          message: msg('api.variant.options_conflict', { options: optionsLabel({ size, color }) }),
        })
      }
      const sku = values.sku.trim().toUpperCase()
      const skuMsg = skuError(values.sku) ?? (sku && others.some((o) => o.sku === sku) ? msg('variant.sku_repeated') : null)
      if (skuMsg) ctx.addIssue({ code: 'custom', path: ['sku'], message: skuMsg })
      const minMsg = minStockError(values.minStock)
      if (minMsg) ctx.addIssue({ code: 'custom', path: ['minStock'], message: minMsg })
    })
}
export type VariantEditValues = z.input<ReturnType<typeof buildVariantEditSchema>>

export const variantToEditValues = (v: VariantResponse, lang: string): VariantEditValues => ({
  size: v.size ?? '',
  color: v.color ?? '',
  sku: v.sku ?? '',
  minStock: decimalToInput(v.minStock, lang),
})

/** Campos de la fila que pueden venir en `errors` de un 400 `validation.failed`. */
export const VARIANT_FIELDS = ['size', 'color', 'sku', 'minStock'] as const
export type VariantField = (typeof VARIANT_FIELDS)[number]
export const isVariantField = (f: string): f is VariantField => (VARIANT_FIELDS as readonly string[]).includes(f)
