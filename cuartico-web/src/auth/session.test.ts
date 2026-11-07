import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from '../api/client'
import { installFakeApi, json, networkError, problem, tokenPair } from '../test/fakeApi'
import { REFRESH_LOCK } from './lock'
import { session } from './session'
import { REFRESH_KEY, tokens } from './tokens'

/**
 * `navigator.locks` falso. `beforeTask` simula lo que hace OTRA pestaña mientras esta espera el bloqueo.
 */
function installFakeLocks(beforeTask?: () => void) {
  const names: string[] = []
  let tail: Promise<unknown> = Promise.resolve()
  const locks = {
    request: vi.fn((name: string, task: () => Promise<unknown>) => {
      names.push(name)
      const run = tail.then(() => {
        beforeTask?.()
        return task()
      })
      tail = run.catch(() => undefined)
      return run
    }),
  }
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true })
  return { names, locks }
}

beforeEach(() => {
  installFakeLocks()
})

afterEach(() => {
  // @ts-expect-error -- quitamos el falso para que otros tests usen la alternativa en memoria
  delete navigator.locks
})

describe('session: arranque (CA-11)', () => {
  it('sin refresh guardado queda anónima sin llamar a la API', async () => {
    const api = installFakeApi()
    await session.bootstrap()
    expect(session.getState()).toEqual({ status: 'anonymous' })
    expect(api.requests).toHaveLength(0)
  })

  it('con refresh guardado obtiene access y usuario, dentro del bloqueo', async () => {
    const { names } = installFakeLocks()
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', () => json(200, tokenPair(2)))

    await session.bootstrap()

    expect(session.getState()).toMatchObject({ status: 'authenticated', user: { fullName: 'Mario Bejerano' } })
    expect(tokens.getAccess()).toBe('access-2')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-2')
    expect(names).toEqual([REFRESH_LOCK])
  })

  it('el access token nunca se guarda en localStorage (CA-18)', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', () => json(200, tokenPair(2)))
    await session.bootstrap()
    expect(JSON.stringify({ ...localStorage })).not.toContain('access-2')
  })

  it('un 401 de /refresh borra la sesión y avisa de sesión terminada (CA-15)', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', () => problem(401, 'auth.refresh_expired', 'x'))
    await session.bootstrap()
    expect(session.getState()).toEqual({ status: 'anonymous', reason: 'ended' })
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull()
  })

  it('un fallo de red reintenta UNA vez y, si sigue, conserva el refresh (CA-9)', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    const api = installFakeApi().on('POST /api/v1/auth/refresh', networkError)
    await session.bootstrap()
    expect(api.calls('POST /api/v1/auth/refresh')).toHaveLength(2)
    expect(session.getState().status).toBe('unreachable')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-1')
  })

  it('un 5xx tampoco borra la sesión (CA-15)', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', () => problem(500, 'internal.error', 'Error interno'))
    await session.bootstrap()
    expect(session.getState().status).toBe('unreachable')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-1')
  })

  it('el reintento automático tras un corte de red puede salir bien', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', networkError, () => json(200, tokenPair(2)))
    await session.bootstrap()
    expect(session.getState().status).toBe('authenticated')
  })
})

describe('session: renovación ante 401', () => {
  it('varias peticiones con 401 a la vez hacen UN único refresh y todas se repiten (CA-13)', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    tokens.setAccess('access-old')
    const api = installFakeApi()
      .on('GET /x', (req) =>
        req.headers.Authorization === 'Bearer access-2' ? json(200, { ok: 1 }) : problem(401, 'auth.unauthorized', 'x'),
      )
      .on('POST /api/v1/auth/refresh', () => json(200, tokenPair(2)))

    const results = await Promise.all([request('/x'), request('/x'), request('/x')])

    expect(results).toEqual([{ ok: 1 }, { ok: 1 }, { ok: 1 }])
    expect(api.calls('POST /api/v1/auth/refresh')).toHaveLength(1)
  })

  it('lee el refresh de localStorage DENTRO del bloqueo: usa el que rotó otra pestaña (CA-14a)', async () => {
    installFakeLocks(() => localStorage.setItem(REFRESH_KEY, 'refresh-from-other-tab'))
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    tokens.setAccess('access-old')
    const api = installFakeApi()
      .on('GET /x', () => problem(401, 'auth.unauthorized', 'x'), () => json(200, {}))
      .on('POST /api/v1/auth/refresh', () => json(200, tokenPair(3)))

    await request('/x')

    expect(api.calls('POST /api/v1/auth/refresh')[0].body).toEqual({ refreshToken: 'refresh-from-other-tab' })
  })

  it('si otra pestaña cerró sesión mientras esperaba, pasa a anónima SIN llamar a /refresh (CA-14c)', async () => {
    installFakeLocks(() => localStorage.removeItem(REFRESH_KEY))
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    tokens.setAccess('access-old')
    const api = installFakeApi().on('GET /x', () => problem(401, 'auth.unauthorized', 'x'))

    await expect(request('/x')).rejects.toMatchObject({ kind: 'session_ended' })
    expect(api.calls('POST /api/v1/auth/refresh')).toHaveLength(0)
    expect(session.getState()).toEqual({ status: 'anonymous', reason: 'logout' })
  })

  it('renovación rechazada (401): sesión terminada y la petición falla sin bucle (CA-15)', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    tokens.setAccess('access-old')
    const api = installFakeApi()
      .on('GET /x', () => problem(401, 'auth.unauthorized', 'x'))
      .on('POST /api/v1/auth/refresh', () => problem(401, 'auth.refresh_invalid', 'x'))

    await expect(request('/x')).rejects.toMatchObject({ kind: 'session_ended' })
    expect(session.getState()).toEqual({ status: 'anonymous', reason: 'ended' })
    expect(api.calls('POST /api/v1/auth/refresh')).toHaveLength(1)
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull()
  })

  it('renovación sin red: la petición falla con error de conexión y la sesión sigue (CA-9)', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    tokens.setAccess('access-old')
    installFakeApi().on('GET /x', () => problem(401, 'auth.unauthorized', 'x')).on('POST /api/v1/auth/refresh', networkError)

    await expect(request('/x')).rejects.toMatchObject({ kind: 'network' })
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-1')
  })
})

describe('session: login y logout', () => {
  it('login guarda el refresh en localStorage y el access en memoria', async () => {
    installFakeApi().on('POST /api/v1/auth/login', () => json(200, tokenPair(1)))
    await session.login('mario', 'secret')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-1')
    expect(tokens.getAccess()).toBe('access-1')
    expect(session.getState().status).toBe('authenticated')
  })

  it('logout borra la sesión y llama a /logout con el refresh, dentro del bloqueo (CA-19)', async () => {
    const { names } = installFakeLocks()
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    tokens.setAccess('access-1')
    const api = installFakeApi().on('POST /api/v1/auth/logout', () => json(204))

    await session.logout()

    expect(names).toEqual([REFRESH_LOCK])
    expect(api.calls('POST /api/v1/auth/logout')[0].body).toEqual({ refreshToken: 'refresh-1' })
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull()
    expect(tokens.getAccess()).toBeNull()
    expect(session.getState()).toEqual({ status: 'anonymous', reason: 'logout' })
  })

  it('si /logout falla, la sesión local se borra igual y no se reintenta (CA-19)', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    const api = installFakeApi().on('POST /api/v1/auth/logout', networkError)
    await session.logout()
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull()
    expect(api.calls('POST /api/v1/auth/logout')).toHaveLength(1)
  })

  it('dos logouts a la vez: solo uno llama a /logout (CA-20)', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    const api = installFakeApi().on('POST /api/v1/auth/logout', () => json(204))
    await Promise.all([session.logout(), session.logout()])
    expect(api.calls('POST /api/v1/auth/logout')).toHaveLength(1)
  })

  it('el logout en otra pestaña (evento storage) deja esta anónima al instante (CA-20)', async () => {
    installFakeApi().on('POST /api/v1/auth/login', () => json(200, tokenPair(1)))
    await session.login('mario', 'secret')
    const stop = session.listenToOtherTabs()

    localStorage.removeItem(REFRESH_KEY) // lo que vería esta pestaña tras el logout de la otra
    window.dispatchEvent(new StorageEvent('storage', { key: REFRESH_KEY, newValue: null }))

    expect(session.getState()).toEqual({ status: 'anonymous', reason: 'logout' })
    expect(tokens.getAccess()).toBeNull()
    stop()
  })

  it('una rotación en otra pestaña (evento storage con valor) no cierra la sesión', async () => {
    installFakeApi().on('POST /api/v1/auth/login', () => json(200, tokenPair(1)))
    await session.login('mario', 'secret')
    const stop = session.listenToOtherTabs()

    localStorage.setItem(REFRESH_KEY, 'refresh-9')
    window.dispatchEvent(new StorageEvent('storage', { key: REFRESH_KEY, newValue: 'refresh-9' }))

    expect(session.getState().status).toBe('authenticated')
    stop()
  })
})
