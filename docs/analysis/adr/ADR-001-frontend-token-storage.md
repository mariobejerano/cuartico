# ADR-001: Dónde guarda los tokens el frontend

- **Estado:** Aceptado (2026-10-30). Se revisa cuando haya dominio propio (y en todo caso antes de abrir Combazo al público).
- **Fecha:** 2026-10-30
- **Historia:** [HU-01](../stories/HU-01-panel-access.md)

## Contexto
- El backend emite un **access token** JWT (15 min) y un **refresh token** opaco (7 días), ambos **en el cuerpo JSON**
  (`TokenResponse`). `/refresh` y `/logout` leen el refresh **del cuerpo**. El refresh es rotativo y, si llega uno ya
  revocado, el backend **revoca todas las sesiones del usuario** (detección de reutilización).
- `cuartico-web` estará en Vercel (`*.vercel.app`) y la API en Render (`*.onrender.com`). Ambos dominios están en la
  *Public Suffix List*: el front y la API no solo son de distinto origen, son de **distinto sitio**. Una cookie de la API
  sería una **cookie de terceros** (`SameSite=None; Secure`), y Safari (macOS e iOS) bloquea las cookies de terceros por defecto.
- CORS hoy: orígenes de `APP_CORS_ORIGINS`, cabeceras `Authorization` y `Content-Type`, **sin** `allowCredentials`.
  La API no usa cookies, así que CSRF está desactivado con razón.
- Planes gratuitos: no hay dominio propio. Fase 4 (React Native) no usa cookies del navegador: necesitará el refresh en el cuerpo igualmente.

El **access token va en memoria** (variable del módulo de auth, nunca en `localStorage`): eso no se discute aquí.
La decisión es dónde vive el **refresh token**.

## Opciones

| | A. `localStorage` (cuerpo JSON, como hoy) | B. Cookie `HttpOnly` cross-site (`SameSite=None`) | C. Cookie `HttpOnly` same-site (proxy de Vercel o dominio propio) |
|---|---|---|---|
| Robo por XSS | Sí: un script inyectado puede leerlo. Mitigan: rotación + detección de reutilización, TTL 7 d, CSP estricta, React escapa por defecto. | No se puede leer (pero un XSS sí puede hacer peticiones en nombre del usuario mientras la página está abierta). | Igual que B. |
| Funciona en Safari / iOS | Sí | **No** (cookies de terceros bloqueadas): la sesión no sobrevive a recargar. | Sí |
| CSRF | No aplica (no hay cookies) | Hay que protegerse: comprobar `Origin`, o token CSRF. | `SameSite=Strict` lo resuelve casi del todo; comprobar `Origin` igualmente. |
| Cambios en backend | **Ninguno** | `Set-Cookie` en login/refresh, leer cookie en refresh/logout, `allowCredentials=true`, control de `Origin`. | Lo de B, y además: rewrite `/api/*` → Render en `vercel.json` (o dominio propio con subdominios `app.` y `api.`). |
| Riesgos propios | Pestañas que refrescan a la vez (ver abajo). | Lo de A + Safari. | Proxy de Vercel: límite de espera de la petición al origen documentado en **30 s** (un changelog habla de 2 min; hay que verificarlo) frente a ~50–60 s del arranque en frío de Render. Dominio propio: cuesta dinero. |
| Móvil (fase 4) | Mismo contrato | Hay que mantener los dos contratos (cookie y cuerpo). | Igual que B. |

## Decisión
**Opción A ahora**: access token en memoria y refresh token en `localStorage`, sin cambiar el contrato de la API
(el único cambio de backend es la ventana de gracia del complemento de abajo).
Revisar la decisión (nuevo ADR, probablemente opción C con dominio propio) **antes de abrir Combazo al público**
o en cuanto haya dominio propio.

Condiciones obligatorias para el frontend (son criterios de HU-01):
1. **Una sola renovación a la vez**: si varias peticiones reciben 401 juntas, se hace un único `/refresh` y las demás esperan.
2. **Coordinación entre pestañas** con la Web Locks API (`navigator.locks.request('cuartico-refresh', …)`).
   El bloqueo cubre **toda** operación que lee o cambia el refresh: el **refresh inicial** al cargar la app, la **renovación
   ante 401** y el **logout**. Dentro del bloqueo el refresh se lee de `localStorage` (nunca de una copia en memoria) y, si
   ya no está, la pestaña pasa a anónima sin llamar a la API. El access token no se comparte: cada pestaña obtiene el suyo.
   Casos que cubre: dos pestañas que caducan a la vez; el navegador que **restaura varias pestañas** de golpe (todas hacen
   su refresh inicial: en serie); una pestaña esperando el bloqueo mientras otra hace **logout** (encuentra `localStorage`
   vacío y no llama a `/refresh`); dos logouts a la vez (solo uno llama a `/logout`).
   Sin esto, dos pestañas enviarían el mismo refresh y la segunda dispararía la detección de reutilización (cierre de todas las sesiones).
   La Web Locks API está en todos los navegadores actuales (Safari ≥ 15.4); no se implementa alternativa.
3. Evento `storage`: si otra pestaña cierra sesión (borra el refresh), esta pasa a anónima y vuelve al login de inmediato.
4. **Timeout o error de red en `/refresh`** (corte de 90 s): no se borra la sesión ni el refresh guardado; se libera el
   bloqueo y se ofrece «Reintentar». Solo un **401** de `/refresh` borra la sesión local.
5. Ningún token en logs, en la URL ni en mensajes de error. Nada de `dangerouslySetInnerHTML` con datos del usuario.
6. **Content-Security-Policy** estricta en Vercel (`script-src 'self'`, `connect-src` limitado a la API,
   `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`). Tarea para Forja-Front/Timon.

## Consecuencias
- (+) El contrato de tokens no cambia (siguen en el cuerpo JSON); el mismo servirá para la app móvil. El único cambio de
  backend es la ventana de gracia (abajo).
- (−) Un XSS puede robar el refresh. El daño queda acotado: en cuanto el atacante o el usuario lo use, el otro
  presentará un token revocado y se cerrarán todas las sesiones. La CSP es la defensa principal.
- La API sigue siendo *stateless*, sin cookies y sin CSRF.

## Complemento (2026-11-05): ventana de gracia del refresh en el backend
**Problema** (pregunta de Lupa en el PR #8): con la red móvil de Cuba es frecuente que el servidor rote el refresh y la
respuesta se pierda. El cliente conserva el token anterior (correcto: no sabe si se rotó), reintenta y el backend lo toma
por robo: **cierra todas las sesiones** del usuario. Con este uso, sería un cierre de sesión casi diario.

**Opciones**
1. Sin gracia (como hoy): máxima detección, mala experiencia con red inestable.
2. Gracia que **devuelve el mismo par** ya emitido: imposible sin guardar el refresh en claro (hoy solo se guarda su hash).
   Guardarlo cifrado añade gestión de claves. Descartada.
3. **Gracia que emite un par nuevo** y revoca el sucesor no entregado. Requiere enlazar cada token con su sucesor
   (`replaced_by_id`) y saber por qué se revocó (`revoked_reason`).

**Decisión: opción 3, 120 s** (`app.jwt.refresh-reuse-grace`; mayor que el corte de 90 s del cliente más un reintento).
Se aplica solo si el token presentado se revocó **por rotación** hace ≤ 120 s y su sucesor **no se ha usado**: se emite un
par nuevo y el sucesor pasa a `SUPERSEDED`. Fuera de esas condiciones, sigue la detección de reutilización. Presentar
un token `SUPERSEDED` también es reutilización. Requisitos y CA: HU-01 CA-28 a CA-33 (Forja-Back).

**Consecuencias**
- (+) Un reintento tras perder la respuesta ya no cierra las sesiones.
- (−) Si un atacante usa un refresh robado dentro de los 120 s posteriores a una rotación legítima, obtiene un par válido
  y la detección se **retrasa** hasta el siguiente refresh del usuario legítimo (≤ 15 min, el TTL del access), que presenta
  el sucesor `SUPERSEDED` y provoca la revocación total. Aceptado: la ventana es corta y la detección no se pierde.
- (−) Dos columnas más en `refresh_tokens` y bloqueo pesimista de la fila en `consume`.
