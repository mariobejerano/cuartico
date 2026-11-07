/**
 * Tipos de la API (contrato del backend, ver docs/development/backend/api.md).
 * Escritos a mano y en un único sitio hasta que generemos los tipos desde OpenAPI (`/v3/api-docs`).
 * Son el equivalente a los `record` de `dto/AuthDtos.java`.
 */

export type Role = 'ADMIN' | 'OPERATOR'

export interface UserResponse {
  id: number
  username: string
  fullName: string
  role: Role
  active: boolean
  createdAt: string
}

export interface TokenResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  refreshToken: string
  user: UserResponse
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RefreshRequest {
  refreshToken: string
}

/** ProblemDetail (RFC 9457) con las extensiones de Cuartico (`code`, `errors`). */
export interface ProblemDetail {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  errors?: Record<string, string>
}
