import type { Role, UserResponse } from '../api/types'

/**
 * ¿Tiene el usuario alguno de estos roles? (HU-01 CA-25). Solo sirve para ESCONDER cosas en la interfaz;
 * la seguridad real la impone el backend con `@PreAuthorize` (responde 403).
 */
export function hasRole(user: UserResponse | null | undefined, ...roles: Role[]): boolean {
  return !!user && roles.includes(user.role)
}
