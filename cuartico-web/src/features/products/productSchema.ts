import { z } from 'zod'
import { UNITS, type CreateProductRequest, type ProductResponse, type ProductType, type UnitOfMeasure } from '../../api/types'
import { msg } from '../../components/fieldMessage'
import { DEFAULT_CURRENCY } from '../../config/currencies'
import { decimalToInput, inputToDecimal } from './format'
import { isUnitLocked, LOCKED_UNIT, usesApplianceFields } from './typeRules'

/** Mismas reglas que la API (HU-02 y HU-15, campos del producto). Sin `trim` previo en los números: lo hace la regex. */
const PRICE_RE = /^\d{1,10}([.,]\d{1,2})?$/
const MIN_STOCK_RE = /^\d{1,9}([.,]\d{1,3})?$/
const SKU_RE = /^[A-Za-z0-9._-]*$/
const WARRANTY_RE = /^\d{1,3}$/
export const MAX_WARRANTY_MONTHS = 120

/** Cómo sabe el formulario el tipo de la categoría elegida (lo resuelve quien tiene la lista de categorías). */
export type TypeOfCategory = (categoryId: string) => ProductType | null

/**
 * Esquema del formulario: el equivalente al `CreateProductRequest` con Bean Validation. Todos los valores son TEXTO
 * (lo que hay en los `<input>`); `toRequest` los convierte a lo que espera la API.
 *
 * Es una FÁBRICA (`buildProductFormSchema(typeOf)`) porque algunas reglas dependen de otro campo: modelo y garantía
 * solo se validan si la categoría elegida es de electrodomésticos, y la unidad no se pide si el tipo la fija.
 * Como un validador de clase (`@ScriptAssert`/`ConstraintValidator` a nivel de clase) en Bean Validation.
 */
export function buildProductFormSchema(typeOf: TypeOfCategory) {
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
      sku: z
        .string()
        .trim()
        .max(50, msg('validation.max_length', { max: 50 }))
        .regex(SKU_RE, msg('product.sku_pattern')),
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
    .superRefine((values, ctx) => {
      const type = typeOf(values.categoryId)
      if (values.unit === '' && !isUnitLocked(type)) {
        ctx.addIssue({ code: 'custom', path: ['unit'], message: msg('validation.required') })
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
    minStock: decimalToInput(product.minStock, lang),
    salePrice: decimalToInput(product.salePrice, lang),
    salePriceCurrency: product.salePriceCurrency ?? DEFAULT_CURRENCY,
  }
}

const textOrNull = (s: string) => s.trim() || null

/**
 * Del formulario al cuerpo de la API. Normaliza igual que el backend (CA-2): recorta, SKU en mayúsculas, vacío → `null`.
 * Si el importe está vacío, precio y moneda van a `null` (CA-25): así nunca se produce `product.price_currency_mismatch`.
 * Según el TIPO de la categoría (HU-15 CA-18, CA-26): modelo y garantía a `null` si no es electrodoméstico (el servidor
 * nunca los anula por su cuenta: lo hacemos aquí) y unidad «UNIT» si el tipo la fija.
 */
export function toRequest(values: ProductFormValues, type: ProductType | null): CreateProductRequest {
  const sku = values.sku.trim().toUpperCase()
  const salePrice = inputToDecimal(values.salePrice)
  const appliance = usesApplianceFields(type)
  const warranty = values.warrantyMonths.trim()
  return {
    name: values.name.trim(),
    sku: sku || null,
    unit: isUnitLocked(type) ? LOCKED_UNIT : (values.unit as UnitOfMeasure),
    categoryId: Number(values.categoryId),
    brand: textOrNull(values.brand),
    model: appliance ? textOrNull(values.model) : null,
    warrantyMonths: appliance && warranty ? Number(warranty) : null,
    minStock: inputToDecimal(values.minStock) ?? 0,
    salePrice,
    salePriceCurrency: salePrice === null ? null : values.salePriceCurrency,
  }
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
