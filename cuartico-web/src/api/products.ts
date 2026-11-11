import { request } from './client'
import type {
  AddVariantsRequest,
  CreateProductRequest,
  EnableVariantsRequest,
  PageResponse,
  ProductListParams,
  ProductResponse,
  UpdateProductRequest,
  UpdateVariantRequest,
} from './types'

const BASE = '/api/v1/products'

/** Convierte los parámetros del listado en query string, omitiendo los vacíos (`q` vacío = sin filtro, CA-18). */
export function listQueryString(params: ProductListParams): string {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.active !== undefined) qs.set('active', String(params.active))
  if (params.type) qs.set('type', params.type)
  if (params.categoryId !== undefined) qs.set('categoryId', String(params.categoryId))
  qs.set('page', String(params.page))
  qs.set('size', String(params.size))
  qs.set('sort', params.sort)
  return qs.toString()
}

/**
 * Endpoints de productos (HU-02, HU-15, HU-16). Como un cliente Feign: solo sabe hablar con la API, nada de React.
 * `signal` permite cancelar la petición (TanStack Query lo usa cuando la respuesta ya no interesa).
 * Las categorías tienen su propio cliente (`categories.ts`): `GET /products/categories` ya no existe (HU-15 CA-21).
 *
 * Variantes (HU-16): TODOS sus endpoints devuelven el producto completo (`ProductResponse` con `variants[]`), así la
 * pantalla se pone al día con una sola respuesta. No hay `GET` de una variante: se relee el producto.
 */
export const productsApi = {
  list: (params: ProductListParams, signal?: AbortSignal) =>
    request<PageResponse<ProductResponse>>(`${BASE}?${listQueryString(params)}`, { signal }),
  get: (id: number, signal?: AbortSignal) => request<ProductResponse>(`${BASE}/${id}`, { signal }),
  create: (body: CreateProductRequest) => request<ProductResponse>(BASE, { method: 'POST', body }),
  update: (id: number, body: UpdateProductRequest) =>
    request<ProductResponse>(`${BASE}/${id}`, { method: 'PUT', body }),
  activate: (id: number) => request<ProductResponse>(`${BASE}/${id}/activate`, { method: 'POST' }),
  deactivate: (id: number) => request<ProductResponse>(`${BASE}/${id}/deactivate`, { method: 'POST' }),

  // ----- Variantes (HU-16) -----
  /** CA-8: añade 1–100 variantes (todo o nada). */
  addVariants: (id: number, body: AddVariantsRequest) =>
    request<ProductResponse>(`${BASE}/${id}/variants`, { method: 'POST', body }),
  /** CA-9: edita una variante con su propia `version`. */
  updateVariant: (id: number, variantId: number, body: UpdateVariantRequest) =>
    request<ProductResponse>(`${BASE}/${id}/variants/${variantId}`, { method: 'PUT', body }),
  /** CA-10 (solo ADMIN). */
  activateVariant: (id: number, variantId: number) =>
    request<ProductResponse>(`${BASE}/${id}/variants/${variantId}/activate`, { method: 'POST' }),
  deactivateVariant: (id: number, variantId: number) =>
    request<ProductResponse>(`${BASE}/${id}/variants/${variantId}/deactivate`, { method: 'POST' }),
  /** CA-12: simple → con variantes (la variante existente recibe talla y/o color). Sube la versión del producto. */
  enableVariants: (id: number, body: EnableVariantsRequest) =>
    request<ProductResponse>(`${BASE}/${id}/variants/enable`, { method: 'POST', body }),
  /** CA-13: con una sola variante → simple. Sube la versión del producto. */
  disableVariants: (id: number) => request<ProductResponse>(`${BASE}/${id}/variants/disable`, { method: 'POST' }),
}
