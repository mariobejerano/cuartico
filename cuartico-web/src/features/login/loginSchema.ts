import { z } from 'zod'

/**
 * Reglas del formulario de login, con Zod. Es el equivalente a un DTO con `@NotBlank` de Bean Validation.
 * Los mensajes son CLAVES de traducción, no textos: el componente los traduce al pintarlos.
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'login.username_required'),
  password: z.string().min(1, 'login.password_required'),
})

/** El tipo TypeScript se DEDUCE del esquema: una sola fuente de verdad. */
export type LoginForm = z.infer<typeof loginSchema>
