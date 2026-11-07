import { env } from '../config/env'
import { request } from './client'
import type { LoginRequest, TokenResponse, UserResponse } from './types'

/**
 * Endpoints de autenticación. Es el equivalente a un cliente Feign: solo sabe hablar con la API.
 * Ninguno lleva token ni dispara renovación (`auth: false`, CA-16), salvo `/me`.
 */
export const authApi = {
  login: (body: LoginRequest) =>
    request<TokenResponse>('/api/v1/auth/login', { method: 'POST', body, auth: false }),
  refresh: (refreshToken: string) =>
    request<TokenResponse>('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false }),
  logout: (refreshToken: string) =>
    request<void>('/api/v1/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
  me: (signal?: AbortSignal) => request<UserResponse>('/api/v1/auth/me', { signal }),
}

/**
 * Despierta el backend de Render en cuanto se abre el login (HU-01 CA-7).
 * `no-cors`: esa ruta no tiene CORS y no nos interesa la respuesta, solo que el servidor arranque.
 */
export function wakeServer() {
  fetch(`${env.apiBaseUrl}/actuator/health`, { mode: 'no-cors' }).catch(() => {
    /* da igual: es solo un despertador */
  })
}
