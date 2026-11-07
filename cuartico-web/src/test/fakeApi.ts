import { vi } from 'vitest'

/** Petición tal y como la vio el `fetch` falso. */
export interface SeenRequest {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
  mode?: RequestMode
}

type Reply = Response | Promise<Response>
type Handler = (req: SeenRequest, signal?: AbortSignal | null) => Reply

export const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  })

export const problem = (status: number, code: string, detail: string, extra: object = {}) =>
  json(status, { type: 'about:blank', title: 'Error', status, code, detail, ...extra })

export const networkError = (): Reply => Promise.reject(new TypeError('Failed to fetch'))

/** Una respuesta que no llega nunca (solo termina si se aborta la petición). */
export const never = (_req: SeenRequest, signal?: AbortSignal | null): Reply =>
  new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })

export const user = (role: 'ADMIN' | 'OPERATOR' = 'ADMIN') => ({
  id: 1,
  username: 'mario',
  fullName: 'Mario Bejerano',
  role,
  active: true,
  createdAt: '2026-11-01T10:00:00Z',
})

export const tokenPair = (n: number, role: 'ADMIN' | 'OPERATOR' = 'ADMIN') => ({
  accessToken: `access-${n}`,
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshToken: `refresh-${n}`,
  user: user(role),
})

/**
 * `fetch` falso: como un MockMvc al revés. Cada ruta (`'POST /api/v1/auth/login'`) tiene un manejador
 * o una cola de respuestas; guarda todas las peticiones para poder comprobarlas después.
 */
export function installFakeApi() {
  const handlers = new Map<string, Handler[]>()
  const requests: SeenRequest[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    const method = (init.method ?? 'GET').toUpperCase()
    const req: SeenRequest = {
      method,
      path: url.pathname,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      mode: init.mode,
    }
    requests.push(req)
    if (req.path === '/actuator/health') return new Response(null, { status: 200 })
    const queue = handlers.get(`${method} ${url.pathname}`)
    if (!queue || queue.length === 0) throw new Error(`Unexpected request ${method} ${url.pathname}`)
    const handler = queue.length > 1 ? queue.shift()! : queue[0]
    return handler(req, init.signal)
  })
  vi.stubGlobal('fetch', fetchMock)

  return {
    requests,
    /** Respuestas en orden: la última se repite para siempre. */
    on(route: string, ...replies: (Handler | (() => Reply))[]) {
      handlers.set(route, replies as Handler[])
      return this
    },
    calls: (route: string) => requests.filter((r) => `${r.method} ${r.path}` === route),
  }
}
