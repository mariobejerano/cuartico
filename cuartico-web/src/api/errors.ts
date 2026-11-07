import type { ProblemDetail } from './types'

/**
 * Qué tipo de fallo es:
 * - `http`: el servidor respondió con un error (4xx/5xx) que no es de red.
 * - `network`: no hubo respuesta útil: sin conexión, CORS, DNS, corte de 90 s o 502/503/504 (HU-01 CA-9).
 * - `session_ended`: la renovación del token fue rechazada (401 de /auth/refresh, CA-15).
 */
export type ApiErrorKind = 'http' | 'network' | 'session_ended'

/**
 * Error tipado de la API. Como una excepción de dominio en Java: quien la captura decide por `kind` y `code`,
 * nunca por el texto. `detail` ya viene traducido por el backend (según `Accept-Language`).
 * Nunca contiene tokens (CA-18).
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly detail?: string
  readonly errors?: Record<string, string>

  constructor(kind: ApiErrorKind, init: { status?: number; problem?: ProblemDetail; message?: string } = {}) {
    super(init.message ?? init.problem?.code ?? kind)
    this.name = 'ApiError'
    this.kind = kind
    this.status = init.status
    this.code = init.problem?.code
    this.detail = init.problem?.detail
    this.errors = init.problem?.errors
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError
