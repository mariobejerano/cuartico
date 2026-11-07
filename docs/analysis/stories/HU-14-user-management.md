# HU-14: Gestión de usuarios

- **Sprint:** sin asignar (fuera del sprint 1) · **Estado:** ficha breve; se detalla al planificarla
- **Alcance:** frontend `cuartico-web`. El backend ya existe (ver [API](../../development/backend/api.md)).
- **Depende de:** HU-01 (sesión, layout, guardas por rol), TT-11 (`UpdateUserRequest.active` obligatorio).
- **Origen:** separada de [HU-01](HU-01-panel-access.md) por decisión de la supervisión (2026-10-30).

## Historia
**Como** administrador, **quiero** gestionar los usuarios del panel desde la interfaz,
**para** dar de alta operadores, cambiar roles y retirar accesos sin usar Swagger.
**Como** cualquier usuario, **quiero** cambiar mi contraseña, **para** mantener mi cuenta segura.

## Criterios de aceptación (borrador)
- **CA-1 Menú y ruta.** La entrada «Usuarios» solo la ve un `ADMIN` (en móvil, dentro de «Cuenta», que pasará a «Más»
  según el design system). Un `OPERATOR` que escribe `/users` en la URL ve
  «No tienes permisos» sin llamar a la API (la seguridad real es el 403 del backend).
- **CA-2 Listado.** Un `ADMIN` ve los usuarios (usuario, nombre, rol, activo, fecha de alta), ordenados por usuario.
- **CA-3 Crear.** Con usuario, nombre completo, rol y contraseña inicial. Errores junto al campo: `errors` de validación y
  `user.username_taken` en el campo usuario.
- **CA-4 Editar.** Nombre, rol y activo; el formulario **siempre envía `active`** (TT-11). En su propia fila, la UI
  deshabilita desactivarse o quitarse `ADMIN`; si aun así llega, se muestra `user.cannot_demote_self`.
- **CA-5 Desactivar.** Pide confirmación e informa de que se cerrarán sus sesiones. El usuario desactivado puede seguir
  usando su access token hasta 15 min (JWT sin estado); aceptado.
- **CA-6 Restablecer contraseña.** De otro usuario, con confirmación; se informa de que sus sesiones se cerrarán.
- **CA-7 Cambiar mi contraseña** (cualquier rol). Actual + nueva + repetir (8–72). Actual incorrecta →
  `user.wrong_current_password`. Si va bien, el backend cierra todas sus sesiones: se borra la sesión local y se va al login
  con «Contraseña cambiada, inicia sesión de nuevo».

## Endpoints
`GET|POST /api/v1/users`, `GET|PUT /api/v1/users/{id}`, `POST /api/v1/users/{id}/reset-password`,
`POST /api/v1/auth/change-password`. Sin cambios en el backend (salvo TT-11).

## Fuera de alcance
Borrado de usuarios, recuperación por correo, ver/cerrar sesiones por dispositivo.
