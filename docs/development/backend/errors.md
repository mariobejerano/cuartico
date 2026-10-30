# Errores de la API
> Aplica a `develop`/staging. Producción (v0.1.0) aún no incluye los códigos ni la traducción; llegarán con la próxima release.

Responsable: Forja-Back. Todas las respuestas de error usan **ProblemDetail (RFC 9457)** con `Content-Type: application/problem+json`.

## Formato

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Usuario no encontrado: 999999",
  "code": "user.not_found"
}
```

- `code`: código **estable en inglés**. El frontend decide por este campo, nunca por `detail`.
- `detail`: texto traducido según la cabecera `Accept-Language`: `es` por defecto; `en` si se pide inglés; cualquier otro idioma responde en `es`.
  Si falta una traducción, `detail` muestra el propio código (nunca rompe la respuesta).
- `errors` (solo en validación, `validation.failed`): mapa `campo → mensaje traducido`. Se incluye el primer error de cada campo.
- `title`: el texto estándar del estado HTTP (en inglés, lo pone Spring).

Los errores de seguridad (401 y 403 que salen de los filtros) siguen el mismo formato: los escribe `SecurityErrorHandlers`
porque fuera de MVC no los captura el `GlobalExceptionHandler`.

## Códigos

Los textos son los de `backend/src/main/resources/messages_es.properties` (es) y `messages_en.properties` (en).

| Código | HTTP | es | en | Cuándo |
|---|---|---|---|---|
| `auth.invalid_credentials` | 401 | Usuario o contraseña incorrectos | Invalid username or password | Login con usuario inexistente, contraseña errónea o usuario desactivado (los tres responden igual). |
| `auth.refresh_invalid` | 401 | Refresh token inválido | Invalid refresh token | Refresh token desconocido o ya usado (reutilización). |
| `auth.refresh_expired` | 401 | Refresh token expirado | Refresh token expired | Refresh token caducado. |
| `auth.user_disabled` | 401 | Usuario desactivado | User is disabled | Refresh con un token vigente de un usuario desactivado. Caso raro: al desactivar se revocan sus sesiones, así que normalmente responde antes `auth.refresh_invalid`. En login se usa `auth.invalid_credentials`. |
| `auth.unauthorized` | 401 | Autenticación requerida o token inválido | Authentication required or invalid token | Sin token, token inválido o caducado. |
| `auth.forbidden` | 403 | No tienes permisos para realizar esta acción | You do not have permission to perform this action | Rol insuficiente para el endpoint. |
| `user.not_found` | 404 | Usuario no encontrado: {0} | User not found: {0} | `{0}` es el username o el id buscado. |
| `user.username_taken` | 409 | Ya existe un usuario con ese nombre: {0} | A user with that username already exists: {0} | Alta de un username existente. |
| `user.cannot_demote_self` | 400 | No puedes desactivarte ni quitarte el rol de administrador a ti mismo | You cannot deactivate yourself or remove your own administrator role | Un admin intenta desactivarse o quitarse el rol `ADMIN`. |
| `user.wrong_current_password` | 400 | La contraseña actual no es correcta | The current password is incorrect | Cambio de contraseña con una actual errónea. |
| `validation.failed` | 400 | Datos inválidos | Invalid data | Fallo de Bean Validation en un cuerpo de petición. Incluye `errors`. |
| `request.malformed` | 400 | La petición está mal formada | The request is malformed | JSON mal formado y otros 4xx sin código propio. |
| `request.unsupported_media_type` | 415 | Tipo de contenido no soportado | Unsupported media type | `Content-Type` que el endpoint no acepta (p. ej. `text/plain`). |
| `request.method_not_allowed` | 405 | Método HTTP no permitido para este recurso | HTTP method not allowed for this resource | Método no soportado en la ruta. Incluye la cabecera `Allow`. |
| `request.not_found` | 404 | Recurso no encontrado | Resource not found | Ruta inexistente dentro de MVC. |
| `request.not_acceptable` | 406 | Formato de respuesta no disponible | Response format not available | `Accept` que no se puede servir. |
| `internal.error` | 500 | Error interno del servidor | Internal server error | Excepción no controlada. Al cliente nunca se le envían detalles; la traza va al log. |

### Mensajes de Bean Validation

Las anotaciones usan `message = "{clave}"`; la clave se traduce en los mismos archivos.

| Clave | es | en |
|---|---|---|
| `jakarta.validation.constraints.NotBlank.message` | no puede estar vacío | must not be blank |
| `jakarta.validation.constraints.NotNull.message` | es obligatorio | is required |
| `jakarta.validation.constraints.Size.message` | el tamaño debe estar entre {min} y {max} | size must be between {min} and {max} |
| `user.username.pattern` | solo letras, números, punto, guion y guion bajo | only letters, digits, dot, hyphen and underscore are allowed |

## Cómo añadir un error nuevo

1. **Nombrar el código** como `<modulo>.<motivo>` en inglés y en snake_case (p. ej. `product.not_found`).
2. **Lanzarlo** desde el Service con `ApiException`: `throw ApiException.notFound("product.not_found", id);`
   (o `new ApiException(HttpStatus.X, code, args)` si no hay fábrica para ese estado). Los argumentos se referencian como `{0}`, `{1}`…
3. **Añadir la clave a los dos archivos**, `messages_es.properties` y `messages_en.properties`, con el mismo nombre de clave.
   Si el texto tiene argumentos, una comilla simple se escribe doble (`''`), porque pasa por `MessageFormat`.
   `MessageBundlesTests` falla si las claves no coinciden.
4. **Testear** el camino de error con MockMvc: comprobar `status`, `code` y `detail` en `es` y en `en`.
5. **Documentarlo** en la tabla de este archivo.

Los logs van siempre en inglés y no forman parte del texto de cara al usuario.

## Limitaciones conocidas

Pendientes en el [product backlog](../../scrum/product-backlog.md) (TT-02 a TT-05):

- `HandlerMethodValidationException` (validación de parámetros) responde `request.malformed` sin `errors`.
- 413 (payload demasiado grande) responde `request.malformed`; le falta un código propio.
- Los 401 lanzados como `ApiException.unauthorized` no llevan la cabecera `WWW-Authenticate`.
- Los errores que pasan por `/error` usan el formato por defecto de Spring Boot, no ProblemDetail.
