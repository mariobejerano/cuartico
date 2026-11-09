import { request } from './client'
import type {
  CreateProductRequest,
  PageResponse,
  ProductListParams,
  ProductResponse,
  UpdateProductRequest,
} from './types'

const BASE = '/api/v1/products'

/** Convierte los parámetros del listado en query string, omitiendo los vacíos (`q` vacío = sin filtro, CA-18). */
export function listQueryString(params: ProductListParams): string {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.active !== undefined) qs.set('active', String(params.active))
  if (params.category) qs.set('category', params.category)
  qs.set('page', String(params.page))
  qs.set('size', String(params.size))
  qs.set('sort', params.sort)
  return qs.toString()
}

/**
 * Endpoints de productos (HU-02). Como un cliente Feign: solo sabe hablar con la API, nada de React.
 * `signal` permite cancelar la petición (TanStack Query lo usa cuando la respuesta ya no interesa).
 */
export const productsApi = {
  list: (params: ProductListParams, signal?: AbortSignal) =>
    request<PageResponse<ProductResponse>>(`${BASE}?${listQueryString(params)}`, { signal }),
  get: (id: number, signal?: AbortSignal) => request<ProductResponse>(`${BASE}/${id}`, { signal }),
  categories: (signal?: AbortSignal) => request<string[]>(`${BASE}/categories`, { signal }),
  create: (body: CreateProductRequest) => request<ProductResponse>(BASE, { method: 'POST', body }),
  update: (id: number, body: UpdateProductRequest) =>
    request<ProductResponse>(`${BASE}/${id}`, { method: 'PUT', body }),
  activate: (id: number) => request<ProductResponse>(`${BASE}/${id}/activate`, { method: 'POST' }),
  deactivate: (id: number) => request<ProductResponse>(`${BASE}/${id}/deactivate`, { method: 'POST' }),
}
