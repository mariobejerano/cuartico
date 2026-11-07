import { authApi } from '../api/auth'
import { ApiError, isApiError } from '../api/errors'
import type { TokenResponse, UserResponse } from '../api/types'
import { withRefreshLock } from './lock'
import { REFRESH_KEY, tokens } from './tokens'

/**
 * Estado de la sesión. Es TypeScript puro (sin React): la UI lo observa, pero la lógica vive aquí,
 * igual que en Spring la lógica vive en el Service y no en el Controller. Así se reutiliza en React Native.
 *
 * - `loading`: comprobando la sesión guardada al arrancar (CA-11).
 * - `unreachable`: no pudimos comprobarla por red/servidor; el refresh se conserva (CA-9).
 * - `authenticated`: dentro, con el usuario.
 * - `anonymous`: fuera. `reason` explica por qué: `ended` (renovación rechazada, CA-15) o `logout`.
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'unreachable'; error: ApiError }
  | { status: 'authenticated'; user: UserResponse }
  | { status: 'anonymous'; reason?: 'logout' | 'ended' }

type Listener = () => void

let state: SessionState = { status: 'loading' }
const listeners = new Set<Listener>()

function setState(next: SessionState) {
  state = next
  listeners.forEach((l) => l())
}

const toApiError = (e: unknown) => (isApiError(e) ? e : new ApiError('network', { message: 'unexpected' }))

type RefreshOutcome =
  | { type: 'ok'; user: UserResponse }
  | { type: 'no_token' }
  | { type: 'rejected' }
  | { type: 'error'; error: ApiError }

/** Llama a /auth/refresh y, si falla por red, reintenta UNA vez enseguida (CA-9: llegar dentro de la gracia de 120 s). */
async function refreshWithOneRetry(refreshToken: string): Promise<TokenResponse> {
  try {
    return await authApi.refresh(refreshToken)
  } catch (e) {
    if (isApiError(e) && e.kind === 'network') return authApi.refresh(refreshToken)
    throw e
  }
}

/**
 * Toda lectura y escritura del refresh token pasa por aquí, DENTRO del bloqueo `cuartico-refresh` (CA-14).
 * El refresh se lee de `localStorage` dentro del bloqueo, nunca de una copia en memoria.
 */
function refreshLocked(): Promise<RefreshOutcome> {
  return withRefreshLock(async (): Promise<RefreshOutcome> => {
    const refreshToken = tokens.getRefresh()
    if (!refreshToken) {
      tokens.setAccess(null)
      return { type: 'no_token' } // otra pestaña cerró sesión mientras esperábamos (CA-14c)
    }
    try {
      const res = await refreshWithOneRetry(refreshToken)
      tokens.setRefresh(res.refreshToken)
      tokens.setAccess(res.accessToken)
      return { type: 'ok', user: res.user }
    } catch (e) {
      const error = toApiError(e)
      // SOLO un 401 de /auth/refresh borra la sesión (CA-15). Red, 90 s o 5xx la conservan (CA-9).
      if (error.kind === 'http' && error.status === 401) {
        tokens.clear()
        return { type: 'rejected' }
      }
      return { type: 'error', error }
    }
  })
}

let inflightRenewal: Promise<string> | null = null
let bootPromise: Promise<void> | null = null

export const session = {
  getState: (): SessionState => state,

  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  /** Arranque: si hay refresh guardado, lo canjea por un access token y el usuario (CA-11). */
  async bootstrap(): Promise<void> {
    if (!tokens.getRefresh()) {
      setState({ status: 'anonymous' })
      return
    }
    setState({ status: 'loading' })
    const out = await refreshLocked()
    if (out.type === 'ok') setState({ status: 'authenticated', user: out.user })
    else if (out.type === 'no_token') setState({ status: 'anonymous' })
    else if (out.type === 'rejected') setState({ status: 'anonymous', reason: 'ended' })
    else setState({ status: 'unreachable', error: out.error })
  },

  /**
   * Como `bootstrap`, pero solo la primera vez. En desarrollo, React (StrictMode) monta los efectos
   * dos veces a propósito para destapar errores; así no se hace un /auth/refresh de más.
   */
  bootstrapOnce(): Promise<void> {
    bootPromise ??= session.bootstrap()
    return bootPromise
  },

  async login(username: string, password: string): Promise<UserResponse> {
    const res = await authApi.login({ username, password })
    tokens.setRefresh(res.refreshToken)
    tokens.setAccess(res.accessToken)
    setState({ status: 'authenticated', user: res.user })
    return res.user
  },

  /**
   * Renovación ante un 401 (CA-12, CA-13). *Single-flight*: si ya hay una en curso en esta pestaña,
   * todas las peticiones esperan a la misma. Devuelve el access token nuevo o lanza `ApiError`.
   */
  renewAccessToken(failedToken: string | null): Promise<string> {
    if (inflightRenewal) return inflightRenewal
    const current = tokens.getAccess()
    if (current && current !== failedToken) return Promise.resolve(current) // otra petición ya renovó

    inflightRenewal = (async () => {
      const out = await refreshLocked()
      switch (out.type) {
        case 'ok':
          setState({ status: 'authenticated', user: out.user })
          return tokens.getAccess() as string
        case 'no_token':
          setState({ status: 'anonymous', reason: 'logout' })
          throw new ApiError('session_ended')
        case 'rejected':
          setState({ status: 'anonymous', reason: 'ended' })
          throw new ApiError('session_ended')
        case 'error':
          throw out.error // la sesión sigue; la pantalla mostrará «Reintentar»
      }
    })().finally(() => {
      inflightRenewal = null
    })
    return inflightRenewal
  },

  /**
   * Cierre de sesión (CA-19, CA-20): dentro del bloqueo se lee el refresh, se borra de `localStorage` y de memoria,
   * y se avisa al backend. Si el backend no responde, la sesión local queda borrada igual (no se reintenta).
   */
  logout(): Promise<void> {
    return withRefreshLock(async () => {
      const refreshToken = tokens.getRefresh()
      tokens.clear()
      setState({ status: 'anonymous', reason: 'logout' })
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => undefined)
      }
    })
  },

  /**
   * Si otra pestaña borra el refresh (logout), esta pasa a anónima al instante (CA-20).
   * Devuelve la función para dejar de escuchar.
   */
  listenToOtherTabs(): () => void {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== REFRESH_KEY && e.key !== null) return
      if (tokens.getRefresh()) return // rotación normal en otra pestaña: nada que hacer
      tokens.setAccess(null)
      if (state.status !== 'anonymous') setState({ status: 'anonymous', reason: 'logout' })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  },
}

/** Solo para tests: vuelve al estado inicial. */
export function resetSessionForTests() {
  inflightRenewal = null
  bootPromise = null
  tokens.clear()
  state = { status: 'loading' }
  listeners.clear()
}
