# API REST

Base: `/api/v1`. Estado: **endpoints de `develop`**. La versión de producción (v0.1.0) todavía sirve las rutas sin versión
(`/api/auth/...`, `/api/users/...`); `/api/v1` llega con la próxima release (ver [sprint 0](../../scrum/sprints/00.md)).

Todos los endpoints requieren `Authorization: Bearer <accessToken>`, salvo los marcados como público.
Los errores siguen el formato de [errors.md](errors.md). Las peticiones de ejemplo están en `backend/requests.http`.

## Endpoints

| Método | Ruta | Acceso | Código OK | Descripción |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | público | 200 | Valida usuario y contraseña. Devuelve `accessToken`, `refreshToken`, `tokenType` (`Bearer`), `expiresIn` (segundos) y `user`. |
| POST | `/api/v1/auth/refresh` | público (refresh token en el cuerpo) | 200 | Rota el refresh token: revoca el usado y devuelve un par de tokens nuevo. Reutilizar un token revocado cierra todas las sesiones del usuario. |
| POST | `/api/v1/auth/logout` | público (refresh token en el cuerpo) | 204 | Revoca el refresh token indicado. |
| GET | `/api/v1/auth/me` | autenticado (cualquier rol) | 200 | Datos del usuario del access token. |
| POST | `/api/v1/auth/change-password` | autenticado (cualquier rol) | 204 | Cambia la contraseña propia (exige la actual) y cierra todas sus sesiones. |
| GET | `/api/v1/users` | `ADMIN` | 200 | Lista los usuarios, ordenados por `username`. |
| POST | `/api/v1/users` | `ADMIN` | 201 | Crea un usuario. |
| GET | `/api/v1/users/{id}` | `ADMIN` | 200 | Detalle de un usuario. |
| PUT | `/api/v1/users/{id}` | `ADMIN` | 200 | Cambia nombre completo, rol y estado (`active`). Desactivar un usuario cierra sus sesiones. Un admin no puede desactivarse ni quitarse el rol `ADMIN`. |
| POST | `/api/v1/users/{id}/reset-password` | `ADMIN` | 204 | Restablece la contraseña de otro usuario y cierra sus sesiones. |
| GET | `/actuator/health` | público | 200 | Estado de la aplicación. Lo usa Render como health check. |
| GET | `/actuator/info` | autenticado | 200 | Información de la aplicación. |
| GET | `/v3/api-docs`, `/swagger-ui.html` | público solo si springdoc está activo | 200 | OpenAPI JSON y Swagger UI. Activos en `dev`/`test` y en staging (`SPRINGDOC_ENABLED=true`). En producción: anónimo → 401; autenticado → 404. |

Consola H2 (`/h2-console`): solo perfil `dev`, no forma parte de la API.

## Cuerpos de petición

| DTO | Campos | Reglas |
|---|---|---|
| `LoginRequest` | `username`, `password` | Obligatorios. |
| `RefreshRequest` | `refreshToken` | Obligatorio. Se usa en `/refresh` y en `/logout`. |
| `ChangePasswordRequest` | `currentPassword`, `newPassword` | Obligatorios. `newPassword` de 8 a 72 caracteres. |
| `CreateUserRequest` | `username`, `password`, `fullName`, `role` | `username`: 3–50 caracteres, solo letras, números, `.`, `-` y `_`, único. `password`: 8–72. `fullName`: hasta 100. `role`: `ADMIN` u `OPERATOR`. |
| `UpdateUserRequest` | `fullName`, `role`, `active` | `fullName` obligatorio, hasta 100. `role` obligatorio. `active` obligatorio (`true`/`false`); si se omite o es `null` responde 400 `validation.failed` con `errors.active` y no se modifica nada (corregido TT-11: antes se omitía como `false` y desactivaba al usuario). |
| `ResetPasswordRequest` | `newPassword` | Obligatorio, 8–72. |

## Cuerpos de respuesta

- `TokenResponse` (login y refresh): `accessToken`, `tokenType`, `expiresIn`, `refreshToken`, `user`.
- `UserResponse` (usuarios y `/me`): `id`, `username`, `fullName`, `role`, `active`, `createdAt`. Nunca incluye la contraseña.

## Cómo crear un usuario

1. Hacer login con un usuario `ADMIN` (`POST /api/v1/auth/login`) y copiar `accessToken`.
2. Llamar a `POST /api/v1/users` con la cabecera `Authorization: Bearer <accessToken>` y un cuerpo como:
   `{"username": "ana.perez", "password": "<mínimo 8 caracteres>", "fullName": "Ana Pérez", "role": "OPERATOR"}`.
3. La respuesta es `201` con el `UserResponse`. El usuario puede entrar ya con esa contraseña.

En Swagger UI (staging o local) el paso 2 se hace con el botón «Authorize» tras el login.
El primer administrador se crea solo al arrancar con la base vacía (ver [backend](README.md#base-de-datos-y-flyway)).
