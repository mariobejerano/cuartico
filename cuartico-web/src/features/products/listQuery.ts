import { PRODUCT_TYPES, type ProductListParams, type ProductType } from '../../api/types'

/**
 * Estado del listado tal como vive en la URL (CA-26): `?q=&type=&cat=&status=&page=&sort=`.
 * `page` empieza en 1 (para personas); la API empieza en 0 (ver `toApiParams`).
 * `cat` es el ID de la categoría (HU-15 CA-27); antes era el texto de la categoría.
 */
export type StatusFilter = 'active' | 'inactive' | 'all'
export type SortOrder = 'name,asc' | 'name,desc'

export interface ListQuery {
  q: string
  /** '' = todos los tipos. */
  type: ProductType | ''
  /** Id de la categoría como texto ('' = todas): así se compara directamente con el `value` del `<select>`. */
  cat: string
  status: StatusFilter
  page: number
  sort: SortOrder
}

export const PAGE_SIZE = 20
/**
 * Página más alta que aceptamos de la URL (TT-14, Lupa PR #10). Un enlace con `?page=99999999999` superaba el
 * `Integer` de Java y la API respondía 400 (pantalla de error). Nadie tendrá un millón de páginas de 20 productos.
 */
export const MAX_PAGE = 1_000_000
export const DEFAULT_LIST_QUERY: ListQuery = { q: '', type: '', cat: '', status: 'active', page: 1, sort: 'name,asc' }

const CATEGORY_ID_RE = /^[1-9]\d{0,14}$/

/**
 * Lee la URL de forma tolerante: un valor raro (enlace manipulado o viejo) cae en el valor por defecto,
 * nunca rompe la pantalla ni llega a la API (que respondería 400).
 * - `page` absurda (0, negativa, no numérica o > `MAX_PAGE`) → primera página.
 * - `cat` con texto (enlaces de antes de HU-15, `?cat=Granos`) → se ignora: todas (CA-27).
 */
export function parseListQuery(params: URLSearchParams): ListQuery {
  const status = params.get('status')
  const type = params.get('type') ?? ''
  const cat = (params.get('cat') ?? '').trim()
  const rawPage = params.get('page') ?? ''
  const page = /^\d{1,7}$/.test(rawPage) ? Number(rawPage) : Number.NaN
  return {
    q: (params.get('q') ?? '').trim().slice(0, 100),
    type: (PRODUCT_TYPES as readonly string[]).includes(type) ? (type as ProductType) : '',
    cat: CATEGORY_ID_RE.test(cat) ? cat : '',
    status: status === 'inactive' || status === 'all' ? status : 'active',
    page: page >= 1 && page <= MAX_PAGE ? page : 1,
    sort: params.get('sort') === 'name,desc' ? 'name,desc' : 'name,asc',
  }
}

/** Escribe en la URL solo lo que no es por defecto: enlaces cortos y limpios (`/products` = vista por defecto). */
export function toSearchParams(query: ListQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (query.q) p.set('q', query.q)
  if (query.type) p.set('type', query.type)
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
    type: query.type || undefined,
    categoryId: query.cat ? Number(query.cat) : undefined,
    page: query.page - 1,
    size: PAGE_SIZE,
    sort: query.sort,
  }
}

/** ¿Hay algo filtrando? (decide entre «Todavía no hay productos» y «Sin resultados»). */
export const hasFilters = (query: ListQuery) => !!query.q || !!query.type || !!query.cat || query.status !== 'active'
