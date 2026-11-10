import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, networkError, problem } from '../../test/fakeApi'
import { CATEGORIES, category, loggedInWithProducts } from '../../test/productFixtures'
import { renderApp } from '../../test/renderApp'

const LIST = 'GET /api/v1/categories'

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

/** La fila (`node-row`) de una categoría por su encabezado. */
const rowOf = (name: string) => screen.getByRole('heading', { name: new RegExp(`^${name}`) }).closest('.node-row') as HTMLElement

describe('Página «Categorías» (HU-15 CA-25)', () => {
  it('árbol: 4 raíces con su tipo, subcategorías anidadas, nombre en el otro idioma; inactivas ocultas por defecto', async () => {
    desktop()
    loggedInWithProducts()
    renderApp('/categories')

    const tree = await screen.findByRole('list', { name: 'Categorías' })
    const roots = within(tree).getAllByRole('heading', { level: 2 })
    // Orden alfabético por nombre visible
    expect(roots.map((h) => h.querySelector('.nm')?.textContent)).toEqual(['Alimentos', 'Aseo y hogar', 'Electrodomésticos', 'Ropa'])
    expect(within(rowOf('Aseo y hogar')).getByText('Tipo: Aseo y hogar')).toBeInTheDocument() // D-1
    expect(screen.getByRole('heading', { level: 3, name: 'Arroz' })).toBeInTheDocument() // nivel 3
    expect(within(rowOf('Granos')).getByText('EN: Grains')).toBeInTheDocument()
    expect(within(rowOf('Lácteos')).getByText('Sin nombre en inglés')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Confituras/ })).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByLabelText('Mostrar inactivas (2)'))
    expect(within(rowOf('Confituras')).getByText('Inactiva')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Mermeladas/ })).toBeInTheDocument()
  })

  it('acciones por fila: sin «Añadir subcategoría» en nivel 3 ni en inactivas', async () => {
    desktop()
    loggedInWithProducts()
    renderApp('/categories')
    await screen.findByRole('list', { name: 'Categorías' })
    expect(within(rowOf('Granos')).getByRole('button', { name: 'Añadir subcategoría Granos' })).toBeInTheDocument()
    expect(within(rowOf('Arroz')).queryByRole('button', { name: /Añadir subcategoría/ })).not.toBeInTheDocument()
    expect(within(rowOf('Arroz')).getByRole('button', { name: 'Renombrar Arroz' })).toBeInTheDocument()
  })

  it('crear raíz: tipo obligatorio, envía productType y la fila nueva aparece con aviso', async () => {
    desktop()
    const created = category({ id: 20, name: 'Juguetes', nameEn: 'Toys', productType: 'OTHER', path: 'Juguetes', pathEn: 'Toys' })
    const api = loggedInWithProducts().on('POST /api/v1/categories', () => json(201, created))
    renderApp('/categories')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Nueva categoría' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva categoría' })
    expect(within(dialog).getByLabelText('Categoría superior')).toHaveValue('')

    await u.type(within(dialog).getByLabelText(/^Nombre en español/), 'Juguetes')
    await u.click(within(dialog).getByRole('button', { name: 'Crear categoría' }))
    expect(await within(dialog).findByText('Este campo es obligatorio.')).toBeInTheDocument() // tipo
    expect(api.calls('POST /api/v1/categories')).toHaveLength(0)

    await u.selectOptions(within(dialog).getByLabelText(/^Tipo de producto/), 'OTHER')
    await u.type(within(dialog).getByLabelText(/^Nombre en inglés/), 'Toys')
    await u.click(within(dialog).getByRole('button', { name: 'Crear categoría' }))

    expect(await screen.findByText('Categoría «Juguetes» creada.')).toBeInTheDocument()
    expect(api.calls('POST /api/v1/categories')[0].body).toEqual({
      name: 'Juguetes',
      nameEn: 'Toys',
      parentId: null,
      productType: 'OTHER',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('«Añadir subcategoría»: padre preseleccionado, tipo heredado (sin enviarlo), duplicado y aviso de tildes', async () => {
    desktop()
    const api = loggedInWithProducts().on('POST /api/v1/categories', () =>
      json(201, category({ id: 21, parentId: 1, depth: 2, name: 'Pastas', nameEn: null, path: 'Alimentos › Pastas', pathEn: 'Food › Pastas' })),
    )
    renderApp('/categories')
    const u = userEvent.setup()
    await screen.findByRole('list', { name: 'Categorías' })
    await u.click(within(rowOf('Alimentos')).getByRole('button', { name: 'Añadir subcategoría Alimentos' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva categoría' })
    expect(within(dialog).getByLabelText('Categoría superior')).toHaveValue('1')
    expect(within(dialog).getByText('Tipo: Alimentos (lo hereda de «Alimentos»)')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/^Tipo de producto/)).not.toBeInTheDocument()
    const name = within(dialog).getByLabelText(/^Nombre en español/)
    expect(name).toHaveFocus()

    await u.type(name, 'granos')
    await u.tab()
    expect(await within(dialog).findByText('Ya existe «granos» dentro de «Alimentos».')).toBeInTheDocument()

    await u.clear(name)
    await u.type(name, 'Lacteos')
    expect(await within(dialog).findByText(/Se parece a «Lácteos», que ya existe aquí/)).toBeInTheDocument()

    await u.clear(name)
    await u.type(name, 'Pastas')
    await u.click(within(dialog).getByRole('button', { name: 'Crear categoría' }))
    await screen.findByText('Categoría «Pastas» creada.')
    expect(api.calls('POST /api/v1/categories')[0].body).toEqual({ name: 'Pastas', nameEn: null, parentId: 1 })
  })

  it('409 category.name_conflict del servidor se pinta en el campo nombre', async () => {
    desktop()
    loggedInWithProducts().on('POST /api/v1/categories', () => problem(409, 'category.name_conflict', 'Ya existe.'))
    renderApp('/categories')
    const u = userEvent.setup()
    await screen.findByRole('list', { name: 'Categorías' })
    await u.click(within(rowOf('Ropa')).getByRole('button', { name: 'Añadir subcategoría Ropa' }))
    const dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByLabelText(/^Nombre en español/), 'Calzado')
    await u.click(within(dialog).getByRole('button', { name: 'Crear categoría' }))
    expect(await within(dialog).findByText('Ya existe «Calzado» dentro de «Ropa».')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Nombre en español/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('renombrar: PUT con versión; 409 de versión ofrece «Recargar categoría»', async () => {
    desktop()
    const api = loggedInWithProducts()
      .on('PUT /api/v1/categories/5', () => problem(409, 'resource.version_conflict', 'Conflicto'))
      .on('GET /api/v1/categories/5', () => json(200, { ...CATEGORIES[4], name: 'Cereales', version: 3 }))
    renderApp('/categories')
    const u = userEvent.setup()
    await screen.findByRole('list', { name: 'Categorías' })
    await u.click(within(rowOf('Granos')).getByRole('button', { name: 'Renombrar Granos' }))
    const dialog = await screen.findByRole('dialog', { name: 'Renombrar «Granos»' })
    expect(within(dialog).queryByLabelText('Categoría superior')).not.toBeInTheDocument()
    expect(within(dialog).getByText('No se puede mover a otra categoría ni cambiar su tipo.')).toBeInTheDocument()
    const name = within(dialog).getByLabelText(/^Nombre en español/)
    await u.clear(name)
    await u.type(name, 'Granos y cereales')
    await u.click(within(dialog).getByRole('button', { name: 'Guardar nombre' }))

    expect(api.calls('PUT /api/v1/categories/5')[0]?.body ?? (await waitFor(() => api.calls('PUT /api/v1/categories/5')[0].body))).toEqual({
      name: 'Granos y cereales',
      nameEn: 'Grains',
      version: 0,
    })
    const alert = await within(dialog).findByRole('alert')
    await u.click(within(alert).getByRole('button', { name: 'Recargar categoría' }))
    await waitFor(() => expect(within(dialog).getByLabelText(/^Nombre en español/)).toHaveValue('Cereales'))
  })

  it('desactivar: con hijas activas explica el bloqueo sin llamar a la API', async () => {
    desktop()
    const api = loggedInWithProducts()
    renderApp('/categories')
    const u = userEvent.setup()
    await screen.findByRole('list', { name: 'Categorías' })
    await u.click(within(rowOf('Alimentos')).getByRole('button', { name: 'Desactivar Alimentos' }))
    const dialog = await screen.findByRole('dialog', { name: 'Todavía no se puede desactivar «Alimentos»' })
    expect(within(dialog).getByText('Primero desactiva sus subcategorías activas: «Granos», «Lácteos».')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: 'Entendido' }))
    expect(api.calls('POST /api/v1/categories/1/deactivate')).toHaveLength(0)
  })

  it('desactivar: confirma con los productos que la conservan y «Deshacer» la reactiva', async () => {
    desktop()
    const granosLeaf = CATEGORIES.map((c) => (c.id === 8 ? { ...c, active: false } : c)) // Granos sin hijas activas
    const api = loggedInWithProducts('ADMIN', granosLeaf)
      .on('POST /api/v1/categories/5/deactivate', () => json(200, { ...CATEGORIES[4], active: false, version: 1 }))
      .on('POST /api/v1/categories/5/activate', () => json(200, { ...CATEGORIES[4], active: true, version: 2 }))
    renderApp('/categories')
    const u = userEvent.setup()
    await screen.findByRole('list', { name: 'Categorías' })
    await u.click(within(rowOf('Granos')).getByRole('button', { name: 'Desactivar Granos' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Desactivar «Granos»?' })
    expect(within(dialog).getByText('3 productos conservan esta categoría.')).toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: 'Desactivar' }))
    expect(await screen.findByText('«Granos» desactivada.')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(api.calls('POST /api/v1/categories/5/activate')).toHaveLength(1))
  })

  it('sin productos no se menciona el recuento; activar con la superior inactiva explica el bloqueo', async () => {
    desktop()
    loggedInWithProducts()
    renderApp('/categories')
    const u = userEvent.setup()
    await screen.findByRole('list', { name: 'Categorías' })
    await u.click(within(rowOf('Lácteos')).getByRole('button', { name: 'Desactivar Lácteos' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Desactivar «Lácteos»?' })
    expect(within(dialog).queryByText(/conservan? esta categoría/)).not.toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    await u.click(screen.getByLabelText(/^Mostrar inactivas/))
    await u.click(within(rowOf('Mermeladas')).getByRole('button', { name: 'Activar Mermeladas' }))
    expect(await screen.findByRole('dialog', { name: 'Primero activa «Alimentos › Confituras»' })).toBeInTheDocument()
  })

  it('móvil: «⋯» abre la hoja de acciones con la nota de último nivel', async () => {
    loggedInWithProducts()
    renderApp('/categories')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Acciones de «Arroz»' }))
    const sheet = await screen.findByRole('dialog', { name: 'Arroz' })
    expect(within(sheet).getByText('Alimentos › Granos › Arroz')).toBeInTheDocument()
    expect(within(sheet).getByText('Último nivel: no admite subcategorías.')).toBeInTheDocument()
    await u.click(within(sheet).getByRole('button', { name: 'Renombrar' }))
    expect(await screen.findByRole('dialog', { name: 'Renombrar «Arroz»' })).toBeInTheDocument()
  })

  it('error de red al cargar: «No pudimos conectar» con «Reintentar»', async () => {
    loggedInWithProducts().on(LIST, networkError, () => json(200, CATEGORIES))
    renderApp('/categories')
    expect(await screen.findByRole('heading', { name: 'No pudimos conectar con el servidor' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('list', { name: 'Categorías' })).toBeInTheDocument()
  })

  it('en inglés: nombres con nameEn y el español como segunda línea (CA-28)', async () => {
    desktop()
    loggedInWithProducts()
    const { default: i18n } = await import('../../i18n')
    await i18n.changeLanguage('en')
    renderApp('/categories')
    await screen.findByRole('list', { name: 'Categories' })
    expect(within(rowOf('Grains')).getByText('ES: Granos')).toBeInTheDocument()
    expect(within(rowOf('Personal care & home')).getByText('Type: Personal care & home')).toBeInTheDocument()
  })
})
