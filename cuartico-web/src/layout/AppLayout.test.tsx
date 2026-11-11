import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RequireRole } from '../auth/guards'
import { hasRole } from '../auth/roles'
import { resetSessionForTests, session } from '../auth/session'
import { installFakeApi, json, tokenPair, user } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'
import { render } from '@testing-library/react'

function loggedIn(role: 'ADMIN' | 'OPERATOR' = 'ADMIN') {
  localStorage.setItem('cuartico.refreshToken', 'refresh-1')
  return installFakeApi()
    .on('POST /api/v1/auth/refresh', () => json(200, tokenPair(2, role)))
    .on('GET /api/v1/products', () => json(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }))
    .on('GET /api/v1/categories', () => json(200, []))
}

describe('Layout del panel (HU-01 CA-24)', () => {
  it('muestra Inicio y Productos (sin «Usuarios») y la zona de cuenta con nombre y rol', async () => {
    loggedIn('OPERATOR')
    renderApp('/')
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })

    const navs = screen.getAllByRole('navigation', { name: 'Navegación principal' })
    for (const nav of navs) {
      expect(within(nav).getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
      expect(within(nav).getByRole('link', { name: 'Productos' })).toBeInTheDocument()
      expect(within(nav).queryByRole('link', { name: /usuarios/i })).not.toBeInTheDocument()
    }
    expect(screen.getAllByText('Operador').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Cuenta de Mario Bejerano' }).length).toBeGreaterThan(0)
  })

  it('navega a Productos (catálogo vacío) y marca el enlace activo', async () => {
    loggedIn()
    const { router } = renderApp('/')
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })

    const nav = screen.getAllByRole('navigation', { name: 'Navegación principal' })[0]
    await userEvent.setup().click(within(nav).getByRole('link', { name: 'Productos' }))

    expect(await screen.findByText('Todavía no hay productos')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/products')
    expect(within(nav).getByRole('link', { name: 'Productos' })).toHaveAttribute('aria-current', 'page')
  })

  it('Inicio vacío ofrece ir a productos', async () => {
    loggedIn()
    const { router } = renderApp('/')
    await screen.findByText('Aquí verás el resumen del negocio. Mientras tanto, empieza por el catálogo de productos.')
    await userEvent.setup().click(screen.getByRole('link', { name: 'Ir a productos' }))
    await screen.findByText('Todavía no hay productos')
    expect(router.state.location.pathname).toBe('/products')
  })

  it('ADMIN: «Más» abre la hoja con nombre, rol, «Gestión › Categorías», idioma y cerrar sesión (HU-15 D-4)', async () => {
    loggedIn()
    renderApp('/')
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Más' }))

    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByText('Gestión')).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Categorías' })).toHaveAttribute('href', '/categories')
    expect(within(sheet).getByRole('heading', { name: 'Mario Bejerano' })).toBeInTheDocument()
    expect(within(sheet).getByText('Administrador')).toBeInTheDocument()
    expect(within(sheet).getByLabelText('Idioma')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('cambiar el idioma desde la cuenta traduce el panel (CA-22)', async () => {
    loggedIn()
    renderApp('/')
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: 'Más' }))
    await u.selectOptions(within(screen.getByRole('dialog')).getByLabelText('Idioma'), 'en')
    expect(await screen.findByRole('heading', { name: 'Hi, Mario Bejerano' })).toBeInTheDocument()
  })

  it('cerrar sesión: llama a /logout y vuelve al login sin ruta de retorno (CA-19)', async () => {
    const api = loggedIn().on('POST /api/v1/auth/logout', () => json(204))
    const { router } = renderApp('/products')
    await screen.findByText('Todavía no hay productos')
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: 'Más' }))
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }))

    await screen.findByRole('heading', { name: 'Inicia sesión' })
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('')
    expect(api.calls('POST /api/v1/auth/logout')[0].body).toEqual({ refreshToken: 'refresh-2' })
    expect(localStorage.getItem('cuartico.refreshToken')).toBeNull()
  })

  it('logout en otra pestaña: esta vuelve al login sin interacción (CA-20)', async () => {
    loggedIn()
    renderApp('/')
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })

    localStorage.removeItem('cuartico.refreshToken')
    window.dispatchEvent(new StorageEvent('storage', { key: 'cuartico.refreshToken', newValue: null }))

    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  it('una ruta desconocida muestra la página 404 con enlace al inicio (CA-26)', async () => {
    loggedIn()
    renderApp('/no-existe')
    expect(await screen.findByRole('heading', { name: 'Esta página no existe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })
})

describe('Navegación de Categorías (HU-15 CA-24, CA-25)', () => {
  it('ADMIN ve «Categorías» en la barra lateral; OPERATOR no, y su pestaña sigue siendo «Cuenta» sin «Gestión»', async () => {
    loggedIn('ADMIN')
    const first = renderApp('/')
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })
    const nav = screen.getAllByRole('navigation', { name: 'Navegación principal' })[0]
    expect(within(nav).getByRole('link', { name: 'Categorías' })).toHaveAttribute('href', '/categories')
    first.unmount()

    resetSessionForTests()
    loggedIn('OPERATOR')
    renderApp('/')
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })
    for (const n of screen.getAllByRole('navigation', { name: 'Navegación principal' })) {
      expect(within(n).queryByRole('link', { name: 'Categorías' })).not.toBeInTheDocument()
    }
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cuenta' }))
    expect(within(screen.getByRole('dialog')).queryByText('Gestión')).not.toBeInTheDocument()
  })

  it('OPERATOR que llega por URL: «No tienes acceso a esta página» + «Ir a productos», sin pedir categorías', async () => {
    const api = loggedIn('OPERATOR')
    renderApp('/categories')
    expect(await screen.findByRole('heading', { name: 'No tienes acceso a esta página' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a productos' })).toHaveAttribute('href', '/products')
    expect(api.calls('GET /api/v1/categories')).toHaveLength(0)
    expect(document.title).toBe('No tienes acceso a esta página') // título genérico, no el de la página protegida
  })
})

describe('Roles (HU-01 CA-25)', () => {
  it('hasRole', () => {
    expect(hasRole(user('ADMIN'), 'ADMIN')).toBe(true)
    expect(hasRole(user('OPERATOR'), 'ADMIN')).toBe(false)
    expect(hasRole(null, 'ADMIN')).toBe(false)
  })

  it('RequireRole oculta lo que el rol no permite', async () => {
    installFakeApi()
      .on('POST /api/v1/auth/login', () => json(200, tokenPair(1, 'OPERATOR')))
    await session.login('ana', 'x')
    const { rerender } = render(<RequireRole roles={['ADMIN']}>solo admin</RequireRole>)
    expect(screen.queryByText('solo admin')).not.toBeInTheDocument()

    installFakeApi().on('POST /api/v1/auth/login', () => json(200, tokenPair(1, 'ADMIN')))
    await session.login('mario', 'x')
    rerender(<RequireRole roles={['ADMIN']}>solo admin</RequireRole>)
    expect(await screen.findByText('solo admin')).toBeInTheDocument()
  })
})
