import type { CategoryRef, CategoryResponse, PageResponse, ProductResponse } from '../api/types'
import { installFakeApi, json, tokenPair } from './fakeApi'

/** Una categoría como la devuelve `GET /api/v1/categories` (contrato de HU-15). */
export function category(overrides: Partial<CategoryResponse> = {}): CategoryResponse {
  return {
    id: 1,
    parentId: null,
    name: 'Alimentos',
    nameEn: 'Food',
    productType: 'FOOD',
    depth: 1,
    active: true,
    path: 'Alimentos',
    pathEn: 'Food',
    productCount: 0,
    version: 0,
    createdAt: '2026-11-01T10:00:00Z',
    createdBy: 'system',
    updatedAt: '2026-11-01T10:00:00Z',
    updatedBy: 'system',
    ...overrides,
  }
}

/**
 * Árbol de ejemplo: las 4 raíces de la migración V4 (CA-1) y algunas subcategorías, con una inactiva de nivel 3.
 * Alimentos(1) › Granos(5) › Arroz(8); Alimentos › Lácteos(6); Alimentos › Confituras(7, inactiva) › Mermeladas(9, inactiva);
 * Ropa(2); Electrodomésticos(3) › Cocina(10); Aseo y hogar(4).
 */
export const CATEGORIES: CategoryResponse[] = [
  category(),
  category({ id: 2, name: 'Ropa', nameEn: 'Clothing', productType: 'CLOTHING', path: 'Ropa', pathEn: 'Clothing' }),
  category({ id: 3, name: 'Electrodomésticos', nameEn: 'Appliances', productType: 'APPLIANCE', path: 'Electrodomésticos', pathEn: 'Appliances' }),
  category({ id: 4, name: 'Aseo y hogar', nameEn: 'Personal care & home', productType: 'OTHER', path: 'Aseo y hogar', pathEn: 'Personal care & home' }),
  category({ id: 5, parentId: 1, depth: 2, name: 'Granos', nameEn: 'Grains', path: 'Alimentos › Granos', pathEn: 'Food › Grains', productCount: 3 }),
  category({ id: 6, parentId: 1, depth: 2, name: 'Lácteos', nameEn: null, path: 'Alimentos › Lácteos', pathEn: 'Food › Lácteos' }),
  category({ id: 7, parentId: 1, depth: 2, name: 'Confituras', nameEn: 'Preserves', active: false, path: 'Alimentos › Confituras', pathEn: 'Food › Preserves' }),
  category({ id: 8, parentId: 5, depth: 3, name: 'Arroz', nameEn: 'Rice', path: 'Alimentos › Granos › Arroz', pathEn: 'Food › Grains › Rice' }),
  category({ id: 9, parentId: 7, depth: 3, name: 'Mermeladas', nameEn: 'Jams', active: false, path: 'Alimentos › Confituras › Mermeladas', pathEn: 'Food › Preserves › Jams' }),
  category({ id: 10, parentId: 3, depth: 2, name: 'Cocina', nameEn: 'Kitchen', productType: 'APPLIANCE', path: 'Electrodomésticos › Cocina', pathEn: 'Appliances › Kitchen' }),
]

/** `CategoryRef` de una categoría del árbol de ejemplo. */
export function ref(id: number): CategoryRef {
  const c = CATEGORIES.find((x) => x.id === id)!
  return { id: c.id, name: c.name, nameEn: c.nameEn, path: c.path, pathEn: c.pathEn, active: c.active }
}

/** Un producto como lo devuelve la API (contrato de HU-02 + HU-15). Por defecto en «Alimentos › Granos». */
export function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 1,
    name: 'Arroz blanco',
    sku: 'ARR-001',
    unit: 'KG',
    category: ref(5),
    type: 'FOOD',
    brand: null,
    model: null,
    warrantyMonths: null,
    salePrice: 2.5,
    salePriceCurrency: 'USD',
    minStock: 5,
    active: true,
    stock: { onHand: 0, reserved: 0, available: 0, averageCost: null, costCurrency: null },
    lowStock: true,
    version: 0,
    createdAt: '2026-11-01T10:00:00Z',
    createdBy: 'admin',
    updatedAt: '2026-11-02T10:00:00Z',
    updatedBy: 'admin',
    ...overrides,
  }
}

export function page(content: ProductResponse[], init: Partial<PageResponse<ProductResponse>> = {}): PageResponse<ProductResponse> {
  const totalElements = init.totalElements ?? content.length
  return { content, page: 0, size: 20, totalElements, totalPages: Math.ceil(totalElements / 20), ...init }
}

/** Sesión iniciada (refresh guardado) + categorías. Devuelve la API falsa para añadir más rutas. */
export function loggedInWithProducts(role: 'ADMIN' | 'OPERATOR' = 'ADMIN', categories: CategoryResponse[] = CATEGORIES) {
  localStorage.setItem('cuartico.refreshToken', 'refresh-1')
  return installFakeApi()
    .on('POST /api/v1/auth/refresh', () => json(200, tokenPair(2, role)))
    .on('GET /api/v1/categories', () => json(200, categories))
}
