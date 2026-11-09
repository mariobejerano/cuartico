import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, networkError, problem } from '../../test/fakeApi'
import { loggedInWithProducts, page, product } from '../../test/productFixtures'
import { renderApp } from '../../test/renderApp'

const LIST = 'GET /api/v1/products'

/** Simula una pantalla de escritorio (≥ 768 px) para ver la tabla en vez de las tarjetas. */
function desktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width: 768px'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Listado de productos (HU-02)', () => {
  it('por defecto pide activos, página 0, 20, por nombre, y pinta tarjetas en móvil (CA-17, CA-27)', async () => {
    const api = loggedInWithProducts().on(LIST, () =>
      json(200, page([product(), product({ id: 2, name: 'Leche', sku: null, category: null, salePrice: null, salePriceCurrency: null, unit: 'L' })])),
    )
    renderApp('/products')

    const list = await screen.findByRole('list', { name: 'Productos' })
    const cards = within(list).getAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument()
    expect(within(cards[0]).getByText('SKU ARR-001 · Granos')).toBeInTheDocument()
    expect(within(cards[0]).getByText('2,50 USD')).toBeInTheDocument()
    expect(within(cards[0]).getByText('0 kg')).toBeInTheDocument()
    expect(within(cards[1]).getByText('Sin SKU · Sin categoría')).toBeInTheDocument()
    expect(within(cards[1]).getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1–2 de 2')).toBeInTheDocument()

    const q = api.calls(LIST)[0].query
    expect(Object.fromEntries(q)).toEqual({ active: 'true', page: '0', size: '20', sort: 'name,asc' })
  })

  it('las etiquetas de stock no se muestran hasta HU-04, «Inactivo» sí (CA-17)', async () => {
    loggedInWithProducts().on(LIST, () => json(200, page([product(), product({ id: 2, name: 'Viejo', active: false })])))
    renderApp('/products?status=all')
    await screen.findByRole('heading', { name: 'Viejo' })
    expect(screen.queryByText('Sin stock')).not.toBeInTheDocument()
    expect(screen.queryByText('Stock bajo')).not.toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('en escritorio, tabla con orden por nombre que se refleja en la URL (CA-21, CA-26)', async () => {
    desktop()
    const api = loggedInWithProducts().on(LIST, () => json(200, page([product()])))
    const { router } = renderApp('/products')

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('columnheader', { name: /Producto/ })).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.setup().click(within(table).getByRole('button', { name: /Ordenar por nombre/ }))

    await waitFor(() => expect(router.state.location.search).toBe('?sort=name%2Cdesc'))
    await waitFor(() => expect(api.calls(LIST).at(-1)!.query.get('sort')).toBe('name,desc'))
  })

  it('la búsqueda espera a que dejes de escribir y va a la URL con replace (CA-18, CA-26)', async () => {
    const api = loggedInWithProducts().on(LIST, () => json(200, page([product()])))
    const { router } = renderApp('/products?page=2')
    await screen.findByRole('heading', { name: 'Arroz blanco' })
    const before = api.calls(LIST).length

    await userEvent.setup().type(screen.getByLabelText('Buscar por nombre o SKU'), 'arr')
    expect(api.calls(LIST)).toHaveLength(before) // aún no: espera 300 ms

    await waitFor(() => expect(router.state.location.search).toBe('?q=arr'))
    expect(router.state.historyAction).toBe('REPLACE')
    await waitFor(() => expect(api.calls(LIST).at(-1)!.query.get('q')).toBe('arr'))
    expect(api.calls(LIST).filter((c) => c.query.get('q') === 'a')).toHaveLength(0) // ni una petición por letra
  })

  it('filtros de estado y categoría; página desde 1 en la URL y desde 0 en la API (CA-19, CA-20)', async () => {
    const api = loggedInWithProducts().on(LIST, () =>
      json(200, page([product()], { totalElements: 45, totalPages: 3 })),
    )
    const { router } = renderApp('/products')
    await screen.findByRole('heading', { name: 'Arroz blanco' })
    const u = userEvent.setup()

    await u.selectOptions(screen.getByLabelText('Estado'), 'inactive')
    await waitFor(() => expect(api.calls(LIST).at(-1)!.query.get('active')).toBe('false'))
    await u.selectOptions(await screen.findByLabelText('Categoría'), 'Granos')
    await waitFor(() => expect(api.calls(LIST).at(-1)!.query.get('category')).toBe('Granos'))

    await u.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?cat=Granos&status=inactive&page=2'))
    await waitFor(() => expect(api.calls(LIST).at(-1)!.query.get('page')).toBe('1'))

    await u.selectOptions(screen.getByLabelText('Estado'), 'all')
    await waitFor(() => expect(api.calls(LIST).at(-1)!.query.has('active')).toBe(false))
  })

  it('catálogo vacío sin filtros: invita a crear el primero', async () => {
    loggedInWithProducts().on(LIST, () => json(200, page([])))
    renderApp('/products')
    expect(await screen.findByRole('heading', { name: 'Todavía no hay productos' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Nuevo producto' }).length).toBeGreaterThan(0)
  })

  it('sin resultados con búsqueda: aviso de tildes y «Limpiar filtros» vuelve a la vista por defecto', async () => {
    loggedInWithProducts().on(LIST, () => json(200, page([])))
    const { router } = renderApp('/products?q=azucar&status=all')
    expect(await screen.findByRole('heading', { name: 'No hay productos que coincidan con «azucar»' })).toBeInTheDocument()
    expect(screen.getByText(/La búsqueda distingue tildes/)).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(screen.getByLabelText('Buscar por nombre o SKU')).toHaveValue('')
  })

  it('una página más allá del final (enlace viejo) redirige a la última con datos (CA-20)', async () => {
    const api = loggedInWithProducts().on(LIST, (req) =>
      req.query.get('page') === '8'
        ? json(200, page([], { page: 8, totalElements: 25, totalPages: 2 }))
        : json(200, page([product()], { page: 1, totalElements: 25, totalPages: 2 })),
    )
    const { router } = renderApp('/products?page=9')
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'))
    await screen.findByRole('heading', { name: 'Arroz blanco' })
    expect(api.calls(LIST).at(-1)!.query.get('page')).toBe('1')
  })

  it('error 500: título, detail, código para soporte y «Reintentar»', async () => {
    const api = loggedInWithProducts().on(
      LIST,
      () => problem(500, 'internal.error', 'Error interno del servidor'),
      () => json(200, page([product()])),
    )
    renderApp('/products')
    expect(await screen.findByRole('heading', { name: 'No se pudieron cargar los productos' })).toBeInTheDocument()
    expect(screen.getByText('Error interno del servidor')).toBeInTheDocument()
    expect(screen.getByText('Código para soporte: internal.error')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument()
    expect(api.calls(LIST)).toHaveLength(2)
  })

  it('error de red: «No pudimos conectar con el servidor»', async () => {
    loggedInWithProducts().on(LIST, networkError)
    renderApp('/products')
    expect(await screen.findByRole('heading', { name: 'No pudimos conectar con el servidor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('sin conexión: alerta persistente', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    loggedInWithProducts().on(LIST, () => json(200, page([product()])))
    renderApp('/products')
    expect(await screen.findByText(/Sin conexión. Los cambios no se guardarán/)).toBeInTheDocument()
  })

  it('OPERATOR no ve Desactivar/Activar (CA-24)', async () => {
    loggedInWithProducts('OPERATOR').on(LIST, () => json(200, page([product()])))
    renderApp('/products')
    await screen.findByRole('heading', { name: 'Arroz blanco' })
    expect(screen.getByRole('link', { name: 'Editar Arroz blanco' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument()
  })

  it('ADMIN desactiva con confirmación que muestra el stock, y «Deshacer» lo reactiva (CA-13, CA-14)', async () => {
    const withStock = product({ stock: { onHand: 12.5, reserved: 2, available: 10.5, averageCost: 1.2, costCurrency: 'USD' } })
    const api = loggedInWithProducts()
      .on(LIST, () => json(200, page([withStock])))
      .on('POST /api/v1/products/1/deactivate', () => json(200, { ...withStock, active: false, version: 1 }))
      .on('POST /api/v1/products/1/activate', () => json(200, { ...withStock, active: true, version: 2 }))
    renderApp('/products')
    const u = userEvent.setup()

    await u.click(await screen.findByRole('button', { name: 'Desactivar Arroz blanco' }))
    const dialog = screen.getByRole('dialog', { name: '¿Desactivar «Arroz blanco»?' })
    expect(within(dialog).getByText('Todavía tiene stock: 12,5 kg físico y 2 kg reservado.')).toBeInTheDocument()
    expect(api.calls('POST /api/v1/products/1/deactivate')).toHaveLength(0) // nada sin confirmar

    await u.click(within(dialog).getByRole('button', { name: 'Desactivar' }))
    expect(await screen.findByText('«Arroz blanco» desactivado.')).toBeInTheDocument()
    expect(api.calls('POST /api/v1/products/1/deactivate')).toHaveLength(1)

    await u.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(api.calls('POST /api/v1/products/1/activate')).toHaveLength(1))
  })

  it('cancelar la confirmación no desactiva', async () => {
    const api = loggedInWithProducts().on(LIST, () => json(200, page([product()])))
    renderApp('/products')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Desactivar Arroz blanco' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByText(/Todavía tiene stock/)).not.toBeInTheDocument() // sin stock: sin aviso
    await u.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(api.calls('POST /api/v1/products/1/deactivate')).toHaveLength(0)
  })

  it('activar un inactivo no pide confirmación', async () => {
    const off = product({ active: false })
    const api = loggedInWithProducts()
      .on(LIST, () => json(200, page([off])))
      .on('POST /api/v1/products/1/activate', () => json(200, { ...off, active: true, version: 1 }))
    renderApp('/products?status=inactive')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Activar Arroz blanco' }))
    expect(await screen.findByText('«Arroz blanco» activado.')).toBeInTheDocument()
    expect(api.calls('POST /api/v1/products/1/activate')).toHaveLength(1)
  })
})
