# Product backlog

Mantenido por Timon con la supervisión. Documenta el estado actual; cada historia tendrá su ficha en
[`docs/analysis/stories/`](../analysis/stories/) cuando Faro la trabaje.

**Orden:** de arriba abajo, de mayor a menor prioridad. El orden de las historias de Cuartico sigue las dependencias
(productos antes que compras y combos; compras antes que pedidos). Pendiente de confirmar por la supervisión.

**Estados:** `Hecho` · `En curso` · `Pendiente`. Una historia no se cierra "a medias": si tiene backend y frontend,
ambos y su QA deben estar terminados (vertical slice).

## Historias de usuario

### Fase 1: Cuartico (gestión interna)

| ID | Prioridad | Historia | Estado | Notas |
|---|---|---|---|---|
| HU-01 | 1 | Acceso al panel: login, sesión, roles `ADMIN` / `OPERATOR` | En curso | Backend hecho (JWT, refresh rotativo, usuarios). Falta el frontend `cuartico-web`. |
| HU-02 | 2 | Catálogo de productos | Pendiente | Los productos son lo que se compra suelto; aquí vive el stock. |
| HU-03 | 3 | Proveedores | Pendiente | Necesario para las compras. |
| HU-04 | 4 | Compras y movimientos de inventario | Pendiente | Entrada de stock, promedio ponderado, movimientos inmutables. |
| HU-05 | 5 | Clientes | Pendiente | |
| HU-06 | 6 | Combos: receta (producto × cantidad), precio, costo, margen y combos disponibles según stock | Pendiente | Combos solo catálogo: se arman al vender. |
| HU-07 | 7 | Pedidos: `PENDING` → `CONFIRMED` → `IN_TRANSIT` → `DELIVERED` / `CANCELLED`, con reserva y descuento de stock | Pendiente | |
| HU-08 | 8 | Pagos manuales multimoneda (`UNPAID` → `PARTIALLY_PAID` → `PAID`), con tasa del día | Pendiente | Independientes del pedido. |
| HU-09 | 9 | Gastos | Pendiente | |
| HU-10 | 10 | Panel y reportes: ventas, costo, gastos y utilidad del mes; stock bajo; cuentas por cobrar | Pendiente | |

### Más adelante

| ID | Historia | Estado | Notas |
|---|---|---|---|
| HU-11 | Fase 2: Combazo catálogo (combos disponibles + "Pedir por WhatsApp") | Pendiente | |
| HU-12 | Fase 3: Combazo tienda ("arma tu combo", pedidos online que llegan a Cuartico) | Pendiente | |
| HU-13 | Fase 4: móviles (PWA y después app Android con React Native / Expo) | Pendiente | |

## Tareas técnicas

Trabajo sin valor directo de negocio (infraestructura, calidad, herramientas).

| ID | Prioridad | Tarea | Estado | Origen / notas |
|---|---|---|---|---|
| TT-01 | 1 | Test de rutas antiguas *con token* que espere 404 (`/api/auth/*`, `/api/users/*`) | Pendiente | Lupa, PR #5. Hoy `OpenApiIntegrationTests` solo comprueba 401 sin token. |
| TT-02 | 2 | Manejar `HandlerMethodValidationException` con la propiedad `errors` | Pendiente | Lupa, PR #5. Hoy cae en `request.malformed` sin `errors`. |
| TT-03 | 3 | Código propio para 413 (payload demasiado grande) | Pendiente | Lupa, PR #5. Hoy cae en `request.malformed`. |
| TT-04 | 4 | `WWW-Authenticate` en los 401 de `ApiException.unauthorized` | Pendiente | Lupa, PR #5. Hoy solo lo llevan los 401 de los filtros y de `AuthenticationException`. |
| TT-05 | 5 | ProblemDetail también para errores que pasan por `/error` | Pendiente | Lupa, PR #5. Hoy esos errores usan el formato por defecto de Spring Boot. |
| TT-06 | 6 | Fijar las GitHub Actions a SHA de commit y activar Dependabot | Pendiente | Hoy `backend-ci.yml` usa tags (`actions/checkout@v7`, etc.). |
| TT-07 | 7 | Acceso de solo lectura a Neon (MCP) para Vera y Faro, limitado a la rama `staging` | Pendiente | Antes de crear las tablas de negocio. |
| TT-08 | 8 | Esqueleto de `cuartico-web` (Vite + React + TypeScript, react-i18next, PWA) | Pendiente | Prerrequisito de HU-01. Lo implementa Forja-Front. |
| TT-09 | 9 | Medir memoria de la JVM en staging y revisar los topes del `Dockerfile` | Pendiente | El propio `Dockerfile` pide medir en staging antes de producción. |
| TT-10 | 10 | Sustituir `APP_CORS_ORIGINS` en `render/production.yaml` por la URL del frontend en Vercel | Pendiente | Antes de abrir producción a usuarios. |
| TT-11 | 1 | **Bug:** `UpdateUserRequest.active` es `boolean` primitivo: si el cliente lo omite llega `false`, desactiva al usuario y revoca sus sesiones. Cambiar a `@NotNull Boolean` | Pendiente | Detectado por Lupa en la revisión del PR #6 (`UserDtos.java`). |

## Hecho

### Base (Sprint 0)

| Elemento | Estado | Referencia |
|---|---|---|
| Arquitectura base del backend (perfiles, Flyway, ProblemDetail, auditoría) | Hecho | PR #1 y siguientes |
| Usuarios, login JWT, refresh tokens con rotación, roles | Hecho | Sprint 0 |
| Equipo de agentes y `CLAUDE.md` | Hecho | PR #2 |
| Repositorio en GitHub, ramas `main` / `develop` y protección de ramas | Hecho | |
| Dockerfile y CI con GitHub Actions | Hecho | PR #1 |
| Despliegue en Render (staging y producción) y Neon | Hecho | Release v0.1.0 (PRs #1–#3; release PR #4, `ab4b546`) |
| i18n del backend (códigos de error y mensajes es/en) | Hecho | PR #5 |
| API versionada `/api/v1` y documentación OpenAPI | Hecho en `develop` | PR #5, pendiente de la próxima release (ver [`CHANGELOG.md`](../../CHANGELOG.md)) |

Detalle en [`sprints/00.md`](sprints/00.md).
