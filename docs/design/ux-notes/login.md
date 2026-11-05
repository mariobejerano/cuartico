# Notas de UX · Login (HU-01)

> Prototipo: [`prototypes/login.html`](../prototypes/login.html) · Textos: [`copy.md` §2–3](../copy.md#3-login-hu-01)
> **Estado: Aprobado (2026-11-05).** Las referencias «CA-n» sin historia son de HU-01.

## Flujo
1. Al abrir `/login` con un refresh guardado → pantalla «Comprobando tu sesión…» (no el formulario) mientras se llama a `/auth/refresh` (CA-11). Si va bien → al panel; si no → formulario.
2. Formulario: usuario → contraseña → «Entrar» (Enter también envía). En segundo plano ya se lanzó el `GET /actuator/health` `no-cors` (CA-7).
3. Éxito → Inicio o la ruta interna que se pidió (CA-6). En el prototipo va a `products.html` con el rol elegido.

## Decisiones (una línea cada una)
| Decisión | Por qué |
|---|---|
| Una sola tarjeta centrada, máx. 26 rem, sin imagen de fondo | Carga instantánea con datos caros; nada distrae del único objetivo. |
| Monograma SVG en línea en vez de logo en imagen | ~300 bytes, nítido en cualquier pantalla y sin petición extra. |
| Selector de idioma arriba a la derecha con «Español / English» en su propio idioma | Es donde se busca y quien no entiende el idioma actual reconoce el suyo. |
| Botón «Mostrar/Ocultar» contraseña (texto, no icono) | Evita errores de tecleo en móvil; el texto es inequívoco en ambos idiomas. |
| «Entrar» a ancho completo | Objetivo grande al alcance del pulgar; crece con «Log in» sin romperse. |
| Nota «¿Olvidaste tu contraseña? Pide a un administrador…» | No existe recuperación por correo: decirlo evita buscar un enlace que no hay. |
| Foco inicial en «Usuario» solo en escritorio | En móvil abriría el teclado y taparía media pantalla antes de que el usuario mire. |
| `autocomplete="username"` / `"current-password"`, `autocapitalize="none"` | Gestores de contraseñas funcionan y el móvil no pone mayúscula al usuario. |

## Estados
| Estado | Qué se ve | Rol ARIA |
|---|---|---|
| Comprobando sesión | Pantalla completa con spinner y «Comprobando tu sesión…» | `status` |
| Campo vacío al enviar (CA-3) | Borde rojo 2 px + «Escribe tu usuario.» bajo el campo; foco al primero vacío; **no** se llama a la API | `aria-invalid` + `aria-describedby` |
| Enviando (CA-4) | Botón deshabilitado con spinner y «Entrando…» (mismo ancho); doble clic ignorado | `aria-busy` |
| 5 s sin respuesta (CA-8) | Alerta azul (info) arriba del formulario: «El servidor se está despertando · Puede tardar hasta un minuto…». El botón sigue en «Entrando…» | `status` (no interrumpe) |
| Credenciales inválidas (CA-2) | Alerta roja con el `detail` de la API; **se vacía la contraseña**, se conserva el usuario y el foco va a la contraseña | `alert` |
| Red / 90 s / 502-504 (CA-9) | Alerta roja «No pudimos conectar con el servidor» + «Reintentar»; el usuario escrito se conserva | `alert` |
| 5xx con ProblemDetail (CA-10) | Alerta roja con su `detail` + «Reintentar». Nunca JSON ni stack trace | `alert` |
| Llega desde sesión terminada (CA-15) | Alerta ámbar «Tu sesión ha terminado, vuelve a iniciar sesión.» | `status` |
| Llega tras cambiar contraseña (HU-14 CA-7) | Alerta verde «Contraseña cambiada, inicia sesión de nuevo.» | `status` |

Los mensajes visibles se re-traducen al cambiar de idioma (en la app sale gratis si se guardan **claves** y no textos en el estado).

## Accesibilidad
- `<label for>` visibles; errores con `aria-invalid` + `aria-describedby`; alertas con `role="alert"`/`"status"` (HU-01 CA-27).
- El selector de idioma es un grupo de botones con `aria-pressed`; `<html lang>` cambia con el idioma.
- 360 px sin scroll horizontal; objetivos ≥ 44 px; contraste según tokens (todo AA, la mayoría AAA).

## Para Forja-Front
- Guarda en el estado del login la **clave** del mensaje (o el `detail` de la API), no el texto traducido.
- El aviso de 5 s y el corte de 90 s viven en `api/client.ts` (HU-01 diseño técnico); el login solo pinta lo que el cliente notifica.
