import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { json, problem } from '../../test/fakeApi'
import { loggedInWithProducts, page, product, shirt, variant } from '../../test/productFixtures'
import { renderApp } from '../../test/renderApp'

const LIST = 'GET /api/v1/products'
const SHIRT = 'GET /api/v1/products/2'

/** Producto «Camiseta» que devuelve la API tras una operación, con las variantes dadas. */
const shirtWith = (variants: ReturnType<typeof variant>[]) => shirt({ variants, variantCount: variants.length })
const BASE_VARIANTS = () => shirt().variants!

describe('Alta con variantes (HU-16 CA-21, D-2)', () => {
  it('Ropa marca la casilla; el generador con prefijo crea las filas y se envían ordenadas', async () => {
    const api = loggedInWithProducts()
      .on(LIST, () => json(200, page([])))
      .on('POST /api/v1/products', () => json(201, shirt({ id: 9, name: 'Camiseta' })))
    renderApp('/products/new')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), 'Camiseta')
    await u.selectOptions(screen.getByLabelText(/^Categoría/), 'Ropa')

    expect(screen.getByLabelText('Tiene tallas o colores')).toBeChecked()
    expect(screen.queryByLabelText(/^SKU/)).not.toBeInTheDocument() // SKU y mínimo del producto desaparecen

    await u.click(screen.getByRole('button', { name: 'S' }))
    await u.click(screen.getByRole('button', { name: 'M' }))
    expect(screen.getByRole('button', { name: 'M' })).toHaveAttribute('aria-pressed', 'true')
    await u.type(screen.getByLabelText('Colores'), 'Blanco, Azul marino{Enter}')
    await u.type(screen.getByLabelText(/^Prefijo de SKU/), 'cam')
    expect(screen.getByText('4 combinaciones nuevas.')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Añadir 4 variantes' }))

    // Orden de la API (talla, luego color) y foco en la primera fila de la lista
    const first = screen.getByLabelText('S · Azul marino SKU')
    await waitFor(() => expect(first).toHaveFocus())
    expect(first).toHaveValue('CAM-S-AZM')
    expect(screen.getByLabelText('M · Blanco SKU')).toHaveValue('CAM-M-BLA')
    expect(screen.getByText('Añadir variantes', { selector: 'button' })).toBeDisabled() // no hay combinaciones nuevas
    const min = screen.getByLabelText('M · Blanco Stock mínimo')
    await u.clear(min)
    await u.type(min, '3')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await screen.findByText('Producto «Camiseta» creado.')).toBeInTheDocument()
    expect(api.calls('POST /api/v1/products')[0].body).toMatchObject({
      sku: null,
      minStock: null,
      unit: 'UNIT',
      categoryId: 2,
      hasVariants: true,
      variants: [
        { sku: 'CAM-S-AZM', size: 'S', color: 'Azul marino', minStock: 0 },
        { sku: 'CAM-S-BLA', size: 'S', color: 'Blanco', minStock: 0 },
        { sku: 'CAM-M-AZM', size: 'M', color: 'Azul marino', minStock: 0 },
        { sku: 'CAM-M-BLA', size: 'M', color: 'Blanco', minStock: 3 },
      ],
    })
  })

  it('sin filas no envía y lleva el foco a «Tallas»; la casilla tocada se respeta; quitar y SKU repetido', async () => {
    const api = loggedInWithProducts()
    renderApp('/products/new')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), 'Ventilador')
    await u.click(screen.getByLabelText('Tiene tallas o colores'))
    await u.selectOptions(screen.getByLabelText(/^Categoría/), 'Alimentos › Granos')
    expect(screen.getByLabelText('Tiene tallas o colores')).toBeChecked() // el usuario la tocó: no la cambia la categoría
    await u.selectOptions(screen.getByLabelText(/^Unidad de medida/), 'UNIT')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(
      await screen.findByText('Añade al menos una variante: elige tallas o colores y pulsa «Añadir variantes».'),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Tallas')).toHaveFocus())
    expect(api.calls('POST /api/v1/products')).toHaveLength(0)

    await u.type(screen.getByLabelText('Tallas'), '38, 40, 42{Enter}')
    await u.click(screen.getByRole('button', { name: 'Quitar la talla 42' }))
    await u.click(screen.getByRole('button', { name: 'Añadir 2 variantes' }))
    await u.type(screen.getByLabelText('38 SKU'), 'v-1')
    await u.type(screen.getByLabelText('40 SKU'), 'V-1')
    await u.tab()
    expect(await screen.findByText('Este SKU se repite en otra variante.')).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Quitar 40' }))
    expect(screen.queryByLabelText('40 SKU')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar 38' })).toHaveFocus() // el foco no se pierde
  })

  it('errores de la API en su fila: 409 product.sku_conflict y 400 errors["variants[0].minStock"]', async () => {
    loggedInWithProducts().on(
      'POST /api/v1/products',
      () => problem(409, 'product.sku_conflict', 'El SKU CAM-M ya lo usa otro producto o variante.'),
      () => problem(400, 'validation.failed', 'Datos no válidos', { errors: { 'variants[0].minStock': 'valor no válido' } }),
    )
    renderApp('/products/new')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), 'Camiseta')
    await u.selectOptions(screen.getByLabelText(/^Categoría/), 'Ropa')
    await u.click(screen.getByRole('button', { name: 'S' }))
    await u.click(screen.getByRole('button', { name: 'M' }))
    await u.type(screen.getByLabelText(/^Prefijo de SKU/), 'cam')
    await u.click(screen.getByRole('button', { name: 'Añadir 2 variantes' }))
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await screen.findByText('El SKU CAM-M ya lo usa otro producto o variante.')).toBeInTheDocument()
    expect(screen.getByLabelText('M SKU')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('S SKU')).not.toHaveAttribute('aria-invalid')

    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByText('valor no válido')).toBeInTheDocument()
    expect(screen.getByLabelText('S Stock mínimo')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('Edición de un producto con variantes (CA-22)', () => {
  it('tarjeta con total y filas; el PUT del producto va sin SKU ni mínimo; OPERATOR no desactiva', async () => {
    const api = loggedInWithProducts('OPERATOR')
      .on(SHIRT, () => json(200, shirt()))
      .on('PUT /api/v1/products/2', () => json(200, shirt({ version: 6 })))
      .on(LIST, () => json(200, page([])))
    renderApp('/products/2/edit')
    const u = userEvent.setup()
    expect(await screen.findByRole('heading', { name: 'Tallas y colores (3)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Inventario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Stock y costo' })).not.toBeInTheDocument()
    expect(screen.getByText('Suma de todas las variantes, también las inactivas. Se actualiza con las compras y ventas.')).toBeInTheDocument()
    expect(screen.getByText('3 variantes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar XL · Azul marino' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Desactivar/ })).not.toBeInTheDocument()

    await u.type(screen.getByLabelText(/^Nombre/), ' 2')
    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await screen.findByText('Cambios guardados.')
    const body = api.calls('PUT /api/v1/products/2')[0].body as Record<string, unknown>
    expect(body).toMatchObject({ name: 'Camiseta básica 2', sku: null, minStock: null, version: 5 })
    expect(body).not.toHaveProperty('hasVariants')
  })

  it('editar una fila: se guarda al momento con su versión y no toca el formulario del producto (CA-9, CA-13b)', async () => {
    const api = loggedInWithProducts()
      .on(SHIRT, () => json(200, shirt()))
      .on('PUT /api/v1/products/2/variants/102', (req) => {
        const vs = BASE_VARIANTS()
        vs[1] = variant({ ...vs[1], ...(req.body as object), version: 4 })
        return json(200, shirtWith(vs))
      })
      .on('PUT /api/v1/products/2', () => json(200, shirt({ version: 6 })))
      .on(LIST, () => json(200, page([])))
    renderApp('/products/2/edit')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/^Nombre/), ' X')
    await u.click(screen.getByRole('button', { name: 'Editar M · Blanco' }))

    const row = screen.getByRole('form', { name: 'M · Blanco' })
    expect(within(row).getByLabelText('Talla')).toHaveFocus()
    const sku = within(row).getByLabelText('SKU')
    await u.clear(sku)
    await u.type(sku, 'cam-m-b2{Enter}')

    expect(await screen.findByText('Variante «M · Blanco» guardada.')).toBeInTheDocument()
    expect(api.calls('PUT /api/v1/products/2/variants/102')[0].body).toEqual({
      sku: 'CAM-M-B2',
      size: 'M',
      color: 'Blanco',
      minStock: 2,
      version: 3,
    })
    expect(screen.getByText('CAM-M-B2')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar M · Blanco' })).toHaveFocus())
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Camiseta básica X') // lo escrito sigue ahí

    await u.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await screen.findByText('Cambios guardados.')
    expect(api.calls('PUT /api/v1/products/2')[0].body).toMatchObject({ version: 5 }) // sin 409 falso
  })

  it('fila: validación local, Esc cancela, 409 de versión con «Recargar variante» y SKU en conflicto', async () => {
    const fresh = BASE_VARIANTS()
    fresh[1] = variant({ ...fresh[1], sku: 'CAM-M-NEW', version: 4 })
    const api = loggedInWithProducts()
      .on(SHIRT, () => json(200, shirt()), () => json(200, shirtWith(fresh)))
      .on(
        'PUT /api/v1/products/2/variants/102',
        () => problem(409, 'resource.version_conflict', 'Otra persona cambió este registro.'),
        () => problem(409, 'product.sku_conflict', 'El SKU CAM-M-NEW ya lo usa otro producto o variante.'),
      )
    renderApp('/products/2/edit')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Editar M · Blanco' }))
    let row = screen.getByRole('form', { name: 'M · Blanco' })
    await u.clear(within(row).getByLabelText('Talla'))
    await u.clear(within(row).getByLabelText('Color'))
    await u.click(within(row).getByRole('button', { name: 'Guardar variante' }))
    expect(await within(row).findByText('Indica al menos una talla o un color.')).toBeInTheDocument()
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('form', { name: 'M · Blanco' })).not.toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Editar M · Blanco' }))
    row = screen.getByRole('form', { name: 'M · Blanco' })
    await u.click(within(row).getByRole('button', { name: 'Guardar variante' }))
    expect(await within(row).findByText('Otra persona cambió esta variante. Tu cambio no se ha guardado.')).toBeInTheDocument()
    await u.click(within(row).getByRole('button', { name: 'Recargar variante' }))
    await waitFor(() => expect(within(row).getByLabelText('SKU')).toHaveValue('CAM-M-NEW'))

    await u.click(within(row).getByRole('button', { name: 'Guardar variante' }))
    expect(await within(row).findByText('El SKU CAM-M-NEW ya lo usa otro producto o variante.')).toBeInTheDocument()
    expect(within(row).getByLabelText('SKU')).toHaveAttribute('aria-invalid', 'true')
    expect(api.calls('PUT /api/v1/products/2/variants/102')[1].body).toMatchObject({ version: 4 }) // la recargada
  })

  it('desactivar una variante: sin diálogo, aviso con «Deshacer» que la reactiva (CA-10, D-3)', async () => {
    const off = BASE_VARIANTS()
    off[2] = variant({ ...off[2], active: false })
    const api = loggedInWithProducts()
      .on(SHIRT, () => json(200, shirt()))
      .on('POST /api/v1/products/2/variants/103/deactivate', () => json(200, shirtWith(off)))
      .on('POST /api/v1/products/2/variants/103/activate', () => json(200, shirt()))
    renderApp('/products/2/edit')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Desactivar XL · Azul marino' }))

    expect(await screen.findByText('Variante «XL · Azul marino» desactivada.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('3 variantes · 1 inactivas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activar XL · Azul marino' })).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(api.calls('POST /api/v1/products/2/variants/103/activate')).toHaveLength(1))
    expect(await screen.findByRole('button', { name: 'Desactivar XL · Azul marino' })).toBeInTheDocument()
  })

  it('«Añadir variantes»: omite las existentes, error de SKU en la fila y luego guarda (CA-8)', async () => {
    const api = loggedInWithProducts()
      .on(SHIRT, () => json(200, shirt()))
      .on(
        'POST /api/v1/products/2/variants',
        () => problem(409, 'product.sku_conflict', 'El SKU CAM-L-BLA ya lo usa otro producto o variante.'),
        () => json(201, shirtWith([...BASE_VARIANTS(), variant({ id: 104, size: 'L', sku: 'CAM-L-BLA' })])),
      )
    renderApp('/products/2/edit')
    const u = userEvent.setup()
    const toggle = await screen.findByRole('button', { name: 'Añadir variantes' })
    await u.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(screen.getByLabelText('Tallas')).toHaveFocus())

    await u.click(screen.getByRole('button', { name: 'S' }))
    await u.click(screen.getByRole('button', { name: 'L' }))
    await u.type(screen.getByLabelText('Colores'), 'blanco{Enter}')
    expect(screen.getByText('1 combinación nueva. 1 ya existen y se omiten.')).toBeInTheDocument()
    await u.type(screen.getByLabelText(/^Prefijo de SKU/), 'cam')
    await u.click(screen.getByRole('button', { name: 'Añadir 1 variante' }))
    expect(screen.getByLabelText('L · blanco SKU')).toHaveValue('CAM-L-BLA')

    await u.click(screen.getByRole('button', { name: 'Guardar 1 variante nueva' }))
    expect(await screen.findByText('El SKU CAM-L-BLA ya lo usa otro producto o variante.')).toBeInTheDocument()
    expect(screen.getByLabelText('L · blanco SKU')).toHaveAttribute('aria-invalid', 'true')

    await u.click(screen.getByRole('button', { name: 'Guardar 1 variante nueva' }))
    expect(await screen.findByText('1 variante añadida.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tallas y colores (4)' })).toBeInTheDocument()
    expect(api.calls('POST /api/v1/products/2/variants')[1].body).toEqual({
      variants: [{ sku: 'CAM-L-BLA', size: 'L', color: 'blanco', minStock: 0 }],
    })
  })
})

describe('Convertir simple ↔ con variantes (CA-12, CA-13, CA-13b)', () => {
  it('simple → con variantes: pide guardar antes; luego talla/color obligatorios y abre «Añadir variantes»', async () => {
    const converted = product({
      hasVariants: true,
      sku: null,
      minStock: null,
      variantCount: 1,
      variants: [variant({ id: 50, size: null, color: 'Blanco', sku: 'ARR-001' })],
      version: 1,
    })
    const api = loggedInWithProducts()
      .on('GET /api/v1/products/1', () => json(200, product({ stock: { onHand: 12, reserved: 0, available: 12, averageCost: null, costCurrency: null } })))
      .on('POST /api/v1/products/1/variants/enable', () => json(200, converted))
    renderApp('/products/1/edit')
    const u = userEvent.setup()
    const name = await screen.findByLabelText(/^Nombre/)
    await u.type(name, 'x')
    await u.click(screen.getByRole('button', { name: 'Convertir en producto con variantes' }))
    const info = await screen.findByRole('dialog', { name: 'Guarda antes los cambios del producto' })
    await u.click(within(info).getByRole('button', { name: 'Entendido' }))
    await u.type(name, '{Backspace}') // vuelve a ser igual que lo guardado: sin cambios

    await u.click(screen.getByRole('button', { name: 'Convertir en producto con variantes' }))
    const dialog = await screen.findByRole('dialog', { name: 'Convertir en producto con variantes' })
    expect(dialog).toHaveTextContent('Las unidades que ya tienes (12 kg)')
    await u.click(within(dialog).getByRole('button', { name: 'Convertir' }))
    expect(within(dialog).getByText('Indica al menos una talla o un color.')).toBeInTheDocument()
    await u.type(within(dialog).getByLabelText('Color'), 'Blanco')
    await u.click(within(dialog).getByRole('button', { name: 'Convertir' }))

    expect(await screen.findByText('«Arroz blanco» ya tiene tallas o colores. Añade las demás variantes.')).toBeInTheDocument()
    expect(api.calls('POST /api/v1/products/1/variants/enable')[0].body).toEqual({ size: null, color: 'Blanco' })
    expect(screen.getByRole('heading', { name: 'Tallas y colores (1)' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^SKU/)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Tallas')).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Convertir en producto simple' })).toBeInTheDocument()
  })

  it('con una variante inactiva → simple: confirma y el formulario vuelve a tener SKU', async () => {
    const single = shirt({ variantCount: 1, variants: [variant({ id: 102, size: 'M', active: false })] })
    loggedInWithProducts()
      .on(SHIRT, () => json(200, single))
      .on('POST /api/v1/products/2/variants/disable', () =>
        json(200, shirt({ hasVariants: false, sku: 'CAM-M', minStock: 2, variantCount: 1, variants: null, version: 6 })),
      )
    renderApp('/products/2/edit')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Convertir en producto simple' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Convertir en producto simple?' })
    expect(dialog).toHaveTextContent('«M · Blanco» deja de tener talla y color y se vuelve a activar.')
    await u.click(within(dialog).getByRole('button', { name: 'Convertir en producto simple' }))

    expect(await screen.findByText('«Camiseta básica» es ahora un producto simple.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^SKU/)).toHaveValue('CAM-M')
    expect(screen.getByRole('button', { name: 'Convertir en producto con variantes' })).toBeInTheDocument()
  })

  it('carrera: 409 product.has_multiple_variants → aviso de error y recarga del producto', async () => {
    const api = loggedInWithProducts()
      .on(SHIRT, () => json(200, shirt({ variantCount: 1, variants: [variant()] })), () => json(200, shirt()))
      .on('POST /api/v1/products/2/variants/disable', () =>
        problem(409, 'product.has_multiple_variants', 'Solo se puede convertir en simple si tiene una sola variante.'),
      )
    renderApp('/products/2/edit')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Convertir en producto simple' }))
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Convertir en producto simple' }))
    expect(await screen.findByText('Solo se puede convertir en simple si tiene una sola variante.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Tallas y colores (3)' })).toBeInTheDocument()
    expect(api.calls(SHIRT)).toHaveLength(2)
  })
})

describe('Listado (CA-23)', () => {
  it('«N variantes» en lugar del SKU', async () => {
    loggedInWithProducts().on(LIST, () => json(200, page([shirt({ variants: null }), product()])))
    renderApp('/products')
    expect(await screen.findByText('3 variantes · Ropa')).toBeInTheDocument()
    expect(screen.getByText('SKU ARR-001 · Alimentos › Granos')).toBeInTheDocument()
  })
})
