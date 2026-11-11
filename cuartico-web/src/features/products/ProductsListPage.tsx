import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { PRODUCT_TYPES, type PageResponse, type ProductResponse, type ProductType } from '../../api/types'
import { hasRole } from '../../auth/roles'
import { useCurrentUser } from '../../auth/useSession'
import { Icon } from '../../components/Icon'
import { LoadError } from '../../components/LoadError'
import { DESKTOP_QUERY, useMediaQuery } from '../../components/useMediaQuery'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { useCategories } from '../categories/queries'
import { categoryPath, filterOptions } from '../categories/tree'
import {
  hasFilters,
  parseListQuery,
  toApiParams,
  toSearchParams,
  type ListQuery,
  type StatusFilter,
} from './listQuery'
import type { ListReturnState } from './navigation'
import { MoneyValue } from './MoneyValue'
import { ProductBadges } from './ProductBadges'
import { useProductList } from './queries'
import { useProductFormat } from './useProductFormat'
import { useToggleActive } from './useToggleActive'

const SEARCH_DEBOUNCE_MS = 300

/**
 * Estado del listado guardado en la URL (CA-26). La URL es la "fuente de verdad": recargar, compartir el enlace o
 * volver atrás reproduce la misma vista. Analogía: los `@RequestParam` de un GET, pero leídos en el navegador.
 */
function useListQuery() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseListQuery(params), [params])
  const update = useCallback(
    (patch: Partial<ListQuery>, opts?: { replace?: boolean }) =>
      setParams(toSearchParams({ ...query, ...patch }), { replace: opts?.replace }),
    [query, setParams],
  )
  return [query, update] as const
}

/** Listado de productos (HU-02 CA-17 a CA-22, CA-24, CA-26, CA-27; HU-15 CA-19, CA-27). */
export default function ProductsListPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'es'
  useDocumentTitle('products.page_title')
  const location = useLocation()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const isAdmin = hasRole(useCurrentUser(), 'ADMIN')
  const [query, update] = useListQuery()
  const list = useProductList(toApiParams(query))
  const categories = useCategories()
  const { toggle, dialog } = useToggleActive()
  const returnState: ListReturnState = { listSearch: location.search }

  // ----- Búsqueda con espera de 300 ms (CA-26) -----
  const [text, setText] = useState(query.q)
  const [syncedQ, setSyncedQ] = useState(query.q)
  // Si la URL cambia por otra vía («Limpiar filtros», botón atrás), el campo se pone al día.
  // Se hace durante el render (patrón recomendado por React para "ajustar estado cuando cambia una prop").
  if (query.q !== syncedQ) {
    setSyncedQ(query.q)
    if (text.trim() !== query.q) setText(query.q)
  }
  useEffect(() => {
    const next = text.trim()
    if (next === query.q) return
    // `replace`: escribir no llena el historial (el botón «atrás» no recorre letra a letra).
    const timer = setTimeout(() => update({ q: next, page: 1 }, { replace: true }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer) // si se sigue escribiendo, se cancela y se vuelve a esperar
  }, [text, query.q, update])

  // ----- Página fuera de rango (enlace viejo): a la última con datos (CA-20) -----
  const data = list.data
  const outOfRange = !!data && data.content.length === 0 && query.page > 1
  useEffect(() => {
    if (outOfRange) update({ page: Math.max(1, data.totalPages) }, { replace: true })
  }, [outOfRange, data, update])

  // ----- Categoría de la URL que no existe o no es del tipo elegido (enlace manipulado o viejo): se quita, en vez
  // de filtrar por algo que el selector no puede mostrar -----
  const unknownCat =
    !!query.cat &&
    !!categories.data &&
    !categories.data.some((c) => String(c.id) === query.cat && (!query.type || c.productType === query.type))
  useEffect(() => {
    if (unknownCat) update({ cat: '', page: 1 }, { replace: true })
  }, [unknownCat, update])

  const clearFilters = () => {
    setText('')
    update({ q: '', type: '', cat: '', status: 'active', page: 1 })
  }

  /**
   * SELECTS DEPENDIENTES: el Tipo acota las opciones de Categoría. Si la categoría elegida no es del tipo nuevo,
   * se quita (CA-27): si no, el filtro combinado daría siempre «sin resultados».
   */
  const changeType = (type: ProductType | '') => {
    const selected = categories.data?.find((c) => String(c.id) === query.cat)
    const keepCat = !type || !selected || selected.productType === type
    update({ type, cat: keepCat ? query.cat : '', page: 1 })
  }

  const goToPage = (page: number) => {
    update({ page })
    window.scrollTo?.(0, 0)
    document.getElementById('main')?.focus({ preventScroll: true }) // el foco vuelve arriba del listado
  }

  // Todas las categorías (las inactivas marcadas), acotadas por el tipo elegido y ordenadas por ruta (CA-27).
  const categoryOptions = useMemo(
    () =>
      filterOptions(categories.data ?? [], query.type, lang).map((c) => ({
        id: String(c.id),
        label: c.active ? categoryPath(c, lang) : t('products.category_inactive_suffix', { path: categoryPath(c, lang) }),
      })),
    [categories.data, query.type, lang, t],
  )

  const loading = list.isPending || outOfRange
  const ids = { q: useId(), type: useId(), cat: useId(), status: useId() }

  return (
    <>
      <div className="page-head">
        <h1 className="mobile-sr">{t('products.title')}</h1>
        {isDesktop && (
          <Link className="c-btn c-btn--primary" to="/products/new" state={returnState}>
            <Icon name="plus" />
            <span>{t('products.new')}</span>
          </Link>
        )}
      </div>

      <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="c-field f-q">
          <label className="c-label" htmlFor={ids.q}>
            {t('products.search_label')}
          </label>
          <div className="c-search">
            <Icon name="search" />
            <input
              id={ids.q}
              className="c-input"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={100}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        <div className="c-field f-type">
          <label className="c-label" htmlFor={ids.type}>
            {t('products.type')}
          </label>
          <select
            id={ids.type}
            className="c-select"
            value={query.type}
            onChange={(e) => changeType(e.target.value as ProductType | '')}
          >
            <option value="">{t('products.all_types')}</option>
            {PRODUCT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`product_type.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="c-field f-cat">
          <label className="c-label" htmlFor={ids.cat}>
            {t('products.category')}
          </label>
          <select
            id={ids.cat}
            className="c-select"
            value={categoryOptions.some((c) => c.id === query.cat) ? query.cat : ''}
            onChange={(e) => update({ cat: e.target.value, page: 1 })}
          >
            <option value="">{t('products.all_categories')}</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="c-field f-status">
          <label className="c-label" htmlFor={ids.status}>
            {t('products.status')}
          </label>
          <select
            id={ids.status}
            className="c-select"
            value={query.status}
            onChange={(e) => update({ status: e.target.value as StatusFilter, page: 1 })}
          >
            <option value="active">{t('products.status_active')}</option>
            <option value="inactive">{t('products.status_inactive')}</option>
            <option value="all">{t('products.status_all')}</option>
          </select>
        </div>
      </form>

      {/* Anuncia el resultado a lectores de pantalla sin mover el foco */}
      <p className="sr-only" role="status">
        {list.isError
          ? t('products.load_error_title')
          : data && !loading
            ? t('products.results', { count: data.totalElements })
            : ''}
      </p>

      <div aria-busy={loading} className="list-region">
        {loading ? (
          <ListSkeleton desktop={isDesktop} />
        ) : list.isError ? (
          <LoadError error={list.error} titleKey="products.load_error_title" onRetry={() => void list.refetch()} />
        ) : data && data.totalElements === 0 ? (
          hasFilters(query) ? (
            <section className="c-empty">
              <Icon name="search" />
              <h2>{query.q ? t('products.no_results_query', { q: query.q }) : t('products.no_results_filters')}</h2>
              <p>{t('products.no_results_body')}</p>
              <button type="button" className="c-btn c-btn--secondary" onClick={clearFilters}>
                {t('common.clear_filters')}
              </button>
            </section>
          ) : (
            <section className="c-empty">
              <Icon name="empty" />
              <h2>{t('products.empty_title')}</h2>
              <p>{t('products.empty_body')}</p>
              <Link className="c-btn c-btn--primary" to="/products/new" state={returnState}>
                <Icon name="plus" />
                <span>{t('products.new')}</span>
              </Link>
            </section>
          )
        ) : data ? (
          <>
            <div className="list-meta">
              <span>
                {t('common.pagination', {
                  from: data.page * data.size + 1,
                  to: data.page * data.size + data.content.length,
                  total: data.totalElements,
                })}
              </span>
              {hasFilters(query) && (
                <button type="button" className="c-btn c-btn--ghost c-btn--sm" onClick={clearFilters}>
                  {t('common.clear_filters')}
                </button>
              )}
            </div>
            {isDesktop ? (
              <ProductTable
                page={data}
                query={query}
                isAdmin={isAdmin}
                returnState={returnState}
                onToggle={toggle}
                onSort={() => update({ sort: query.sort === 'name,asc' ? 'name,desc' : 'name,asc', page: 1 })}
              />
            ) : (
              <ProductCards page={data} isAdmin={isAdmin} returnState={returnState} onToggle={toggle} />
            )}
            {data.totalPages > 1 && <Pager page={data.page + 1} pages={data.totalPages} onGo={goToPage} />}
          </>
        ) : null}
      </div>

      {!isDesktop && (
        <Link className="c-btn c-btn--primary fab" to="/products/new" state={returnState}>
          <Icon name="plus" />
          <span>{t('products.new')}</span>
        </Link>
      )}
      {dialog}
    </>
  )
}

interface RowsProps {
  page: PageResponse<ProductResponse>
  isAdmin: boolean
  returnState: ListReturnState
  onToggle: (p: ProductResponse) => void
}

/** «SKU ARR-001» (o «Sin SKU») y la ruta de la categoría en el idioma de la interfaz (HU-15 CA-27). */
function useRowText() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'es'
  return {
    sku: (p: ProductResponse) => (p.sku ? t('products.sku_inline', { sku: p.sku }) : t('products.no_sku')),
    path: (p: ProductResponse) => categoryPath(p.category, lang),
  }
}

/** Botones de una fila. Llevan el nombre del producto oculto para lectores («Editar Arroz blanco»). */
function RowActions({ product, isAdmin, returnState, onToggle, size }: Omit<RowsProps, 'page'> & { product: ProductResponse; size: string }) {
  const { t } = useTranslation()
  // El espacio va FUERA del span oculto: así el nombre accesible es «Editar Arroz blanco» en cualquier lector.
  const hidden = <span className="sr-only">{product.name}</span>
  return (
    <>
      <Link className={`c-btn ${size}`} to={`/products/${product.id}/edit`} state={returnState}>
        {t('products.edit')} {hidden}
      </Link>
      {isAdmin && (
        <button type="button" className={`c-btn ${size}`} onClick={() => onToggle(product)}>
          {t(product.active ? 'products.deactivate' : 'products.activate')} {hidden}
        </button>
      )}
    </>
  )
}

function ProductTable({ page, query, onSort, ...rest }: RowsProps & { query: ListQuery; onSort: () => void }) {
  const { t } = useTranslation()
  const fmt = useProductFormat()
  const text = useRowText()
  const asc = query.sort === 'name,asc'
  return (
    <div className="table-wrap">
      <table className="c-table">
        <caption className="sr-only">
          {t('products.title')} · {t('common.page_of', { page: page.page + 1, pages: page.totalPages })}
        </caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={asc ? 'ascending' : 'descending'}>
              <button type="button" className="sort-btn" onClick={onSort}>
                {t('products.col_product')}
                <span className="sr-only">, {t('products.sort_by_name')}</span>
                <Icon name={asc ? 'up' : 'down'} />
              </button>
            </th>
            <th scope="col" className="col-cat">
              {t('products.col_category')}
            </th>
            <th scope="col" className="r">
              {t('products.col_price')}
            </th>
            <th scope="col" className="r">
              {t('products.col_available')}
            </th>
            <th scope="col">{t('products.col_status')}</th>
            <th scope="col">
              <span className="sr-only">{t('products.col_actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {page.content.map((p) => (
            <tr key={p.id} className={p.active ? undefined : 'is-inactive'}>
              <td className="cell-title">
                {p.name}
                {/* Entre 768 y 1023 px la ruta va aquí; desde 1024 px tiene columna propia (lo decide el CSS) */}
                <span className="sub">
                  {text.sku(p)}
                  <span className="cat-inline"> · {text.path(p)}</span>
                </span>
              </td>
              <td className="col-cat">{text.path(p)}</td>
              <td className="r"><MoneyValue amount={p.salePrice} currency={p.salePriceCurrency} /></td>
              <td className="r">{fmt.quantity(p.stock.available, p.unit)}</td>
              <td>
                <ProductBadges product={p} />
              </td>
              <td className="actions">
                <RowActions product={p} size="c-btn--ghost c-btn--sm" {...rest} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** En móvil: lista `<ul>` de tarjetas `<article>` con `<dl>` (semántica real, sin scroll lateral, CA-27). */
function ProductCards({ page, ...rest }: RowsProps) {
  const { t } = useTranslation()
  const fmt = useProductFormat()
  const text = useRowText()
  return (
    <ul className="card-list" aria-label={t('products.title')}>
      {page.content.map((p) => (
        <li key={p.id}>
          <article className={`p-card${p.active ? '' : ' is-inactive'}`} aria-labelledby={`pc-${p.id}`}>
            <div className="p-card-head">
              <div>
                <h2 id={`pc-${p.id}`}>{p.name}</h2>
                <p className="small muted">{`${text.sku(p)} · ${text.path(p)}`}</p>
              </div>
              <ProductBadges product={p} />
            </div>
            <dl>
              <div>
                <dt>{t('products.col_price')}</dt>
                <dd><MoneyValue amount={p.salePrice} currency={p.salePriceCurrency} /></dd>
              </div>
              <div>
                <dt>{t('products.col_available')}</dt>
                <dd>{fmt.quantity(p.stock.available, p.unit)}</dd>
              </div>
            </dl>
            <div className="p-card-actions">
              <RowActions product={p} size="c-btn--secondary" {...rest} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  )
}

function Pager({ page, pages, onGo }: { page: number; pages: number; onGo: (page: number) => void }) {
  const { t } = useTranslation()
  const label = t('common.page_of', { page, pages })
  return (
    <nav className="pager" aria-label={label}>
      <div className="pages">
        <button type="button" className="c-btn c-btn--secondary" disabled={page <= 1} onClick={() => onGo(page - 1)}>
          <Icon name="left" />
          {t('common.previous')}
        </button>
        <span>{label}</span>
        <button type="button" className="c-btn c-btn--secondary" disabled={page >= pages} onClick={() => onGo(page + 1)}>
          {t('common.next')}
          <Icon name="right" />
        </button>
      </div>
    </nav>
  )
}

/** Skeleton con forma de filas (escritorio) o de tarjetas (móvil). */
function ListSkeleton({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      {desktop ? (
        <div className="table-wrap" aria-hidden="true">
          <div className="sk-head">
            <div className="sk sk--30" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="sk-row">
              <div className="sk" />
              <div className="sk" />
              <div className="sk" />
              <div className="sk" />
            </div>
          ))}
        </div>
      ) : (
        <div className="skeleton" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="sk-card">
              <div className="sk sk--65" />
              <div className="sk sk--40" />
              <div className="sk sk--85" />
            </div>
          ))}
        </div>
      )}
      <p className="sr-only">{t('common.loading')}</p>
    </>
  )
}

