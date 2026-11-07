# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Secciones: `Added`, `Changed`, `Fixed`.

## [Sin publicar]

Cambios en `develop`, pendientes de la próxima release.

### Added
- Documentación OpenAPI con springdoc: Swagger UI en `/swagger-ui.html` y JSON en `/v3/api-docs` (activos en `dev` y `test`; en `prod` solo con `SPRINGDOC_ENABLED=true`). (PR #5)
- Códigos de error estables en la propiedad `code` de cada ProblemDetail, con `detail` traducido (es/en) según `Accept-Language`. Errores de validación con `errors` por campo. (PR #5)
- Panel `cuartico-web` (React 19 + TypeScript + Vite): pantalla de login, sesión con renovación automática del access token, layout con barra lateral, barra inferior y hoja de cuenta, textos en es/en y manifest PWA con iconos. La pantalla de productos es un marcador. (HU-01, PR #9)
- Ventana de gracia de 120 s en el refresh token: si la respuesta de `/api/v1/auth/refresh` se pierde por red, el reintento recibe un par nuevo en lugar de cerrar todas las sesiones del usuario. Migración `V2__refresh_token_grace.sql`. (HU-01, PR #9)
- Workflow `frontend-ci.yml` en GitHub Actions: lint, tests y build de `cuartico-web`. Todavía no es check obligatorio. (HU-01, PR #9)
- Sitio estático `cuartico-web-staging` en `render/staging.yaml` (rama `develop`), con rewrite de SPA y cabeceras de seguridad. (HU-01, PR #9)
- Documentación de análisis y diseño del sprint 1: historias HU-01, HU-02 y HU-14, ADR-001 (almacenamiento de tokens en el frontend) y ADR-002 (stock en caché), design system, prototipos de login y productos, y textos es/en. (PR #8)

### Changed
- Todos los endpoints bajo `/api/v1` (antes `/api/`). (PR #5)
- `/api/v1/auth/refresh` responde 200 cuando se reenvía un refresh token rotado dentro de la ventana de gracia de 120 s. Fuera de ella sigue respondiendo 401 `auth.refresh_invalid` y cierra las sesiones del usuario. (HU-01, PR #9)

### Fixed
- `PUT /api/v1/users/{id}` exige el campo `active`. Antes, omitirlo desactivaba al usuario y revocaba sus sesiones; ahora responde 400 `validation.failed`. (TT-11, PR #7)

## [0.1.0]

Primera release a producción. Certificada en staging el SHA `7e18b69` (ver [registro de certificaciones](docs/qa/certifications.md)).
Fecha: 2026-10-29. Release PR #4 (`develop` → `main`), merge commit `ab4b546`, certificado sobre `7e18b69`.

### Added
- Backend Spring Boot 4.1 con perfiles `dev`, `test` y `prod`, Flyway, ProblemDetail (RFC 9457) y auditoría de entidades.
- Usuarios con roles `ADMIN` y `OPERATOR`; login con JWT HS256; refresh tokens opacos con rotación y detección de reutilización.
- Imagen Docker (`backend/Dockerfile`) ajustada al plan gratuito de Render y workflow de GitHub Actions (tests con H2 y con PostgreSQL, build de la imagen).
- Blueprints de Render para staging (`develop`) y producción (`main`), con base de datos en Neon.
- Equipo de agentes y reglas del proyecto en `CLAUDE.md`.
