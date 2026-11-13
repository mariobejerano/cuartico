import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { json, networkError, problem } from '../../test/fakeApi'
import { loggedInWithProducts, page, product, ref } from '../../test/productFixtures'
import { renderApp } from '../../test/renderApp'
import { productKeys } from './queries'

const LIST = 'GET /api/v1/products'

describe('Formulario de producto (HU-02 CA-25)', () => {
  it('alta: USD preseleccionado, mínimo 0, stock en 0 y sin tarjeta de estado', async () => {
    loggedInWithProducts()
    renderApp('/products/new')
    expect(await screen.findByLabelText(/^Nombre/)).toHaveValue('')
    expect(screen.getByLabelText('Moneda')).toHaveValue('USD')
    expect(screen.getByLabelText(/^Stock mínimo/)).toHaveValue('0')
    expect(screen.getByText('El stock empieza en 0 y se actualiza con las compras y ventas.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Estado del producto' })).not.toBeInTheDocument()
  })

  it('valida al salir del campo y al guardar, sin llamar a la API; el error se quita al corregir', async () => {
    const api = loggedInWithProducts()
    renderApp('/products/new')
    const u = userEvent.setup()
    const name = await screen.findByLabelText(/^Nombre/)

    await u.click(name)
    await u.tab()
    expect(await screen.findByText('Este campo es obligatorio.')).toBeInTheDocument()
    expect(name).toHaveAttribute('aria-invalid', 'true')

    await u.type(screen.getByLabelText(/^SKU/), 'arr 001')
    await u.tab()
    expect(await screen.findByText(/Usa solo letras sin tilde/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^SKU/)).toHaveValue('ARR 001') // en mayúsculas al salir (CA-2)

    await u.type(screen.getByLabelText('Importe'), '3,555')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByText('Escribe un número igual o mayor que 0, con hasta 2 decimales.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(3)) // nombre, categoría y unidad
    expect(name).toHaveFocus() // foco en el primer error
    expect(api.calls('POST /api/v1/products')).toHaveLength(0)

    await u.type(name, 'Arroz')
    await waitFor(() => expect(name).not.toHaveAttribute('aria-invalid'))
  })

  it('alta correcta: envía el cuerpo normalizado, vuelve al listado con sus filtros y avisa', async () => {
    const api = loggedInWithProducts()
      .on(LIST, () => json(200, page([product()])))
      .on('POST /api/v1/products', (req) => json(201, product({ id: 7, ...(req.body as object) })))
    const { router } = renderApp('/products?q=arr&page=2')
    const u = userEvent.setup()

    await u.click((await screen.findAllByRole('link', { name: 'Nuevo producto' }))[0])
    await u.type(await screen.findByLabelText(/^Nombre/), '  Arroz 1 kg ')
    await u.type(screen.getByLabelText(/^SKU/), ' arr-001 ')
    await u.selectOptions(screen.getByLabelText(/^Categoría/), 'Alimentos › Granos')
    await u.selectOptions(screen.getByLabelText(/^Unidad de medida/), 'KG')
    await u.clear(screen.getByLabelText(/^Stock mínimo/))
    await u.type(screen.getByLabelText(/^Stock mínimo/), '2,5')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await screen.findByText('Producto «Arroz 1 kg» creado.')).toBeInTheDocument()
    expect(api.calls('POST /api/v1/products')[0].body).toEqual({
      name: 'Arroz 1 kg',
      sku: 'ARR-001',
      unit: 'KG',
      categoryId: 5,
      brand: null,
      model: null,
      warrantyMonths: null,
      minStock: 2.5,
      salePrice: null,
      salePriceCurrency: null,
      hasVariants: false, // HU-16: producto simple (sin `variants`)
    })
    expect(router.state.location.pathname).toBe('/products')
    expect(router.state.location.search).toBe('?q=arr&page=2')
  })

  it('409 product.sku_conflict se muestra en el campo SKU (CA-3, CA-25)', async () => {
    loggedInWithProducts().on('POST /api/v1/products', () =>
      problem(409, 'product.sku_conflict', 'Ya existe un producto con el SKU ARR-001.'),
    )
    renderApp('/products/new')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), 'Arroz')
    await u.type(screen.getByLabelText(/^SKU/), 'ARR-001')
    await u.selectOptions(await screen.findByLabelText(/^Categoría/), 'Alimentos › Granos')
    await u.selectOptions(screen.getByLabelText(/^Unidad de medida/), 'UNIT')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await screen.findByText('Ya existe un producto con el SKU ARR-001.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^SKU/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/^SKU/)).toHaveFocus()
  })

  it('400 validation.failed: cada error del servidor en su campo', async () => {
    loggedInWithProducts().on('POST /api/v1/products', () =>
      problem(400, 'validation.failed', 'Datos no válidos', { errors: { minStock: 'valor no válido' } }),
    )
    renderApp('/products/new')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), 'Arroz')
    await u.selectOptions(await screen.findByLabelText(/^Categoría/), 'Alimentos › Granos')
    await u.selectOptions(screen.getByLabelText(/^Unidad de medida/), 'UNIT')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByText('valor no válido')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Stock mínimo/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('error de red al guardar: alerta con «Reintentar» que reenvía', async () => {
    const api = loggedInWithProducts()
      .on(LIST, () => json(200, page([])))
      .on('POST /api/v1/products', networkError, () => json(201, product({ id: 9, name: 'Arroz' })))
    renderApp('/products/new')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), 'Arroz')
    await u.selectOptions(await screen.findByLabelText(/^Categoría/), 'Alimentos › Granos')
    await u.selectOptions(screen.getByLabelText(/^Unidad de medida/), 'UNIT')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No pudimos conectar con el servidor')
    await u.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Producto «Arroz» creado.')).toBeInTheDocument()
    await waitFor(() => expect(api.calls('POST /api/v1/products')).toHaveLength(2))
  })

  it('edición: carga los valores, stock y costo en solo lectura y auditoría (CA-8, CA-25)', async () => {
    loggedInWithProducts().on('GET /api/v1/products/1', () =>
      json(200, product({ salePriceCurrency: 'CUP', salePrice: 3200, minStock: 12.5 })),
    )
    renderApp('/products/1/edit')
    expect(await screen.findByLabelText(/^Nombre/)).toHaveValue('Arroz blanco')
    expect(screen.getByLabelText(/^SKU/)).toHaveValue('ARR-001')
    expect(screen.getByLabelText('Moneda')).toHaveValue('CUP') // la del producto, no USD
    expect(screen.getByLabelText('Importe')).toHaveValue('3200')
    expect(screen.getByLabelText(/^Stock mínimo/)).toHaveValue('12,5')
    expect(screen.getByRole('heading', { name: 'Stock y costo' })).toBeInTheDocument()
    expect(screen.getByText('Se actualiza con las compras y ventas.')).toBeInTheDocument()
    // Costo promedio vacío: «—» con aria-hidden + «Sin definir» para lectores de pantalla.
    const avgCost = screen.getByText('Costo promedio').nextElementSibling as HTMLElement
    expect(within(avgCost).getByText('—')).toHaveAttribute('aria-hidden', 'true')
    expect(within(avgCost).getByText('Sin definir')).toHaveClass('visually-hidden')
    expect(screen.getByText(/^Creado por admin el/)).toBeInTheDocument()
  })

  it('edición correcta: PUT con la versión editada y «Cambios guardados.»', async () => {
    const api = loggedInWithProducts()
      .on('GET /api/v1/products/1', () => json(200, product({ version: 3 })))
      .on('PUT /api/v1/products/1', () => json(200, product({ name: 'Arroz largo', version: 4 })))
      .on(LIST, () => json(200, page([product()])))
    renderApp('/products/1/edit')
    const u = userEvent.setup()
    const name = await screen.findByLabelText(/^Nombre/)
    await u.clear(name)
    await u.type(name, 'Arroz largo')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument()
    expect(api.calls('PUT /api/v1/products/1')[0].body).toMatchObject({ name: 'Arroz largo', version: 3 })
  })

  it('409 resource.version_conflict: avisa y «Recargar producto» trae la versión actual (CA-9)', async () => {
    loggedInWithProducts()
      .on(
        'GET /api/v1/products/1',
        () => json(200, product({ version: 0 })),
        () => json(200, product({ name: 'Arroz (cambiado)', version: 1 })),
      )
      .on('PUT /api/v1/products/1', () =>
        problem(409, 'resource.version_conflict', 'Otra persona cambió este registro.'),
      )
    renderApp('/products/1/edit')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), ' 1 kg')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Otra persona cambió este producto mientras lo editabas')
    await u.click(within(alert).getByRole('button', { name: 'Recargar producto' }))
    await waitFor(() => expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Arroz (cambiado)'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('cancelar con cambios pide confirmación; «Seguir editando» se queda y «Descartar» sale', async () => {
    loggedInWithProducts()
      .on('GET /api/v1/products/1', () => json(200, product()))
      .on(LIST, () => json(200, page([product()])))
    const { router } = renderApp('/products/1/edit')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), ' x')

    await u.click(screen.getByRole('link', { name: 'Cancelar' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Descartar los cambios?' })
    await u.click(within(dialog).getByRole('button', { name: 'Seguir editando' }))
    expect(router.state.location.pathname).toBe('/products/1/edit')
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Arroz blanco x')

    await u.click(screen.getByRole('link', { name: 'Cancelar' }))
    await u.click(within(await screen.findByRole('dialog', { name: '¿Descartar los cambios?' })).getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/products'))
  })

  it('cancelar sin cambios sale directamente', async () => {
    loggedInWithProducts()
      .on('GET /api/v1/products/1', () => json(200, product()))
      .on(LIST, () => json(200, page([product()])))
    const { router } = renderApp('/products/1/edit')
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Cancelar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/products'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('producto inexistente (404) o id inválido: «Este producto no existe» (CA-10)', async () => {
    loggedInWithProducts().on('GET /api/v1/products/99', () => problem(404, 'product.not_found', 'No existe el producto 99.'))
    renderApp('/products/99/edit')
    expect(await screen.findByRole('heading', { name: 'Este producto no existe' })).toBeInTheDocument()
  })

  it('ADMIN: tarjeta de estado; desactivar pide confirmación y pasa a inactivo sin perder lo escrito (CA-12, CA-24)', async () => {
    const api = loggedInWithProducts()
      .on('GET /api/v1/products/1', () => json(200, product()))
      .on('POST /api/v1/products/1/deactivate', () => json(200, product({ active: false, version: 1 })))
      .on('PUT /api/v1/products/1', () => json(200, product({ active: false, version: 2 })))
      .on(LIST, () => json(200, page([])))
    renderApp('/products/1/edit')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), ' 2')
    await u.click(screen.getByRole('button', { name: 'Desactivar producto' }))
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desactivar' }))

    expect(await screen.findByRole('button', { name: 'Activar producto' })).toBeInTheDocument()
    expect(screen.getByText('Inactivo: no se puede usar en compras, combos ni pedidos nuevos.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Arroz blanco 2')

    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await screen.findByText('Cambios guardados.')
    expect(api.calls('PUT /api/v1/products/1')[0].body).toMatchObject({ version: 1 }) // la versión tras desactivar
  })

  it('OPERATOR no ve la tarjeta «Estado del producto» (CA-24)', async () => {
    loggedInWithProducts('OPERATOR').on('GET /api/v1/products/1', () => json(200, product()))
    renderApp('/products/1/edit')
    await screen.findByLabelText(/^Nombre/)
    expect(screen.queryByRole('heading', { name: 'Estado del producto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument()
  })

  it('en inglés: unidades y textos traducidos (CA-28)', async () => {
    loggedInWithProducts()
    localStorage.setItem('cuartico.lang', 'en')
    const { default: i18n } = await import('../../i18n')
    await i18n.changeLanguage('en')
    renderApp('/products/new')
    expect(await screen.findByLabelText(/^Unit of measure/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Piece (pcs)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save product' })).toBeInTheDocument()
  })

  it('HU-15 CA-26: selector con rutas de las activas, tipo debajo; la inactiva actual aparece marcada', async () => {
    loggedInWithProducts().on('GET /api/v1/products/1', () => json(200, product({ category: ref(7) })))
    renderApp('/products/1/edit')
    const select = await screen.findByLabelText(/^Categoría/)
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Electrodomésticos › Cocina' })).toBeInTheDocument())
    expect(select).toHaveValue('7')
    expect(within(select).getByRole('option', { name: 'Alimentos › Confituras (inactiva)' })).toBeInTheDocument()
    expect(within(select).queryByRole('option', { name: /Mermeladas/ })).not.toBeInTheDocument() // otra inactiva: no
    expect(screen.getByText('Tipo: Alimentos')).toBeInTheDocument()
  })

  it('HU-15 CA-16/17/26: electrodoméstico pide modelo y garantía con unidad fija; al pasar a alimentos avisa y no los envía', async () => {
    const api = loggedInWithProducts()
      .on(LIST, () => json(200, page([])))
      .on('POST /api/v1/products', () => json(201, product({ id: 3, name: 'Olla' })))
    renderApp('/products/new')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), 'Olla')
    await u.selectOptions(screen.getByLabelText(/^Unidad de medida/), 'KG')
    expect(screen.queryByLabelText(/^Modelo/)).not.toBeInTheDocument()

    await u.selectOptions(screen.getByLabelText(/^Categoría/), 'Electrodomésticos › Cocina')
    expect(screen.getByText('Tipo: Electrodomésticos')).toBeInTheDocument()
    expect(await screen.findByText('La unidad pasa a «Unidad (u)»: Electrodomésticos se cuenta por unidades.')).toBeInTheDocument()
    const unit = screen.getByLabelText(/^Unidad de medida/)
    expect(unit).toBeDisabled()
    expect(unit).toHaveValue('UNIT')
    expect(screen.getByText('Fija: Electrodomésticos se cuenta por unidades.')).toBeInTheDocument()

    await u.type(screen.getByLabelText(/^Modelo/), 'RC-18')
    await u.type(screen.getByLabelText(/^Garantía/), '150')
    await u.tab()
    expect(await screen.findByText('Escribe un número entero de 0 a 120.')).toBeInTheDocument()
    await u.clear(screen.getByLabelText(/^Garantía/))
    await u.type(screen.getByLabelText(/^Garantía/), '12')

    await u.selectOptions(screen.getByLabelText(/^Categoría/), 'Alimentos › Granos')
    expect(await screen.findByText('Este tipo no usa modelo ni garantía: no se guardarán.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Modelo/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Unidad de medida/)).toBeEnabled()

    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await screen.findByText('Producto «Olla» creado.')
    expect(api.calls('POST /api/v1/products')[0].body).toMatchObject({
      categoryId: 5,
      unit: 'UNIT',
      model: null,
      warrantyMonths: null,
    })
  })

  it('HU-15 CA-26: en electrodomésticos se envían modelo, garantía y marca', async () => {
    const api = loggedInWithProducts()
      .on(LIST, () => json(200, page([])))
      .on('POST /api/v1/products', () => json(201, product({ id: 3, name: 'Olla' })))
    renderApp('/products/new')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), 'Olla')
    await u.selectOptions(screen.getByLabelText(/^Categoría/), 'Electrodomésticos › Cocina')
    await u.type(screen.getByLabelText(/^Marca/), ' Royal ')
    await u.type(screen.getByLabelText(/^Modelo/), 'RC-18')
    await u.type(screen.getByLabelText(/^Garantía/), '12')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await screen.findByText('Producto «Olla» creado.')
    expect(api.calls('POST /api/v1/products')[0].body).toMatchObject({
      categoryId: 10,
      brand: 'Royal',
      model: 'RC-18',
      warrantyMonths: 12,
      unit: 'UNIT',
    })
  })

  it('HU-15 CA-13: 400 category.inactive se muestra en el campo Categoría', async () => {
    loggedInWithProducts().on('POST /api/v1/products', () => problem(400, 'category.inactive', 'La categoría está desactivada.'))
    renderApp('/products/new')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), 'Arroz')
    await u.selectOptions(await screen.findByLabelText(/^Categoría/), 'Alimentos › Granos')
    await u.selectOptions(screen.getByLabelText(/^Unidad de medida/), 'KG')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByText('Esta categoría se ha desactivado. Elige otra.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Categoría/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('TT-14: si falla un refetch en segundo plano, el formulario NO se desmonta ni pierde lo escrito', async () => {
    loggedInWithProducts().on('GET /api/v1/products/1', () => json(200, product()), networkError)
    const { queryClient } = renderApp('/products/1/edit')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), ' 2')
    // Simula el refetch en segundo plano (p. ej. al recuperar la conexión) y que falle.
    await act(() => queryClient.refetchQueries({ queryKey: productKeys.detail(1) }))
    expect(queryClient.getQueryState(productKeys.detail(1))?.status).toBe('error')
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Arroz blanco 2')
  })
})
