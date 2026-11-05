# HU-01: Acceso al panel de gestión

- **Sprint:** 1 · **Estado:** análisis listo; prototipos aprobados ([`login.html`](../../design/prototypes/login.html),
  [`products.html`](../../design/prototypes/products.html) para el layout; [notas UX](../../design/ux-notes/))
- **Alcance:** frontend `cuartico-web` y un cambio acotado en el backend: **ventana de gracia del refresh** (CA-28,
  Forja-Back). El resto del backend ya existe (ver [API](../../development/backend/api.md) y
  [ADR-001](../adr/ADR-001-frontend-token-storage.md)).
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
- **CA-6 Volver a donde iba.** Dado un usuario sin sesión que abre una ruta protegida (p. ej. `/products?q=arroz`), cuando
  inicia sesión, entonces llega a esa ruta con su búsqueda. La ruta pendiente se guarda en el estado del router (o en
  `?redirect=`) y **solo se acepta si es interna**: empieza por `/`, no por `//` ni `/\`, no contiene esquema (`http:`,
  `javascript:`…) ni `\`, y no apunta a `/login`. Cualquier otro valor se ignora y se va al inicio (sin redirección abierta).
  **Verificación:** `?redirect=//evil.com`, `?redirect=https://evil.com`, `?redirect=/\evil.com` y
  `?redirect=javascript:alert(1)` llevan al inicio.

### Servidor dormido y red
- **CA-7 Despertar el servidor.** Al cargar la pantalla de login se envía en segundo plano una petición a
  `GET /actuator/health` con `mode: 'no-cors'` (solo para despertar Render; esa ruta no tiene CORS y no se lee la respuesta).
- **CA-8 Servidor despertando.** Dada cualquier petición a la API que no responde en **5 s**, entonces se muestra
  «El servidor se está despertando, puede tardar hasta un minuto» sin bloquear la pantalla con un error.
  El límite total de espera es **90 s**.
- **CA-9 Sin respuesta.** Dada una petición que supera 90 s, falla por red (sin conexión, DNS, CORS) o recibe 502/503/504,
  entonces se muestra un error traducido de conexión con botón «Reintentar», y en el login no se pierde el usuario escrito.
  **Si la petición abortada es `/auth/refresh`** (arranque o renovación): la sesión local **no se borra**, el refresh
  guardado se conserva tal cual (puede que el servidor ya lo rotara: lo cubre la ventana de gracia, CA-28), se libera el
  bloqueo y se muestra el error de conexión con «Reintentar», que repite la renovación con el refresh **más reciente de
  `localStorage`**. Las peticiones que esperaban la renovación fallan con el mismo error de conexión (no con «sesión terminada»).
- **CA-10 Error inesperado.** Dada una respuesta 5xx con ProblemDetail, se muestra su `detail`; si no hay cuerpo legible,
  un texto genérico del frontend. Nunca se muestra un stack trace ni JSON crudo.

### Sesión persistente y renovación
- **CA-11 Recargar la página.** Dado un usuario con sesión, cuando recarga o abre el panel en una pestaña nueva, entonces
  sigue dentro sin volver a escribir la contraseña (el frontend llama a `/auth/refresh` con el refresh guardado y obtiene
  access token y `user`). Durante la comprobación se ve «Comprobando tu sesión…», no la pantalla de login.
  Este refresh inicial se hace **dentro del bloqueo** `cuartico-refresh` (ADR-001), igual que las renovaciones y el logout.
- **CA-12 Renovación transparente.** Dado un access token caducado, cuando una petición recibe **401**, entonces el frontend
  llama una vez a `/auth/refresh`, guarda el nuevo par y **repite la petición original una sola vez**; el usuario no nota nada.
- **CA-13 Una sola renovación.** Dadas varias peticiones que reciben 401 a la vez (en la misma pestaña), entonces se hace
  **un único** `/auth/refresh` y todas se repiten con el token nuevo.
- **CA-14 Varias pestañas.** Toda operación que lee o cambia el refresh token (refresh inicial, renovación ante 401 y
  logout) se ejecuta dentro del bloqueo `cuartico-refresh` (Web Locks API, ADR-001) y lee el refresh de `localStorage`
  **dentro** del bloqueo, nunca de una copia en memoria. Nunca se envía dos veces el mismo refresh token. Casos:
  - a) dos pestañas cuyo access caduca a la vez → renuevan en serie, cada una con el refresh más reciente;
  - b) el navegador **restaura varias pestañas a la vez** (o se abren 3–5 pestañas seguidas) → los refresh iniciales van en serie;
  - c) una pestaña espera el bloqueo mientras otra hace logout → al entrar encuentra `localStorage` sin refresh, pasa a
    anónima y va al login **sin** llamar a `/auth/refresh`.
  **Verificación:** en a) y b) el usuario sigue con sesión en todas las pestañas y el backend no registra reutilización; en c)
  no hay ninguna llamada a `/auth/refresh` después del logout.
- **CA-15 Renovación imposible.** Dado que `/auth/refresh` responde 401 (`auth.refresh_invalid`, `auth.refresh_expired` o
  `auth.user_disabled`), entonces se borra la sesión local, se va al login y se muestra «Tu sesión ha terminado, vuelve a
  iniciar sesión». No se reintenta en bucle. **Solo un 401** de `/auth/refresh` borra la sesión: un timeout, un error de red
  o un 5xx siguen CA-9 y conservan el refresh.
- **CA-16 Sin bucles.** Un 401 de `/auth/login`, `/auth/refresh` o `/auth/logout` **nunca** dispara una renovación.
- **CA-17 403 no es 401.** Dada una respuesta 403 (`auth.forbidden`), no se intenta renovar: se muestra el `detail`
  traducido y el usuario sigue en la pantalla.
- **CA-18 Almacenamiento.** El access token solo vive en memoria; el refresh token en `localStorage` (ADR-001). Ningún
  token aparece en la URL, en la consola ni en mensajes de error.

### Cierre de sesión
- **CA-19 Logout.** Cuando el usuario pulsa «Cerrar sesión», entonces, dentro del bloqueo `cuartico-refresh`, se lee el
  refresh de `localStorage`, se borra de `localStorage` y de memoria, y se llama a `POST /auth/logout` con ese valor; después
  se va al login. Si la llamada falla (red, servidor dormido), la sesión local **se borra igual** (no se reintenta).
- **CA-20 Logout en otra pestaña.** Dado el panel abierto en varias pestañas, cuando cierra sesión en una, las demás pasan a
  anónimas y van al login al recibir el evento `storage` (sin esperar a una interacción), y descartan su access token en memoria.
  Si dos pestañas pulsan «Cerrar sesión» a la vez, solo una llama a `/auth/logout`; la otra encuentra `localStorage` vacío y
  solo limpia su estado.

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

### Backend: ventana de gracia del refresh (Forja-Back; ver ADR-001)
Motivo: con red móvil inestable, el servidor puede rotar el refresh y la respuesta perderse; hoy el reintento con el token
anterior se trata como robo y cierra **todas** las sesiones del usuario.
Parámetro `app.jwt.refresh-reuse-grace` (por defecto **120 s**: mayor que el corte de 90 s del cliente más un reintento).

- **CA-28 Reintento dentro de la gracia.** Dado un refresh `R1` rotado a `R2` hace menos de 120 s (`revoked_reason = ROTATED`)
  y `R2` todavía **sin usar**, cuando llega `R1` a `/auth/refresh`, entonces **200** con un par nuevo (`R3`), `R2` queda
  revocado (`SUPERSEDED`) y **no** se revocan las demás sesiones del usuario.
- **CA-29 Fuera de la gracia.** Dado `R1` rotado hace más de 120 s, cuando llega `R1`, entonces **401** `auth.refresh_invalid`
  y se revocan todas las sesiones del usuario (comportamiento actual).
- **CA-30 Sucesor ya usado.** Dado `R1` rotado a `R2` y `R2` ya rotado a su vez, cuando llega `R1` (aun dentro de los
  120 s), entonces **401** `auth.refresh_invalid` y se revocan todas las sesiones (reutilización real).
- **CA-31 Sucesor reemplazado.** Dado `R2` revocado como `SUPERSEDED` por CA-28, cuando llega `R2`, entonces **401**
  `auth.refresh_invalid` y se revocan todas las sesiones (alguien más tenía `R1`: es la señal de robo).
- **CA-32 Sin gracia para otras revocaciones.** Dado un refresh revocado por logout, cambio o reseteo de contraseña,
  desactivación del usuario o revocación masiva, cuando llega, entonces **401** sin gracia (se mantiene la regla actual
  para los revocados: revocación de todas las sesiones).
- **CA-33 Concurrencia.** Dadas dos peticiones simultáneas a `/auth/refresh` con el mismo token válido, entonces se
  procesan en serie (bloqueo pesimista de la fila del token): la primera rota y la segunda cae en CA-28. Nunca dos
  sucesores válidos del mismo token.

Diseño: migración nueva (siguiente número libre: V2 o V3 según se mergee antes o después de productos) que añade a
`refresh_tokens` las columnas `replaced_by_id BIGINT NULL REFERENCES refresh_tokens (id) ON DELETE SET NULL` y
`revoked_reason VARCHAR(20) NULL` (`ROTATED`, `SUPERSEDED`, `LOGOUT`, `PASSWORD_CHANGE`, `USER_DISABLED`, `REUSE_DETECTED`;
los revocados antes de la migración quedan con `NULL` y no tienen gracia). `RefreshTokenRepository.findByTokenHash` con
`@Lock(PESSIMISTIC_WRITE)` en `consume`. Lógica en `RefreshTokenService.consume`; log `warn` en inglés cuando se aplica la
gracia (sin el token). Tests de integración con `Clock` fijo para los límites de 120 s.

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
| `auth/session.ts` | Access token en memoria; refresh en `localStorage` (clave `cuartico.refreshToken`). Refresh inicial, renovación (*single-flight* en la pestaña) y logout dentro de `navigator.locks.request('cuartico-refresh')`, releyendo `localStorage` dentro del bloqueo; escucha `storage`. |
| `auth/AuthProvider` | Estado `loading` / `authenticated(user)` / `anonymous`; arranque con `/refresh` (CA-11). |
| `auth/RequireAuth`, `auth/RequireRole` | Guardas de rutas (CA-6, CA-25). |
| `i18n/` | react-i18next, `es` y `en`; clave `cuartico.lang` en `localStorage`. |

Endpoints que se usan: `POST /api/v1/auth/login|refresh|logout`.
`GET /api/v1/auth/me` no es necesario en el arranque (el `/refresh` ya devuelve `user`), pero puede usarse para refrescar datos del usuario.

**Códigos de error que el frontend trata de forma específica:** `auth.invalid_credentials`, `auth.refresh_invalid`,
`auth.refresh_expired`, `auth.user_disabled`, `auth.unauthorized`, `auth.forbidden`, `validation.failed`.
El resto se muestra con su `detail`.

**Backend:** solo la ventana de gracia (CA-28 a CA-33). Comprobar que `APP_CORS_ORIGINS` de staging incluye la URL de Vercel del panel (Timon).

## Fuera de alcance (movido)
- Gestión de usuarios y cambio de contraseña propia: [HU-14](HU-14-user-management.md).

## Preguntas abiertas
Ninguna (resueltas por la supervisión el 2026-10-30).
