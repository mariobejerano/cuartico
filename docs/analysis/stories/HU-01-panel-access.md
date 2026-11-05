# HU-01: Acceso al panel de gestión

- **Sprint:** 1 · **Estado:** análisis listo; prototipos aprobados ([`login.html`](../../design/prototypes/login.html),
  [`products.html`](../../design/prototypes/products.html) para el layout; [notas UX](../../design/ux-notes/))
- **Alcance:** frontend `cuartico-web`. El backend ya existe (ver [API](../../development/backend/api.md)); no requiere cambios
  (ver [ADR-001](../adr/ADR-001-frontend-token-storage.md)).
- **Depende de:** TT-08 (esqueleto de `cuartico-web`).
- **Decisiones de la supervisión (2026-10-30):** ADR-001 aceptado; la gestión de usuarios y el cambio de contraseña propia
  pasan a [HU-14](HU-14-user-management.md), fuera del sprint 1.

## Necesidad
El equipo del negocio necesita entrar al panel con su usuario, seguir dentro mientras trabaja sin volver a escribir la
contraseña, y que cada persona vea solo lo que su rol le permite.

## Historia
**Como** administrador u operador de Cuartico,
**quiero** iniciar sesión en el panel, mantener la sesión abierta y cerrarla cuando termine,
**para** gestionar el negocio de forma segura desde cualquier dispositivo.

## Criterios de aceptación

### Login
- **CA-1 Login correcto.** Dado un usuario activo, cuando introduce usuario y contraseña válidos y pulsa «Entrar»,
  entonces entra al panel (pantalla de inicio) y ve su nombre completo y su rol en la zona de cuenta (CA-24).
- **CA-2 Credenciales inválidas.** Dado un usuario inexistente, una contraseña errónea **o un usuario desactivado**, cuando
  intenta entrar, entonces ve el mensaje traducido de `auth.invalid_credentials` (el mismo en los tres casos), sigue en
  el login, el campo de contraseña se vacía y el usuario no.
- **CA-3 Campos vacíos.** Dado el formulario con usuario o contraseña vacíos, cuando pulsa «Entrar», entonces se marca el
  campo como obligatorio y **no** se llama a la API.
- **CA-4 Envío único.** Mientras el login está en curso, el botón está deshabilitado con indicador de carga; un doble clic
  no produce dos peticiones.
- **CA-5 Ya autenticado.** Dado un usuario con sesión válida, cuando abre `/login`, entonces se le redirige al inicio.
- **CA-6 Volver a donde iba.** Dado un usuario sin sesión que abre una ruta protegida (p. ej. `/products`), cuando inicia
  sesión, entonces llega a esa ruta (solo rutas internas del panel; nunca una URL externa).

### Servidor dormido y red
- **CA-7 Despertar el servidor.** Al cargar la pantalla de login se envía en segundo plano una petición a
  `GET /actuator/health` con `mode: 'no-cors'` (solo para despertar Render; esa ruta no tiene CORS y no se lee la respuesta).
- **CA-8 Servidor despertando.** Dada cualquier petición a la API que no responde en **5 s**, entonces se muestra
  «El servidor se está despertando, puede tardar hasta un minuto» sin bloquear la pantalla con un error.
  El límite total de espera es **90 s**.
- **CA-9 Sin respuesta.** Dada una petición que supera 90 s, falla por red (sin conexión, DNS, CORS) o recibe 502/503/504,
  entonces se muestra un error traducido de conexión con botón «Reintentar», y en el login no se pierde el usuario escrito.
- **CA-10 Error inesperado.** Dada una respuesta 5xx con ProblemDetail, se muestra su `detail`; si no hay cuerpo legible,
  un texto genérico del frontend. Nunca se muestra un stack trace ni JSON crudo.

### Sesión persistente y renovación
- **CA-11 Recargar la página.** Dado un usuario con sesión, cuando recarga o abre el panel en una pestaña nueva, entonces
  sigue dentro sin volver a escribir la contraseña (el frontend llama a `/auth/refresh` con el refresh guardado y obtiene
  access token y `user`). Durante la comprobación se ve un indicador de carga, no la pantalla de login.
- **CA-12 Renovación transparente.** Dado un access token caducado, cuando una petición recibe **401**, entonces el frontend
  llama una vez a `/auth/refresh`, guarda el nuevo par y **repite la petición original una sola vez**; el usuario no nota nada.
- **CA-13 Una sola renovación.** Dadas varias peticiones que reciben 401 a la vez (en la misma pestaña), entonces se hace
  **un único** `/auth/refresh` y todas se repiten con el token nuevo.
- **CA-14 Varias pestañas.** Dadas dos pestañas abiertas cuyo access token caduca a la vez, cuando ambas necesitan renovar,
  entonces las renovaciones van en serie y cada una usa el refresh más reciente de `localStorage` (Web Locks API, ver ADR-001);
  nunca se envía dos veces el mismo refresh token.
  **Verificación:** tras la operación, el usuario sigue con sesión en las dos pestañas (no se dispara la detección de reutilización).
- **CA-15 Renovación imposible.** Dado que `/auth/refresh` responde 401 (`auth.refresh_invalid`, `auth.refresh_expired` o
  `auth.user_disabled`), entonces se borra la sesión local, se va al login y se muestra «Tu sesión ha terminado, vuelve a
  iniciar sesión». No se reintenta en bucle.
- **CA-16 Sin bucles.** Un 401 de `/auth/login`, `/auth/refresh` o `/auth/logout` **nunca** dispara una renovación.
- **CA-17 403 no es 401.** Dada una respuesta 403 (`auth.forbidden`), no se intenta renovar: se muestra el `detail`
  traducido y el usuario sigue en la pantalla.
- **CA-18 Almacenamiento.** El access token solo vive en memoria; el refresh token en `localStorage` (ADR-001). Ningún
  token aparece en la URL, en la consola ni en mensajes de error.

### Cierre de sesión
- **CA-19 Logout.** Cuando el usuario pulsa «Cerrar sesión», entonces se llama a `POST /auth/logout` con el refresh token,
  se borran los tokens locales y se va al login. Si la llamada falla (red, servidor dormido), la sesión local **se borra igual**.
- **CA-20 Logout en otra pestaña.** Dado el panel abierto en dos pestañas, cuando cierra sesión en una, la otra vuelve al
  login como mucho en su siguiente interacción (evento `storage`).

### Idioma
- **CA-21 Idioma inicial.** En la primera visita el idioma es inglés si el navegador está en inglés (`en*`); en cualquier
  otro caso, español.
- **CA-22 Cambiar idioma.** Hay un selector es/en en el login (arriba a la derecha) y en la zona de cuenta del
  panel (CA-24). Al cambiarlo, todos los textos
  cambian sin recargar, la elección se guarda en `localStorage` y se respeta en la siguiente visita.
- **CA-23 Errores en el idioma elegido.** Todas las peticiones envían `Accept-Language` con el idioma activo; los errores de
  la API se muestran con su `detail` (ya traducido) y los errores por campo con `errors`. Los errores que genera el propio
  frontend (red, servidor despertando, sesión terminada) vienen de sus archivos de traducción.

### Roles y navegación
- **CA-24 Layout.** Destinos en este sprint: «Inicio» y «Productos» (HU-02), para ambos roles; **no hay «Usuarios»** (HU-14).
  La zona de **cuenta** muestra nombre completo, rol (como texto), selector de idioma y «Cerrar sesión».
  - Móvil (< 768 px): barra superior con el título de la página y el avatar, y **barra inferior: Inicio · Productos · Cuenta**;
    «Cuenta» (o el avatar) abre una hoja inferior con la zona de cuenta.
  - Tablet (768–1023 px): barra lateral de iconos con nombre accesible; el avatar al pie abre la misma hoja.
  - Escritorio (≥ 1024 px): barra lateral con textos y la zona de cuenta al pie.
- **CA-25 Elementos por rol.** El frontend ofrece una utilidad común (p. ej. `hasRole('ADMIN')` y una guarda de ruta
  `RequireRole`) que oculta acciones y rutas según el rol del `user` de la sesión. En este sprint se verifica con los botones
  activar/desactivar de HU-02 (solo `ADMIN`); la primera ruta solo `ADMIN` llegará con HU-14. La seguridad real la impone
  el backend (403).
- **CA-26 Ruta inexistente.** Una ruta desconocida muestra una página 404 del panel con enlace al inicio.

### Accesibilidad y móvil
- **CA-27** El login y el layout se usan en un móvil de 360 px de ancho sin desplazamiento horizontal; los campos tienen
  etiqueta; se puede enviar el login con Enter; los errores se anuncian (`aria-live`).

## Fuera de alcance
- Recuperar contraseña por correo o SMS (no hay envío de correos); la restablece un `ADMIN`.
- Bloqueo por intentos fallidos / rate limiting (tarea técnica futura de backend).
- Cookies `HttpOnly` y dominio propio (ver ADR-001, se revisa antes de Combazo).
- Cierre de sesión por inactividad, "recordarme", 2FA.
- Ver y cerrar sesiones activas por dispositivo.

## Diseño técnico (frontend)
| Pieza | Responsabilidad |
|---|---|
| `api/client.ts` | `fetch` con base URL (`VITE_API_URL`), `Accept-Language`, `Authorization`, timeouts (5 s aviso, 90 s corte con `AbortController`), parseo de ProblemDetail a un error tipado `{ status, code, detail, errors }`. |
| `auth/session.ts` | Access token en memoria; refresh en `localStorage` (clave `cuartico.refreshToken`); renovación *single-flight* + `navigator.locks`; escucha `storage`. |
| `auth/AuthProvider` | Estado `loading` / `authenticated(user)` / `anonymous`; arranque con `/refresh` (CA-11). |
| `auth/RequireAuth`, `auth/RequireRole` | Guardas de rutas (CA-6, CA-25). |
| `i18n/` | react-i18next, `es` y `en`; clave `cuartico.lang` en `localStorage`. |

Endpoints que se usan: `POST /api/v1/auth/login|refresh|logout`.
`GET /api/v1/auth/me` no es necesario en el arranque (el `/refresh` ya devuelve `user`), pero puede usarse para refrescar datos del usuario.

**Códigos de error que el frontend trata de forma específica:** `auth.invalid_credentials`, `auth.refresh_invalid`,
`auth.refresh_expired`, `auth.user_disabled`, `auth.unauthorized`, `auth.forbidden`, `validation.failed`.
El resto se muestra con su `detail`.

**Backend:** sin cambios. Comprobar que `APP_CORS_ORIGINS` de staging incluye la URL de Vercel del panel (Timon).

## Fuera de alcance (movido)
- Gestión de usuarios y cambio de contraseña propia: [HU-14](HU-14-user-management.md).

## Preguntas abiertas
Ninguna (resueltas por la supervisión el 2026-10-30).
