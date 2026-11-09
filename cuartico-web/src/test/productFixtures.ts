import type { PageResponse, ProductResponse } from '../api/types'
import { installFakeApi, json, tokenPair } from './fakeApi'

/** Un producto como lo devuelve la API (contrato real de Forja-Back, HU-02). */
export function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 1,
    name: 'Arroz blanco',
    sku: 'ARR-001',
    unit: 'KG',
    category: 'Granos',
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
export function loggedInWithProducts(role: 'ADMIN' | 'OPERATOR' = 'ADMIN') {
  localStorage.setItem('cuartico.refreshToken', 'refresh-1')
  return installFakeApi()
    .on('POST /api/v1/auth/refresh', () => json(200, tokenPair(2, role)))
    .on('GET /api/v1/products/categories', () => json(200, ['Granos', 'Lácteos']))
}
