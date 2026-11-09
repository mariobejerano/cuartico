import type { ProductListParams } from '../../api/types'

/**
 * Estado del listado tal como vive en la URL (CA-26): `?q=&cat=&status=&page=&sort=`.
 * `page` empieza en 1 (para personas); la API empieza en 0 (ver `toApiParams`).
 */
export type StatusFilter = 'active' | 'inactive' | 'all'
export type SortOrder = 'name,asc' | 'name,desc'

export interface ListQuery {
  q: string
  cat: string
  status: StatusFilter
  page: number
  sort: SortOrder
}

export const PAGE_SIZE = 20
export const DEFAULT_LIST_QUERY: ListQuery = { q: '', cat: '', status: 'active', page: 1, sort: 'name,asc' }

/**
 * Lee la URL de forma tolerante: un valor raro (enlace manipulado o viejo) cae en el valor por defecto,
 * nunca rompe la pantalla ni llega a la API (que respondería 400).
 */
export function parseListQuery(params: URLSearchParams): ListQuery {
  const status = params.get('status')
  const page = Number.parseInt(params.get('page') ?? '', 10)
  return {
    q: (params.get('q') ?? '').trim().slice(0, 100),
    cat: (params.get('cat') ?? '').trim().slice(0, 50),
    status: status === 'inactive' || status === 'all' ? status : 'active',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    sort: params.get('sort') === 'name,desc' ? 'name,desc' : 'name,asc',
  }
}

/** Escribe en la URL solo lo que no es por defecto: enlaces cortos y limpios (`/products` = vista por defecto). */
export function toSearchParams(query: ListQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (query.q) p.set('q', query.q)
  if (query.cat) p.set('cat', query.cat)
  if (query.status !== 'active') p.set('status', query.status)
  if (query.page > 1) p.set('page', String(query.page))
  if (query.sort !== 'name,asc') p.set('sort', query.sort)
  return p
}

/** De la URL (personas) a los parámetros de la API: `page - 1` y `status` → `active=true|false|ausente` (CA-19). */
export function toApiParams(query: ListQuery): ProductListParams {
  return {
    q: query.q || undefined,
    active: query.status === 'all' ? undefined : query.status === 'active',
    category: query.cat || undefined,
    page: query.page - 1,
    size: PAGE_SIZE,
    sort: query.sort,
  }
}

/** ¿Hay algo filtrando? (decide entre «Todavía no hay productos» y «Sin resultados»). */
export const hasFilters = (query: ListQuery) => !!query.q || !!query.cat || query.status !== 'active'
