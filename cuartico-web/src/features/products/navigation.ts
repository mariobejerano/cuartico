import { useLocation } from 'react-router'

/**
 * Lo que el listado deja en el historial al ir al formulario (`<Link state={…}>`), para que «Volver»,
 * «Cancelar» y «Guardar» regresen a la misma búsqueda, filtros y página (CA-26).
 */
export interface ListReturnState {
  listSearch: string
}

/** Ruta del listado a la que volver. Solo se acepta una query string (`?…`): nunca otra ruta ni otro sitio. */
export function listPathFrom(state: unknown): string {
  const search = (state as Partial<ListReturnState> | null)?.listSearch
  return typeof search === 'string' && search.startsWith('?') ? `/products${search}` : '/products'
}

export function useListPath(): string {
  return listPathFrom(useLocation().state)
}
