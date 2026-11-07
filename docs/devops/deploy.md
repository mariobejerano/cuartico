# Despliegue del backend (Render + Neon)

## Arquitectura

| Entorno | Rama Git | Servicio Render | Rama Neon |
|---|---|---|---|
| Staging | `develop` | `cuartico-api-staging` | `staging` |
| Producción | `main` | `cuartico-api` | `production` |

- Definido como código en **dos Blueprints**: [`render/staging.yaml`](../../render/staging.yaml) (enlazado a `develop`) y [`render/production.yaml`](../../render/production.yaml) (enlazado a `main`).
  Así, un cambio de infraestructura de producción solo se aplica tras un release. Validar con `render blueprints validate <archivo>`.
- Docker (`backend/Dockerfile`), plan gratuito, región Virginia (junto a Neon `aws-us-east-1`).
- Render despliega solo cuando los checks del CI pasan en la rama correspondiente (`autoDeployTrigger: checksPass`).
- Health check: `/actuator/health`. El plan gratuito "duerme" el servicio tras ~15 min sin uso; la primera petición tarda ~1 min.

## Alta inicial (una sola vez)

1. Render → **New → Blueprint** → repo `mariobejerano/cuartico`, rama `develop`, **Blueprint Path** `render/staging.yaml`.
   Repetir con rama `main` y path `render/production.yaml` (producción, cuando haya el primer release).
2. Render pide las variables marcadas `sync: false` del servicio. Las introduce la supervisión, copiándolas del panel de Neon
   (**Connect** → elegir la rama → formato *Java* / parámetros sueltos):

   | Variable | Valor |
   |---|---|
   | `DB_URL` | `jdbc:postgresql://<host-de-la-rama>/neondb?sslmode=require` (sin usuario ni contraseña) |
   | `DB_USERNAME` | usuario de la rama (p. ej. `neondb_owner`) |
   | `DB_PASSWORD` | contraseña de la rama |
   | `APP_ADMIN_PASSWORD` | contraseña del primer admin (cambiarla tras el primer login) |

   `APP_JWT_SECRET` lo genera Render (distinto por servicio). Nunca se escriben secretos en el repo ni en el chat.
3. Crear el Blueprint. El primer despliegue aplica las migraciones Flyway en la base de esa rama y crea el admin inicial.

## Errores de arranque habituales

| Síntoma en los logs de Render | Causa |
|---|---|
| `'url' must start with "jdbc"` | Falta `DB_URL` o no empieza por `jdbc:postgresql://` |
| `Failed to configure a DataSource` | `DB_URL` está vacía |
| `app.jwt.secret ... must not be blank` | Falta `APP_JWT_SECRET` |
| `Illegal base64 character` o `al menos 256 bits` | `APP_JWT_SECRET` mal formado (debe ser Base64 estándar de ≥ 32 bytes; comprobar en el primer arranque de staging) |
| `password authentication failed` | `DB_USERNAME` / `DB_PASSWORD` incorrectos |
| El proceso se reinicia sin logs de la JVM | Memoria: revisar `/actuator/metrics/jvm.memory.used` y los flags del Dockerfile |

> Antes de abrir producción a usuarios: cambiar `APP_CORS_ORIGINS` en `render/production.yaml` por la URL del frontend de producción (sitio estático de Render).

## Frontend `cuartico-web` (sitio estático de Render)

| Entorno | Rama Git | Servicio Render | URL |
|---|---|---|---|
| Staging | `develop` | `cuartico-web-staging` | https://cuartico-web-staging.onrender.com |
| Producción | `main` | pendiente (se añade a `render/production.yaml` con el primer release del frontend) | |

- Definido en el mismo Blueprint de staging ([`render/staging.yaml`](../../render/staging.yaml)): `runtime: static`, `rootDir: cuartico-web`,
  build `npm ci && npm run build`, publica `dist/`, despliega solo con los checks en verde.
- `VITE_API_BASE_URL` (sin barra final) se fija en el Blueprint; el build falla si falta, a propósito.
- Rewrite `/* → /index.html` para las rutas del SPA.
- Cabeceras: `Content-Security-Policy` (ADR-001 §6: `script-src 'self'`, `connect-src` limitado a la API, `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'self'`), `X-Content-Type-Options` y `Referrer-Policy`.
- La URL del sitio debe estar en `APP_CORS_ORIGINS` del backend del mismo entorno.
- Los sitios estáticos de Render no duermen; el backend sí (la pantalla de login avisa a los 5 s).
- Alta: al sincronizar el Blueprint de staging tras el merge, Render crea el servicio nuevo (puede pedir confirmación en el panel).
