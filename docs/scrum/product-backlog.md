# Product backlog

Mantenido por Timon con la supervisión. Documenta el estado actual; cada historia tendrá su ficha en
[`docs/analysis/stories/`](../analysis/stories/) cuando Faro la trabaje.

**Orden:** de arriba abajo, de mayor a menor prioridad. El orden de las historias de Cuartico sigue las dependencias
(productos antes que compras y combos; compras antes que pedidos). Confirmado por la supervisión el 2026-10-30.

**Estados:** `Hecho` · `En curso` · `Pendiente`. Una historia no se cierra "a medias": si tiene backend y frontend,
ambos y su QA deben estar terminados (vertical slice).

## Historias de usuario

### Fase 1: Cuartico (gestión interna)

| ID | Prioridad | Historia | Estado | Notas |
|---|---|---|---|---|
| HU-01 | 1 | Acceso al panel: login, sesión, roles `ADMIN` / `OPERATOR` | Hecho | Sprint 1. PR #9 (`0446197`). Backend con ventana de gracia y panel `cuartico-web`. Pendientes manuales en staging: M-1..M-3 de `docs/qa/stories/HU-01.md`. |
| HU-02 | 2 | Catálogo de productos | Hecho | Sprint 1. PR #10 (`a64da9f`). La categoría era texto libre; HU-15 la sustituye por `categoryId` (árbol de categorías, ADR-003). Pendiente manual: CA-27 en móvil real. |
| HU-15 | 2.1 | Categorías con jerarquía (4 raíces: Alimentos, Ropa, Electrodomésticos, Aseo y hogar) y atributos por tipo (marca, modelo, garantía) | Hecho | Sprint 2. PR #13 (`5cfdb49`), en staging desde 2026-11-11. Pendiente manual: CA-28 en móvil a 360 px. ADR-003. [Historia](../analysis/stories/HU-15-categories-and-type-attributes.md). Migración V4; rehace parte de HU-02. Prototipo aprobado (2026-11-09). Antes de HU-04. |
| HU-16 | 2.2 | Variantes de producto (talla × color, cada una con SKU y stock) | Hecho | Sprint 2. PR #14 (`bfdfdfc`), en staging desde 2026-11-13. Pendiente manual: CA-24 en móvil a 360 px. ADR-003. [Historia](../analysis/stories/HU-16-product-variants.md). Migración V5; `variant_stock` sustituye a `product_stock`. Prototipo aprobado (2026-11-09). Antes de HU-04. |
| HU-03 | 3 | Proveedores | Pendiente | Necesario para las compras. |
| HU-04 | 4 | Compras y movimientos de inventario | Pendiente | Entrada de stock, promedio ponderado, movimientos inmutables. **Requisitos:** HU-15 y HU-16 (ADR-003). Los movimientos y la caché de stock van por variante (`variant_stock`). Incluye TT-18. |
| HU-05 | 5 | Clientes | Pendiente | |
| HU-06 | 6 | Combos: receta (producto × cantidad), precio, costo, margen y combos disponibles según stock | Pendiente | Combos solo catálogo: se arman al vender. **Rebaja opcional** (supervisión, 2026-11-09): el combo puede tener o no descuento sobre la suma de precios sueltos (precio fijo del combo o % / importe de rebaja, con vigencia opcional); mostrar ahorro y margen. Combos **mixtos**: puede haber combos de alimentos, de ropa, de electrodomésticos o mixtos (la receta admite cualquier producto); si hay variantes, decidir si la línea del combo fija la variante o se elige al vender. |
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
| HU-17 | Tallas y colores bilingües (es/en): nombre en inglés de cada color y talla, como en las categorías | Pendiente | Supervisión, 2026-11-11. Para cuando llegue la tienda Combazo; hoy se guardan tal como se escriben, en un solo idioma. |

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
| TT-08 | 8 | Esqueleto de `cuartico-web` (Vite + React + TypeScript, react-i18next, PWA) | Hecho | Prerrequisito de HU-01. Lo implementa Forja-Front. |
| TT-09 | 9 | Medir memoria de la JVM en staging y revisar los topes del `Dockerfile` | Pendiente | El propio `Dockerfile` pide medir en staging antes de producción. |
| TT-10 | 10 | Sustituir `APP_CORS_ORIGINS` en `render/production.yaml` por la URL del frontend de producción (sitio estático de Render) | Pendiente | Antes de abrir producción a usuarios. |
| TT-11 | 1 | **Bug:** `UpdateUserRequest.active` es `boolean` primitivo: si el cliente lo omite llega `false`, desactiva al usuario y revoca sus sesiones. Cambiar a `@NotNull Boolean` | Hecho | Detectado por Lupa en la revisión del PR #6 (`UserDtos.java`). |
| TT-12 | 2 | Carrera previa: un refresh reutilizado fuera de la gracia mientras otra petición rota el sucesor deja vivo el token nuevo tras la revocación masiva. Serializar por usuario o documentarlo en ADR-001 | Pendiente | Lupa, PR #9 (MENOR, ya existía antes). |
| TT-13 | 3 | Añadir el check `Web (lint, tests, build)` a la protección de `main` y `develop` | Pendiente | Requiere OK de la supervisión. |
| TT-14 | 4 | Pulido de productos (MENOR de Lupa, PR #10): SKU con «ß» u otros caracteres que cambian al pasar a mayúsculas debe dar 400; desactivar/activar idempotente ante carrera (200, no 409); monedas del frontend desde la API o la configuración; `page` absurda en la URL vuelve a la primera página; no desmontar el formulario de edición si falla un refetch en segundo plano | Hecho | Sprint 2. Lupa, PR #10. PR #13 (`5cfdb49`). |
| TT-15 | 1 | **ADR-003 (Faro): categorías con jerarquía, tipos de producto y variantes.** Empezar con 3 categorías generales gestionadas (Alimentos, Ropa, Electrodomésticos) y añadir subcategorías tras el despliegue; variantes talla × color con stock propio (impacto en el 1:1 `products`–`product_stock` de ADR-002); atributos por tipo (marca, modelo, garantía, ¿nº de serie?); combos mixtos | Hecho | Supervisión, 2026-11-09. ADR-003 aceptado (2026-11-09); genera HU-15 y HU-16. |
| TT-16 | 1 | Antes de desplegar V4 (HU-15): comprobar `SHOW lc_ctype` en Neon (ramas staging y production). Con `C`/`POSIX`, `LOWER()` no pasa a minúsculas las letras acentuadas y las claves únicas de nombres fallarían con «Lácteos»/«LÁCTEOS» | En curso | Sprint 2. Faro, ADR-003 (PR #11). **Staging: comprobado (2026-11-11)**, `C.UTF-8` y `LOWER()` correcto con tildes; V4 aplicada. **Falta production**, antes del release. |
| TT-17 | 4 | Aviso de «¿descartar cambios?» también con filas sin guardar de «Añadir variantes» y con una variante en edición (hoy solo mira el formulario principal) | Pendiente | Vera, HU-16 (H-2, baja). No incumple ningún CA. |
| TT-18 | 4 | Costo agregado de un producto con variantes: leer la moneda de `app.currencies.reference` (hoy fija en `USD` en `VariantAggregate`) y agregar solo las filas en esa moneda | Pendiente | Lupa, PR #14 (menor). Sin efecto hasta que haya costos: hacerlo con HU-04. |

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
