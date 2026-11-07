import { env } from '../config/env'
import { ApiError } from './errors'
import { netStatus } from './netStatus'
import type { ProblemDetail } from './types'

/** A los 5 s sin respuesta avisamos de que el servidor se está despertando (HU-01 CA-8). */
export const SLOW_AFTER_MS = 5_000
/** A los 90 s cortamos la petición (HU-01 CA-8/CA-9). */
export const TIMEOUT_MS = 90_000

/**
 * Lo que el cliente HTTP necesita saber del resto de la app, inyectado desde fuera
 * (como inyectar dependencias por constructor en Spring). Así `api/` no importa nada de React,
 * de i18next ni de la sesión, y no hay dependencias circulares.
 */
export interface ClientHooks {
  /** Idioma activo para `Accept-Language` (CA-23). */
  getLanguage: () => string
  /** Access token en memoria, o `null`. */
  getAccessToken: () => string | null
  /**
   * Renueva el access token tras un 401. Recibe el token con el que falló la petición
   * (para saber si otra petición ya lo renovó). Lanza `ApiError` `network` o `session_ended`.
   */
  renewAccessToken: (failedToken: string | null) => Promise<string>
}

let hooks: ClientHooks = {
  getLanguage: () => 'es',
  getAccessToken: () => null,
  renewAccessToken: () => Promise.reject(new ApiError('session_ended')),
}

export function configureClient(partial: Partial<ClientHooks>) {
  hooks = { ...hooks, ...partial }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** `false` en /auth/login, /auth/refresh y /auth/logout: ni token ni renovación ante 401 (CA-16). */
  auth?: boolean
  /** Para cancelar desde fuera (TanStack Query lo pasa al desmontar una pantalla). */
  signal?: AbortSignal
}

interface RawResponse {
  status: number
  ok: boolean
  data: unknown
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined // Cuerpo no JSON (p. ej. página HTML de un proxy): nunca se muestra crudo (CA-10).
  }
}

/** Una petición con aviso a los 5 s y corte a los 90 s. No sabe nada de renovar tokens. */
async function send(path: string, opts: RequestOptions, token: string | null): Promise<RawResponse> {
  const controller = new AbortController()
  let timedOut = false
  let unmarkSlow: (() => void) | undefined
  const slowTimer = setTimeout(() => (unmarkSlow = netStatus.markSlow()), SLOW_AFTER_MS)
  const cutTimer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)
  const onExternalAbort = () => controller.abort()
  opts.signal?.addEventListener('abort', onExternalAbort)

  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json',
    'Accept-Language': hooks.getLanguage(),
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(env.apiBaseUrl + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    })
    return { status: res.status, ok: res.ok, data: await readBody(res) }
  } catch (e) {
    if (opts.signal?.aborted && !timedOut) throw e // cancelación pedida por quien llama: no es un error de red
    throw new ApiError('network', { message: timedOut ? 'timeout' : 'network' })
  } finally {
    clearTimeout(slowTimer)
    clearTimeout(cutTimer)
    unmarkSlow?.()
    opts.signal?.removeEventListener('abort', onExternalAbort)
  }
}

function toError(res: RawResponse): ApiError {
  // 502/503/504: Render despertando o caído. Para el usuario es lo mismo que no tener conexión (CA-9).
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return new ApiError('network', { status: res.status, message: `http ${res.status}` })
  }
  const problem = res.data && typeof res.data === 'object' ? (res.data as ProblemDetail) : undefined
  return new ApiError('http', { status: res.status, problem, message: problem?.code ?? `http ${res.status}` })
}

/**
 * Hace una petición a la API y devuelve el cuerpo ya parseado.
 * Si una petición autenticada recibe 401, renueva el token **una vez** y la repite **una vez** (CA-12).
 * Si la repetición vuelve a dar 401, se lanza el error: nunca hay bucles.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth ?? true
  const token = auth ? hooks.getAccessToken() : null
  let res = await send(path, opts, token)

  if (res.status === 401 && auth) {
    const fresh = await hooks.renewAccessToken(token)
    res = await send(path, opts, fresh)
  }

  if (!res.ok) throw toError(res)
  return res.data as T
}
