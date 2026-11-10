import { describe, expect, it } from 'vitest'
import { CATEGORIES, category } from '../../test/productFixtures'
import { buildCategorySchema, toCreateRequest, toUpdateRequest } from './categorySchema'
import {
  categoryName,
  categoryPath,
  filterOptions,
  findNameConflict,
  findSimilar,
  indexCategories,
  looseKey,
  nameKey,
  nodeActions,
  parentOptions,
  productFormOptions,
  rootOf,
  shortList,
  siblingsOf,
  upsertCategory,
} from './tree'

const index = indexCategories(CATEGORIES)
const byId = (id: number) => index.byId.get(id)!

describe('Árbol de categorías (HU-15)', () => {
  it('nombre y ruta según el idioma, con nameEn ?? name (CA-28)', () => {
    expect(categoryName(byId(5), 'en')).toBe('Grains')
    expect(categoryName(byId(6), 'en')).toBe('Lácteos') // sin nombre en inglés
    expect(categoryName(byId(5), 'es')).toBe('Granos')
    expect(categoryPath(byId(8), 'en')).toBe('Food › Grains › Rice')
  })

  it('normalización igual que la BD (LOWER(TRIM)) y clave sin tildes solo para el aviso (CA-6)', () => {
    expect(nameKey('  LÁCTEOS ')).toBe('lácteos')
    expect(looseKey('Lácteos')).toBe('lacteos')
    const siblings = siblingsOf(index, 1)
    expect(findNameConflict(siblings, '  granos ')?.id).toBe(5)
    expect(findNameConflict(siblings, 'CONFITURAS')?.id).toBe(7) // las inactivas también cuentan
    expect(findNameConflict(siblingsOf(index, 2), 'Granos')).toBeUndefined() // bajo Ropa sí se permite
    expect(findNameConflict(siblingsOf(index, null), 'ropa')?.id).toBe(2) // entre raíces
    expect(findSimilar(siblings, 'Lacteos')?.id).toBe(6)
    expect(findSimilar(siblings, 'lácteos')).toBeUndefined() // eso es conflicto, no parecido
    expect(findNameConflict(siblingsOf(index, 1, 5), 'Granos')).toBeUndefined() // renombrar a su propio nombre
  })

  it('raíz y acciones por fila (CA-4, CA-25)', () => {
    expect(rootOf(index, byId(8)).id).toBe(1)
    expect(nodeActions(byId(1))).toEqual(['add', 'rename', 'deactivate'])
    expect(nodeActions(byId(8))).toEqual(['rename', 'deactivate']) // nivel 3
    expect(nodeActions(byId(7))).toEqual(['rename', 'activate']) // inactiva
  })

  it('opciones: padres válidos, filtro del listado y selector del producto', () => {
    expect(parentOptions(CATEGORIES, 'es').map((c) => c.id)).toEqual([1, 5, 6, 4, 3, 10, 2]) // por ruta, activas, nivel < 3
    expect(filterOptions(CATEGORIES, 'APPLIANCE', 'es').map((c) => c.id)).toEqual([3, 10])
    expect(filterOptions(CATEGORIES, '', 'es')).toHaveLength(CATEGORIES.length) // también inactivas
    expect(productFormOptions(CATEGORIES, null, 'es').some((c) => !c.active)).toBe(false)
    expect(productFormOptions(CATEGORIES, 7, 'es').filter((c) => !c.active).map((c) => c.id)).toEqual([7])
  })

  it('upsert y lista corta', () => {
    expect(upsertCategory(CATEGORIES, { ...byId(5), name: 'Cereales' }).find((c) => c.id === 5)?.name).toBe('Cereales')
    expect(upsertCategory(CATEGORIES, category({ id: 99 }))).toHaveLength(CATEGORIES.length + 1)
    const more = (list: string, n: number) => `${list} y ${n} más`
    expect(shortList(['a', 'b'], 4, more)).toBe('a, b')
    expect(shortList(['a', 'b', 'c', 'd', 'e', 'f'], 4, more)).toBe('a, b, c, d y 2 más')
  })
})

describe('Diálogo de categoría (CA-2, CA-3, CA-6, CA-7)', () => {
  const issues = (values: object, editing = null as ReturnType<typeof byId> | null) => {
    const r = buildCategorySchema({ index, lang: 'es', editing }).safeParse({
      parentId: '',
      productType: '',
      name: '',
      nameEn: '',
      ...values,
    })
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]))
  }

  it('raíz: tipo obligatorio; hija: no se pide', () => {
    expect(issues({ name: 'Juguetes' }).productType).toBe('validation.required')
    expect(issues({ name: 'Juguetes', productType: 'OTHER' })).toEqual({})
    expect(issues({ name: 'Pastas', parentId: '1' })).toEqual({})
  })

  it('nombre obligatorio, máx. 60, y duplicado con el texto que se mostrará', () => {
    expect(issues({ parentId: '1', name: '  ' }).name).toBe('validation.required')
    expect(issues({ parentId: '1', name: 'x'.repeat(61) }).name).toBe('validation.max_length|{"max":60}')
    expect(issues({ parentId: '1', nameEn: 'x'.repeat(61), name: 'A' }).nameEn).toBe('validation.max_length|{"max":60}')
    expect(issues({ parentId: '1', name: 'granos' }).name).toBe(
      'api.category.name_conflict|{"name":"granos","parent":"Alimentos"}',
    )
    expect(issues({ name: 'ROPA', productType: 'CLOTHING' }).name).toBe('api.category.name_conflict_root|{"name":"ROPA"}')
  })

  it('renombrar: se compara con las hermanas de SU padre, sin contarse a sí misma', () => {
    expect(issues({ name: 'Granos' }, byId(5))).toEqual({})
    expect(issues({ name: 'lácteos' }, byId(5)).name).toMatch(/^api\.category\.name_conflict\|/)
  })

  it('cuerpos: recorta, nameEn vacío → null, productType solo en raíz (CA-3)', () => {
    expect(toCreateRequest({ parentId: '', productType: 'OTHER', name: ' Juguetes ', nameEn: ' ' })).toEqual({
      name: 'Juguetes',
      nameEn: null,
      parentId: null,
      productType: 'OTHER',
    })
    expect(toCreateRequest({ parentId: '1', productType: 'FOOD', name: 'Pastas', nameEn: 'Pasta' })).toEqual({
      name: 'Pastas',
      nameEn: 'Pasta',
      parentId: 1,
    })
    expect(toUpdateRequest({ parentId: '', productType: '', name: ' Cereales', nameEn: '' }, 4)).toEqual({
      name: 'Cereales',
      nameEn: null,
      version: 4,
    })
  })
})
