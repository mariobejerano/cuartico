import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokens } from '../auth/tokens'
import i18n from '../i18n'
import { installFakeApi, json, never, networkError, problem, tokenPair } from '../test/fakeApi'
import { request, SLOW_AFTER_MS, TIMEOUT_MS } from './client'
import { ApiError } from './errors'
import { netStatus } from './netStatus'

afterEach(() => {
  vi.useRealTimers()
})

async function catchError(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    return e as ApiError
  }
  throw new Error('expected an error')
}

describe('api client', () => {
  it('envía Accept-Language con el idioma activo y el token en Authorization (CA-23)', async () => {
    const api = installFakeApi().on('GET /api/v1/auth/me', () => json(200, { id: 1 }))
    tokens.setAccess('access-1')
    await i18n.changeLanguage('en')

    await request('/api/v1/auth/me')

    expect(api.requests[0].headers['Accept-Language']).toBe('en')
    expect(api.requests[0].headers.Authorization).toBe('Bearer access-1')
  })

  it('convierte un ProblemDetail en ApiError con code, detail y errors', async () => {
    installFakeApi().on('POST /x', () =>
      problem(400, 'validation.failed', 'Datos inválidos', { errors: { name: 'no puede estar vacío' } }),
    )
    const e = await catchError(request('/x', { method: 'POST', body: {} }))
    expect(e).toMatchObject({ kind: 'http', status: 400, code: 'validation.failed', detail: 'Datos inválidos' })
    expect(e.errors).toEqual({ name: 'no puede estar vacío' })
  })

  it.each([502, 503, 504])('trata %i como error de conexión (CA-9)', async (status) => {
    installFakeApi().on('GET /x', () => new Response('<html>Bad gateway</html>', { status }))
    expect((await catchError(request('/x'))).kind).toBe('network')
  })

  it('un fallo de red es un error de conexión, sin datos sensibles en el mensaje (CA-18)', async () => {
    installFakeApi().on('GET /x', networkError)
    tokens.setAccess('secret-access')
    const e = await catchError(request('/x'))
    expect(e.kind).toBe('network')
    expect(e.message).not.toContain('secret-access')
  })

  it('avisa de servidor despertando a los 5 s y corta a los 90 s (CA-8)', async () => {
    vi.useFakeTimers()
    installFakeApi().on('GET /x', never)
    const p = catchError(request('/x'))

    await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS - 1)
    expect(netStatus.isWaking()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(netStatus.isWaking()).toBe(true)

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - SLOW_AFTER_MS)
    const e = await p
    expect(e).toMatchObject({ kind: 'network', message: 'timeout' })
    expect(netStatus.isWaking()).toBe(false)
  })

  it('ante un 401 renueva una vez y repite la petición una vez (CA-12)', async () => {
    localStorage.setItem('cuartico.refreshToken', 'refresh-1')
    tokens.setAccess('access-old')
    const api = installFakeApi()
      .on('GET /api/v1/auth/me', () => problem(401, 'auth.unauthorized', 'x'), () => json(200, { ok: true }))
      .on('POST /api/v1/auth/refresh', () => json(200, tokenPair(2)))

    await expect(request('/api/v1/auth/me')).resolves.toEqual({ ok: true })

    const me = api.calls('GET /api/v1/auth/me')
    expect(me).toHaveLength(2)
    expect(me[1].headers.Authorization).toBe('Bearer access-2')
    expect(api.calls('POST /api/v1/auth/refresh')[0].body).toEqual({ refreshToken: 'refresh-1' })
  })

  it('si la repetición vuelve a dar 401, no hay bucle', async () => {
    localStorage.setItem('cuartico.refreshToken', 'refresh-1')
    tokens.setAccess('access-old')
    const api = installFakeApi()
      .on('GET /x', () => problem(401, 'auth.unauthorized', 'x'))
      .on('POST /api/v1/auth/refresh', () => json(200, tokenPair(2)))

    expect((await catchError(request('/x'))).status).toBe(401)
    expect(api.calls('GET /x')).toHaveLength(2)
    expect(api.calls('POST /api/v1/auth/refresh')).toHaveLength(1)
  })

  it.each(['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout'])(
    'un 401 de %s nunca dispara una renovación (CA-16)',
    async (path) => {
      localStorage.setItem('cuartico.refreshToken', 'refresh-1')
      const api = installFakeApi().on(`POST ${path}`, () => problem(401, 'auth.refresh_invalid', 'x'))
      await catchError(request(path, { method: 'POST', body: {}, auth: false }))
      expect(api.requests.filter((r) => r.path === '/api/v1/auth/refresh')).toHaveLength(
        path.endsWith('refresh') ? 1 : 0,
      )
    },
  )

  it('un 403 no intenta renovar (CA-17)', async () => {
    tokens.setAccess('access-1')
    const api = installFakeApi().on('GET /x', () => problem(403, 'auth.forbidden', 'No tienes permisos'))
    const e = await catchError(request('/x'))
    expect(e).toMatchObject({ kind: 'http', status: 403, detail: 'No tienes permisos' })
    expect(api.requests).toHaveLength(1)
  })
})
