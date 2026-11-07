import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { installFakeApi, json, networkError, problem, tokenPair } from '../../test/fakeApi'
import { renderApp } from '../../test/renderApp'

async function fillAndSubmit(username: string, password: string) {
  const u = userEvent.setup()
  if (username) await u.type(screen.getByLabelText('Usuario'), username)
  if (password) await u.type(screen.getByLabelText('Contraseña'), password)
  await u.click(screen.getByRole('button', { name: 'Entrar' }))
  return u
}

describe('Login (HU-01)', () => {
  it('despierta el servidor con /actuator/health en modo no-cors al cargar (CA-7)', async () => {
    const api = installFakeApi()
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })
    const health = api.requests.find((r) => r.path === '/actuator/health')
    expect(health?.mode).toBe('no-cors')
  })

  it('login correcto: entra al inicio y ve su nombre y rol (CA-1)', async () => {
    const api = installFakeApi().on('POST /api/v1/auth/login', () => json(200, tokenPair(1)))
    const { router } = renderApp('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })

    await fillAndSubmit('mario', 'secret')

    expect(await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getAllByText('Administrador').length).toBeGreaterThan(0)
    expect(api.calls('POST /api/v1/auth/login')[0].body).toEqual({ username: 'mario', password: 'secret' })
  })

  it('credenciales inválidas: mensaje de la API, contraseña vacía y usuario conservado (CA-2)', async () => {
    installFakeApi().on('POST /api/v1/auth/login', () =>
      problem(401, 'auth.invalid_credentials', 'Usuario o contraseña incorrectos'),
    )
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })

    await fillAndSubmit('mario', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos')
    expect(screen.getByLabelText('Usuario')).toHaveValue('mario')
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(screen.getByLabelText('Contraseña')).toHaveFocus()
  })

  it('campos vacíos: marca obligatorios y NO llama a la API (CA-3)', async () => {
    const api = installFakeApi()
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })

    await fillAndSubmit('', '')

    expect(await screen.findByText('Escribe tu usuario.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('aria-invalid', 'true')
    expect(api.calls('POST /api/v1/auth/login')).toHaveLength(0)
  })

  it('envío único: mientras carga el botón está deshabilitado y un doble clic hace una sola petición (CA-4)', async () => {
    let release: (r: Response) => void = () => {}
    const api = installFakeApi().on('POST /api/v1/auth/login', () => new Promise<Response>((r) => (release = r)))
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })

    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Usuario'), 'mario')
    await u.type(screen.getByLabelText('Contraseña'), 'secret')
    await u.dblClick(screen.getByRole('button', { name: 'Entrar' }))

    const busy = await screen.findByRole('button', { name: 'Entrando…' })
    expect(busy).toBeDisabled()
    expect(api.calls('POST /api/v1/auth/login')).toHaveLength(1)
    release(json(200, tokenPair(1)))
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })
  })

  it('con sesión válida, abrir /login lleva al inicio (CA-5)', async () => {
    localStorage.setItem('cuartico.refreshToken', 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', () => json(200, tokenPair(2)))
    const { router } = renderApp('/login')
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })
    expect(router.state.location.pathname).toBe('/')
  })

  it('sin sesión, una ruta protegida va al login y después vuelve a ella con su búsqueda (CA-6)', async () => {
    installFakeApi().on('POST /api/v1/auth/login', () => json(200, tokenPair(1)))
    const { router } = renderApp('/products?q=arroz')
    await screen.findByRole('heading', { name: 'Inicia sesión' })
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?redirect=%2Fproducts%3Fq%3Darroz')

    await fillAndSubmit('mario', 'secret')

    await screen.findByText('Esta sección llegará pronto.')
    expect(router.state.location.pathname).toBe('/products')
    expect(router.state.location.search).toBe('?q=arroz')
  })

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)'])(
    'una ruta de retorno externa (%s) se ignora y va al inicio (CA-6)',
    async (redirect) => {
      installFakeApi().on('POST /api/v1/auth/login', () => json(200, tokenPair(1)))
      const { router } = renderApp(`/login?redirect=${encodeURIComponent(redirect)}`)
      await screen.findByRole('heading', { name: 'Inicia sesión' })
      await fillAndSubmit('mario', 'secret')
      await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })
      expect(router.state.location.pathname).toBe('/')
    },
  )

  it('sin conexión: error traducido con «Reintentar» y el usuario escrito se conserva (CA-9)', async () => {
    const api = installFakeApi().on('POST /api/v1/auth/login', networkError, () => json(200, tokenPair(1)))
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })

    const u = await fillAndSubmit('mario', 'secret')

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor')
    expect(screen.getByLabelText('Usuario')).toHaveValue('mario')

    await u.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })
    expect(api.calls('POST /api/v1/auth/login')).toHaveLength(2)
  })

  it('5xx con ProblemDetail muestra su detail; sin cuerpo, un texto genérico (CA-10)', async () => {
    installFakeApi().on(
      'POST /api/v1/auth/login',
      () => problem(500, 'internal.error', 'Error interno del servidor'),
      () => new Response('{not json', { status: 500 }),
    )
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })

    const u = await fillAndSubmit('mario', 'secret')
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor')

    await u.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal en el servidor. Inténtalo de nuevo en unos minutos.'),
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('{')
  })

  it('al recargar con refresh guardado se ve «Comprobando tu sesión…» y luego entra (CA-11)', async () => {
    localStorage.setItem('cuartico.refreshToken', 'refresh-1')
    let release: (r: Response) => void = () => {}
    installFakeApi().on('POST /api/v1/auth/refresh', () => new Promise<Response>((r) => (release = r)))
    renderApp('/')

    expect(await screen.findByText('Comprobando tu sesión…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Inicia sesión' })).not.toBeInTheDocument()
    release(json(200, tokenPair(2)))
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })
  })

  it('si el refresh guardado ya no vale, va al login con «Tu sesión ha terminado» (CA-15)', async () => {
    localStorage.setItem('cuartico.refreshToken', 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', () => problem(401, 'auth.refresh_expired', 'x'))
    renderApp('/products')
    expect(await screen.findByText('Tu sesión ha terminado, vuelve a iniciar sesión.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  it('si al arrancar no hay conexión, conserva la sesión y ofrece «Reintentar» (CA-9)', async () => {
    localStorage.setItem('cuartico.refreshToken', 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', networkError, networkError, () => json(200, tokenPair(2)))
    renderApp('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor')
    expect(localStorage.getItem('cuartico.refreshToken')).toBe('refresh-1')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('heading', { name: 'Hola, Mario Bejerano' })
  })

  it('cambiar el idioma traduce todo sin recargar y se recuerda (CA-22)', async () => {
    installFakeApi()
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })

    await userEvent.setup().click(screen.getByRole('button', { name: 'English' }))

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('cuartico.lang')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Cuartico · Log in')
  })

  it('mostrar y ocultar la contraseña', async () => {
    installFakeApi()
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text')
    await u.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })
})
