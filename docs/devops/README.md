# DevOps: entornos, configuración, CI y despliegue

Responsable: Timon. Guía paso a paso del alta en Render y Neon: [deploy.md](deploy.md).

## Entornos

| Entorno | Rama Git | Servicio Render | Rama Neon | Blueprint | URL | Swagger |
|---|---|---|---|---|---|---|
| Local | — | — | — (H2 en `backend/data/`) | — | http://localhost:8080 | Sí (`dev`) |
| Staging | `develop` | `cuartico-api-staging` | `staging` | `render/staging.yaml` | https://cuartico-api-staging.onrender.com | Sí (`SPRINGDOC_ENABLED=true`) |
| Producción | `main` | `cuartico-api` | `production` | `render/production.yaml` | https://cuartico-api.onrender.com | No |

- Infraestructura como código: los dos Blueprints de `render/`. Un cambio en `production.yaml` solo se aplica tras un release, porque el servicio está enlazado a `main`.
- Validar un Blueprint con `render blueprints validate <archivo>`.
- Render construye la imagen de `backend/Dockerfile` (plan gratuito, región Virginia) y despliega solo cuando los checks del CI pasan (`autoDeployTrigger: checksPass`).
- Health check: `/actuator/health`. El plan gratuito "duerme" el servicio tras unos 15 minutos sin uso; la primera petición puede tardar cerca de un minuto.
- Base de datos: PostgreSQL en Neon, usado solo como base de datos (no se usan Neon Auth ni Functions).

## Variables de entorno

Solo nombres y finalidad. Los valores reales no se documentan aquí: viven en Render (`prod`/staging), en
`application-dev.yml` y `application-test.yml` (solo local y tests) y en GitHub/CI para la base de datos efímera.

| Variable | Para qué | Local (`dev`) | Tests | Staging / producción |
|---|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Perfil de Spring | `dev` (por defecto) | `test` | `prod` (fijado en el Blueprint y el Dockerfile) |
| `DB_URL` | URL JDBC de Neon: `jdbc:postgresql://<host>/<db>?sslmode=require` (sin usuario ni contraseña) | No se usa | No se usa | Introducida a mano en Render (`sync: false`) |
| `DB_USERNAME` | Usuario de la base de datos de la rama | No se usa | No se usa | Introducida a mano en Render |
| `DB_PASSWORD` | Contraseña de la base de datos de la rama | No se usa | No se usa | Introducida a mano en Render |
| `APP_JWT_SECRET` | Secreto HMAC-SHA256 para firmar los JWT. Base64 de al menos 32 bytes. Distinto en cada entorno | En `application-dev.yml` | En `application-test.yml` | Lo genera Render (`generateValue`) |
| `APP_ADMIN_USERNAME` | Usuario del administrador inicial (solo si la tabla `users` está vacía) | En `application-dev.yml` | En `application-test.yml` | Fijado en el Blueprint |
| `APP_ADMIN_PASSWORD` | Contraseña del administrador inicial. Cambiarla tras el primer login | En `application-dev.yml` | En `application-test.yml` | Introducida a mano en Render (`sync: false`) |
| `APP_CORS_ORIGINS` | Orígenes permitidos por CORS para `/api/**` (por defecto `http://localhost:5173`) | Por defecto | Por defecto | Fijada en el Blueprint; sustituir por la URL del frontend en Vercel antes de abrir producción |
| `SPRINGDOC_ENABLED` | Activa Swagger UI y `/v3/api-docs` en `prod` (por defecto `false`) | Activo (en el yml) | Activo (en el yml) | Staging: `true`. Producción: sin definir (`false`) |
| `PORT` | Puerto HTTP | 8080 | 8080 | Lo inyecta Render |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | Sobrescriben la base de datos de tests | No se usa | Solo en el CI, variante `postgres` | No se usa |

Notas:
- `DB_*` no tienen valor por defecto a propósito: si faltan, el arranque falla en vez de caer en silencio sobre H2 en memoria.
- Para generar un secreto a mano: `openssl rand -base64 32`.
- Cambiar `APP_JWT_SECRET` invalida los access tokens vigentes. Los refresh tokens son opacos (se guardan hasheados) y no dependen de ese secreto.

## Perfiles

Detalle de cada perfil en [backend/README.md](../development/backend/README.md#perfiles). En resumen: `dev` (H2 en archivo, Swagger
activo), `test` (H2 en memoria, Swagger activo) y `prod` (PostgreSQL, todo por variables de entorno, Swagger según `SPRINGDOC_ENABLED`).

## CI: GitHub Actions

Archivo: `.github/workflows/backend-ci.yml`. Se ejecuta en `push` y en `pull_request` a `main` y `develop`, y a mano (`workflow_dispatch`).
Un push nuevo a la misma rama cancela la ejecución anterior.

| Job | Qué hace |
|---|---|
| `Tests (h2)` | `./mvnw -B verify` contra H2 en memoria (la configuración de `application-test.yml`). |
| `Tests (postgres)` | Lo mismo contra un PostgreSQL 18 real (contenedor del CI, misma versión mayor que Neon). Valida las migraciones Flyway en PostgreSQL. |
| `Docker build` | Construye la imagen (`push: false`) después de los tests. Render construye su propia imagen. |

Dentro de los tests, el CI comprueba que el log de Flyway contiene `Database: jdbc:h2` o `Database: jdbc:postgresql`, para evitar un verde
falso si la variante PostgreSQL acabara usando H2. Si falla un test, sube `backend/target/surefire-reports/` como artefacto (7 días).

> **Advertencia.** Los checks `Tests (h2)`, `Tests (postgres)` y `Docker build` son **obligatorios** en la protección de `main` y `develop`.
> No renombrar los jobs ni la clave `db` de la matriz sin actualizar la protección. No añadir filtros `paths:` al workflow: el check
> no se reportaría y los PRs quedarían bloqueados esperando.

Pendiente: fijar las actions a SHA de commit y activar Dependabot (TT-06 en el [backlog](../scrum/product-backlog.md)).

## Protección de ramas y flujo

- `main` (producción) y `develop` (integración y staging) están protegidas. Los tres checks anteriores son obligatorios.
- Nadie hace push directo ni force-push a estas ramas. Solo Lupa mergea, con las condiciones de la tabla de
  [CLAUDE.md](../../CLAUDE.md#quién-mergea-y-cuándo-solo-lupa-mergea).
- Flujo de una funcionalidad: `feature/<nombre>` desde `develop` → PR a `develop` (squash) → despliegue automático a staging.
- Flujo de un release: PR `develop` → `main` (merge commit) → Vera certifica en staging → despliegue automático a producción.
- Hotfix: `hotfix/<nombre>` desde `main` → PR a `main` → después se lleva a `develop`.

## Swagger UI y documentación

- `SPRINGDOC_ENABLED` decide si existen Swagger UI (`/swagger-ui.html`) y `/v3/api-docs`, en `prod`.
- Staging: activo, para que la supervisión y Vera prueben la API. Producción: desactivado; sin autenticación responde 401 y autenticado, 404.

## Errores de arranque habituales

Tabla completa en [deploy.md](deploy.md#errores-de-arranque-habituales). Resumen:

| Síntoma en los logs de Render | Causa probable |
|---|---|
| `'url' must start with "jdbc"` | Falta `DB_URL` o no empieza por `jdbc:postgresql://` |
| `Failed to configure a DataSource` | `DB_URL` vacía |
| `app.jwt.secret ... must not be blank` | Falta `APP_JWT_SECRET` |
| `password authentication failed` | `DB_USERNAME` / `DB_PASSWORD` incorrectos |
| El proceso se reinicia sin trazas de la JVM | Memoria: revisar `/actuator/metrics/jvm.memory.used` y los flags del `Dockerfile` |

## Pendientes de infraestructura

- Fijar actions a SHA y Dependabot (TT-06).
- Medir la memoria en staging y revisar los topes del `Dockerfile` (TT-09).
- `APP_CORS_ORIGINS` de producción, al tener frontend (TT-10).
- Acceso de solo lectura a Neon por MCP para Vera y Faro (TT-07).

Backlog completo: [product-backlog.md](../scrum/product-backlog.md).
