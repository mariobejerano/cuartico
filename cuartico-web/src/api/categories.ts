import { request } from './client'
import type { CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from './types'

const BASE = '/api/v1/categories'

/**
 * Endpoints de categorías (HU-15). Sin React, como `products.ts`.
 * El listado no se pagina (son decenas) y llega como lista PLANA: el árbol lo montamos en el navegador.
 */
export const categoriesApi = {
  /** `active` ausente = todas (activas e inactivas), que es lo que necesitan el árbol y los filtros. */
  list: (signal?: AbortSignal) => request<CategoryResponse[]>(BASE, { signal }),
  get: (id: number, signal?: AbortSignal) => request<CategoryResponse>(`${BASE}/${id}`, { signal }),
  create: (body: CreateCategoryRequest) => request<CategoryResponse>(BASE, { method: 'POST', body }),
  update: (id: number, body: UpdateCategoryRequest) =>
    request<CategoryResponse>(`${BASE}/${id}`, { method: 'PUT', body }),
  activate: (id: number) => request<CategoryResponse>(`${BASE}/${id}/activate`, { method: 'POST' }),
  deactivate: (id: number) => request<CategoryResponse>(`${BASE}/${id}/deactivate`, { method: 'POST' }),
}
