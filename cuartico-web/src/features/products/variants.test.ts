import { describe, expect, it } from 'vitest'
import type { ProductType } from '../../api/types'
import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'
import { product, shirt, variant } from '../../test/productFixtures'
import { buildAddVariantsSchema, buildProductFormSchema, buildVariantEditSchema, toFormValues, toRequest, toUpdateRequest } from './productSchema'
import {
  addColors,
  addSizes,
  colorCode,
  combinations,
  compareVariants,
  draftsFor,
  findSimilarColor,
  mergeDrafts,
  mergeVariantData,
  optionKey,
  rowErrorsFrom,
  rowForSkuConflict,
  splitNew,
  suggestSku,
  variantName,
  type DraftVariant,
} from './variants'

const draft = (size: string | null, color: string | null, sku = '', minStock = '0'): DraftVariant => ({
  key: `${size}-${color}`,
  size,
  color,
  sku,
  minStock,
})

describe('Orden de variantes (HU-16 CA-14)', () => {
  it('canónicas, numéricas, resto alfabético y sin talla al final', () => {
    const sizes = ['L', '38', 'M', 'XL', 'ÚNICA', 'S', '36', '10.5', '2XL']
    const sorted = sizes.map((size) => ({ size, color: null })).sort(compareVariants)
    expect(sorted.map((v) => v.size)).toEqual(['S', 'M', 'L', 'XL', '2XL', '10.5', '36', '38', 'ÚNICA'])
  })

  it('a igual talla, por color (sin distinguir mayúsculas), sin color al final y por id', () => {
    const list = [
      { id: 3, size: 'M', color: null },
      { id: 2, size: 'M', color: 'rojo' },
      { id: 1, size: 'M', color: 'Azul' },
      { id: 4, size: null, color: 'Azul' },
    ].sort(compareVariants)
    expect(list.map((v) => v.id)).toEqual([1, 2, 3, 4])
  })
})

describe('Generador talla × color (CA-21)', () => {
  it('tallas: en mayúsculas, sin repetir y ordenadas; colores: como se escriben, «Rojo» = «rojo»', () => {
    expect(addSizes(['M'], ' l, s ,m,, xl')).toEqual(['S', 'M', 'L', 'XL'])
    expect(addColors(['Rojo'], 'rojo, Azul marino ,')).toEqual(['Rojo', 'Azul marino'])
  })

  it('combinaciones: talla × color; con un solo eje, solo ese; sin nada, ninguna', () => {
    expect(combinations(['S', 'M'], ['Rojo'])).toEqual([
      { size: 'S', color: 'Rojo' },
      { size: 'M', color: 'Rojo' },
    ])
    expect(combinations([], ['Rojo'])).toEqual([{ size: null, color: 'Rojo' }])
    expect(combinations([], [])).toEqual([])
  })

  it('omite las que ya existen (sin distinguir mayúsculas del color)', () => {
    const { fresh, skipped } = splitNew(combinations(['S', 'M'], ['Rojo']), [{ size: 'M', color: 'rojo' }])
    expect(fresh).toEqual([{ size: 'S', color: 'Rojo' }])
    expect(skipped).toBe(1)
    expect(optionKey({ size: ' m ', color: ' ROJO ' })).toBe(optionKey({ size: 'M', color: 'rojo' }))
  })

  it('aviso de tildes: «Marron» se parece a «Marrón»; «rojo» y «Rojo» no (son el mismo)', () => {
    expect(findSimilarColor('Marron', ['Marrón', 'Azul'])).toBe('Marrón')
    expect(findSimilarColor('rojo', ['Rojo'])).toBeNull()
    expect(findSimilarColor('Verde', ['Marrón'])).toBeNull()
  })

  it('mergeDrafts no duplica y deja las filas en el orden de la API', () => {
    const merged = mergeDrafts([draft('M', 'Rojo')], [draft('S', 'Rojo'), draft('M', 'rojo')])
    expect(merged.map(variantName)).toEqual(['S · Rojo', 'M · Rojo'])
  })
})

describe('SKU sugerido con prefijo (D-2)', () => {
  it('PREFIJO-TALLA-COLOR, sin tildes, con código corto del color', () => {
    expect(colorCode('Blanco')).toBe('BLA')
    expect(colorCode('Azul marino')).toBe('AZM')
    expect(colorCode('Marrón')).toBe('MAR')
    const taken = new Set<string>()
    expect(suggestSku('cam', { size: 'M', color: 'Blanco' }, taken)).toBe('CAM-M-BLA')
    expect(suggestSku('CAM', { size: 'XL', color: 'Azul marino' }, taken)).toBe('CAM-XL-AZM')
    expect(suggestSku('CAM', { size: null, color: 'Rojo' }, taken)).toBe('CAM-ROJ')
  })

  it('si choca añade -2, -3…; sin prefijo no sugiere nada', () => {
    const taken = new Set(['CAM-M-BLA'])
    expect(suggestSku('CAM', { size: 'M', color: 'Blanco' }, taken)).toBe('CAM-M-BLA-2')
    expect(suggestSku('CAM', { size: 'M', color: 'Blanca' }, taken)).toBe('CAM-M-BLA-3')
    expect(suggestSku('', { size: 'M', color: 'Blanco' }, taken)).toBe('')
  })

  it('draftsFor: SKU sugerido, mínimo común y SKUs ya usados respetados', () => {
    const rows = draftsFor(combinations(['S', 'M'], ['Blanco']), { prefix: 'CAM', minStock: '2', takenSkus: ['CAM-S-BLA'] })
    expect(rows.map((r) => [r.sku, r.minStock])).toEqual([
      ['CAM-S-BLA-2', '2'],
      ['CAM-M-BLA', '2'],
    ])
  })
})

describe('Errores del servidor en las filas (CA-21)', () => {
  const rows = [draft('S', 'Blanco', 'CAM-S'), draft('M', 'Blanco', 'CAM-S-BLA')]

  it('product.sku_conflict: la fila cuyo SKU aparece entero en el detail', () => {
    expect(rowForSkuConflict(['CAM-S', 'CAM-S-BLA'], 'El SKU CAM-S-BLA ya lo usa otro producto o variante.')).toBe(1)
    expect(rowForSkuConflict(['CAM-S', 'CAM-S-BLA'], 'El SKU CAM-S ya lo usa otro producto.')).toBe(0)
    expect(rowForSkuConflict(['X'], 'Sin SKU')).toBe(-1)
  })

  it('validation.failed con errors["variants[1].sku"] y variant.options_conflict', () => {
    expect(rowErrorsFrom({ code: 'validation.failed', errors: { 'variants[1].sku': 'mal', name: 'x' } }, rows)).toEqual([
      { index: 1, field: 'sku', message: 'mal' },
    ])
    expect(rowErrorsFrom({ code: 'variant.options_conflict', detail: 'Ya existe la variante M / Blanco en este producto.' }, rows)).toEqual([
      { index: 1, field: 'options', message: 'Ya existe la variante M / Blanco en este producto.' },
    ])
    expect(rowErrorsFrom({ code: 'resource.version_conflict' }, rows)).toEqual([])
  })
})

describe('Esquemas y cuerpos (CA-4, CA-13b)', () => {
  const typeOf = (id: string): ProductType => (id === '2' ? 'CLOTHING' : 'FOOD')
  const base = { ...toFormValues(null, 'es'), name: 'Camiseta', categoryId: '2' }

  it('alta con variantes: sin filas → «Añade al menos una variante»; SKU repetido entre filas', () => {
    const schema = buildProductFormSchema(typeOf)
    const empty = schema.safeParse({ ...base, hasVariants: true, sku: 'mal sku' })
    expect(empty.success ? [] : empty.error.issues.map((i) => i.message)).toEqual(['variants.required']) // el SKU del producto no cuenta
    const repeated = schema.safeParse({ ...base, hasVariants: true, variants: [draft('S', null, 'a'), draft('M', null, 'A')] })
    expect(repeated.success ? [] : repeated.error.issues.map((i) => i.path.join('.'))).toEqual(['variants.0.sku', 'variants.1.sku'])
  })

  it('edición de un producto con variantes: no valida SKU/mínimo ni filas', () => {
    const values = toFormValues(shirt(), 'es')
    expect(buildProductFormSchema(typeOf, 'edit').safeParse(values).success).toBe(true)
  })

  it('cuerpos: alta con variantes (sku/minStock null) y PUT sin hasVariants', () => {
    const body = toRequest({ ...base, hasVariants: true, variants: [draft(' m ', ' Rojo ', ' cam-m ', '1,5')] }, 'CLOTHING')
    expect(body).toMatchObject({ sku: null, minStock: null, hasVariants: true })
    expect(body.variants).toEqual([{ sku: 'CAM-M', size: 'M', color: 'Rojo', minStock: 1.5 }])
    const put = toUpdateRequest(toFormValues(shirt(), 'es'), 'CLOTHING', 5)
    expect(put).toMatchObject({ sku: null, minStock: null, version: 5 })
    expect(put).not.toHaveProperty('hasVariants')
    expect(put).not.toHaveProperty('variants')
  })

  it('«Añadir variantes»: el SKU no puede repetir el de una variante existente', () => {
    const schema = buildAddVariantsSchema(shirt().variants ?? [])
    const r = schema.safeParse({ variants: [draft('L', 'Blanco', 'cam-m-bla')] })
    expect(r.success ? [] : r.error.issues.map((i) => i.message)).toEqual(['variant.sku_repeated'])
  })

  it('editar una variante: opciones obligatorias y repetidas (sin distinguir mayúsculas)', () => {
    const others = [variant({ id: 102, size: 'M', color: 'Blanco', sku: 'CAM-M-BLA' })]
    const schema = buildVariantEditSchema(others)
    const msgs = (v: object) => {
      const r = schema.safeParse({ size: 'S', color: 'Blanco', sku: '', minStock: '0', ...v })
      return r.success ? [] : r.error.issues.map((i) => i.message)
    }
    expect(msgs({})).toEqual([])
    expect(msgs({ size: ' ', color: '' })).toEqual(['variant.options_required'])
    expect(msgs({ size: 'm', color: 'BLANCO' })).toEqual(['api.variant.options_conflict|{"options":"M / BLANCO"}'])
    expect(msgs({ sku: 'cam-m-bla' })).toEqual(['variant.sku_repeated'])
  })

  it('mergeVariantData: toma variantes y stock de la API pero conserva la versión del formulario', () => {
    const current = shirt({ version: 5, name: 'Camiseta' })
    const fromApi = shirt({ version: 9, name: 'Otro nombre', variantCount: 2, variants: [variant(), variant({ id: 104, size: 'L' })] })
    const merged = mergeVariantData(current, fromApi)
    expect(merged.version).toBe(5)
    expect(merged.name).toBe('Camiseta')
    expect(merged.variantCount).toBe(2)
    expect(product().hasVariants).toBe(false)
  })
})

describe('Traducciones (CA-24)', () => {
  /** Todas las claves «a.b.c» de un JSON. */
  const keys = (o: object, prefix = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]))

  it('es.json y en.json tienen exactamente las mismas claves', () => {
    expect(keys(en).sort()).toEqual(keys(es).sort())
  })
})
