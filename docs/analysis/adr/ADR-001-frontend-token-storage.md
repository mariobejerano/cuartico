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
**Opción A ahora**: access token en memoria y refresh token en `localStorage`, **sin cambios en el backend**.
Revisar la decisión (nuevo ADR, probablemente opción C con dominio propio) **antes de abrir Combazo al público**
o en cuanto haya dominio propio.

Condiciones obligatorias para el frontend (son criterios de HU-01):
1. **Una sola renovación a la vez**: si varias peticiones reciben 401 juntas, se hace un único `/refresh` y las demás esperan.
2. **Coordinación entre pestañas** con la Web Locks API (`navigator.locks.request('cuartico-refresh', …)`): las
   renovaciones de todas las pestañas van en serie y el refresh se lee de `localStorage` **dentro** del bloqueo, nunca de
   una copia en memoria; así cada pestaña usa el token más reciente (el access token no se comparte: cada pestaña obtiene el suyo).
   Sin esto, dos pestañas enviarían el mismo refresh y la segunda dispararía la detección de reutilización (cierre de todas las sesiones).
3. Evento `storage`: si otra pestaña cierra sesión (borra el refresh), esta también vuelve al login.
4. Ningún token en logs, en la URL ni en mensajes de error. Nada de `dangerouslySetInnerHTML` con datos del usuario.
5. **Content-Security-Policy** estricta en Vercel (`script-src 'self'`, `connect-src` limitado a la API). Tarea para Forja-Front/Timon.

## Consecuencias
- (+) Se entrega HU-01 sin tocar el backend; el mismo contrato servirá para la app móvil.
- (−) Un XSS puede robar el refresh. El daño queda acotado: en cuanto el atacante o el usuario lo use, el otro
  presentará un token revocado y se cerrarán todas las sesiones. La CSP es la defensa principal.
- (−) Caso límite aceptado: si la respuesta de `/refresh` se pierde por la red (el servidor ya rotó), el siguiente intento usa
  un token revocado y se cierran todas las sesiones: el usuario vuelve a iniciar sesión. Si molesta en la práctica, se puede
  añadir en el backend un periodo de gracia de unos segundos para el token recién rotado (fuera de alcance ahora).
- La API sigue siendo *stateless*, sin cookies y sin CSRF.
