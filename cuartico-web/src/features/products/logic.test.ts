import { describe, expect, it } from 'vitest'
import { listQueryString } from '../../api/products'
import { decimalToInput, formatMoney, formatQuantity, inputToDecimal } from './format'
import { DEFAULT_LIST_QUERY, hasFilters, parseListQuery, toApiParams, toSearchParams } from './listQuery'
import { listPathFrom } from './navigation'
import { productFormSchema, toFormValues, toRequest, type ProductFormValues } from './productSchema'
import { productBadges, stockBadge } from './stockBadge'

const stock = (available: number) => ({ onHand: available, reserved: 0, available, averageCost: null, costCurrency: null })

describe('Estado del listado en la URL (CA-26)', () => {
  it('por defecto: activos, página 1, por nombre asc; la URL por defecto queda vacía', () => {
    expect(parseListQuery(new URLSearchParams(''))).toEqual(DEFAULT_LIST_QUERY)
    expect(toSearchParams(DEFAULT_LIST_QUERY).toString()).toBe('')
  })

  it('ida y vuelta con todos los valores', () => {
    const q = { q: 'arroz', cat: 'Granos', status: 'all' as const, page: 3, sort: 'name,desc' as const }
    expect(parseListQuery(toSearchParams(q))).toEqual(q)
  })

  it('valores raros en la URL caen en el valor por defecto (nunca llegan a la API)', () => {
    const q = parseListQuery(new URLSearchParams('status=quizas&page=-4&sort=price,asc'))
    expect(q).toMatchObject({ status: 'active', page: 1, sort: 'name,asc' })
    expect(parseListQuery(new URLSearchParams('page=abc')).page).toBe(1)
  })

  it('a la API: página desde 0, tamaño 20 y estado como active=true|false|ausente (CA-19/CA-20)', () => {
    expect(toApiParams({ ...DEFAULT_LIST_QUERY, page: 2 })).toMatchObject({ page: 1, size: 20, active: true })
    expect(toApiParams({ ...DEFAULT_LIST_QUERY, status: 'inactive' }).active).toBe(false)
    expect(toApiParams({ ...DEFAULT_LIST_QUERY, status: 'all' }).active).toBeUndefined()
    expect(listQueryString(toApiParams({ ...DEFAULT_LIST_QUERY, status: 'all' }))).toBe('page=0&size=20&sort=name%2Casc')
  })

  it('hasFilters', () => {
    expect(hasFilters(DEFAULT_LIST_QUERY)).toBe(false)
    expect(hasFilters({ ...DEFAULT_LIST_QUERY, status: 'all' })).toBe(true)
  })

  it('volver al listado solo acepta una query string', () => {
    expect(listPathFrom({ listSearch: '?q=arroz&page=2' })).toBe('/products?q=arroz&page=2')
    expect(listPathFrom({ listSearch: '//evil.com' })).toBe('/products')
    expect(listPathFrom(null)).toBe('/products')
  })
})

describe('Formato (CA-28)', () => {
  it('importes con moneda y separadores del idioma', () => {
    expect(formatMoney(3.5, 'USD', 'es')).toBe('3,50 USD')
    expect(formatMoney(3200, 'CUP', 'es')).toBe('3.200,00 CUP')
    expect(formatMoney(3200, 'CUP', 'en')).toBe('3,200.00 CUP')
  })

  it('cantidades con unidad corta', () => {
    expect(formatQuantity(12.5, 'kg', 'es')).toBe('12,5 kg')
    expect(formatQuantity(36, 'u', 'es')).toBe('36 u')
  })

  it('decimales entre campo y API (coma o punto)', () => {
    expect(decimalToInput(12.5, 'es')).toBe('12,5')
    expect(decimalToInput(12.5, 'en')).toBe('12.5')
    expect(inputToDecimal(' 3,5 ')).toBe(3.5)
    expect(inputToDecimal('')).toBeNull()
  })
})

describe('Formulario de producto (CA-2, CA-5, CA-25)', () => {
  const valid: ProductFormValues = {
    name: 'Arroz',
    sku: '',
    category: '',
    unit: 'KG',
    minStock: '0',
    salePrice: '',
    salePriceCurrency: 'USD',
  }
  const errorsOf = (v: Partial<ProductFormValues>) => {
    const r = productFormSchema.safeParse({ ...valid, ...v })
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]))
  }

  it('alta: vacío, mínimo 0 y USD preseleccionado', () => {
    expect(toFormValues(null, 'es')).toMatchObject({ minStock: '0', salePriceCurrency: 'USD', unit: '' })
  })

  it('reglas iguales a la API', () => {
    expect(errorsOf({})).toEqual({})
    expect(errorsOf({ name: '   ' }).name).toBe('validation.required')
    expect(errorsOf({ name: 'x'.repeat(121) }).name).toBe('validation.max_length|{"max":120}')
    expect(errorsOf({ name: `  ${'x'.repeat(120)}  ` })).toEqual({}) // se recorta antes de validar
    expect(errorsOf({ sku: 'ARR 001' }).sku).toBe('product.sku_pattern')
    expect(errorsOf({ sku: ' arr-001 ' })).toEqual({})
    expect(errorsOf({ unit: '' }).unit).toBe('validation.required')
    expect(errorsOf({ minStock: '-1' }).minStock).toBe('product.min_stock_format')
    expect(errorsOf({ minStock: '1,2345' }).minStock).toBe('product.min_stock_format')
    expect(errorsOf({ salePrice: '3,555' }).salePrice).toBe('product.price_format')
    expect(errorsOf({ salePrice: '3,55' })).toEqual({})
  })

  it('normaliza al enviar; sin importe, precio y moneda a null', () => {
    expect(toRequest({ ...valid, name: '  Arroz 1 kg ', sku: ' arr-001 ', category: '  ', minStock: '2,5' })).toEqual({
      name: 'Arroz 1 kg',
      sku: 'ARR-001',
      unit: 'KG',
      category: null,
      minStock: 2.5,
      salePrice: null,
      salePriceCurrency: null,
    })
    expect(toRequest({ ...valid, salePrice: '3,50', salePriceCurrency: 'CUP' })).toMatchObject({
      salePrice: 3.5,
      salePriceCurrency: 'CUP',
    })
  })
})

describe('Etiquetas de stock (ux-notes §5)', () => {
  it('stockBadge completa: inactivo nada, sin stock, stock bajo', () => {
    expect(stockBadge({ active: false, stock: stock(0), lowStock: false })).toBeNull()
    expect(stockBadge({ active: true, stock: stock(0), lowStock: true })?.labelKey).toBe('products.badge_out_of_stock')
    expect(stockBadge({ active: true, stock: stock(3), lowStock: true })?.labelKey).toBe('products.badge_low_stock')
    expect(stockBadge({ active: true, stock: stock(30), lowStock: false })).toBeNull()
  })

  it('con el interruptor apagado solo se ve «Inactivo»', () => {
    expect(productBadges({ active: true, stock: stock(0), lowStock: true }, false)).toEqual([])
    expect(productBadges({ active: false, stock: stock(0), lowStock: false }, false)[0].labelKey).toBe('products.badge_inactive')
    expect(productBadges({ active: true, stock: stock(0), lowStock: true }, true)[0].variant).toBe('danger')
  })
})
