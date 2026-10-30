# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Secciones: `Added`, `Changed`, `Fixed`.

## [Sin publicar]

Cambios en `develop`, pendientes de la próxima release.

### Added
- Documentación OpenAPI con springdoc: Swagger UI en `/swagger-ui.html` y JSON en `/v3/api-docs` (activos en `dev` y `test`; en `prod` solo con `SPRINGDOC_ENABLED=true`). (PR #5)
- Códigos de error estables en la propiedad `code` de cada ProblemDetail, con `detail` traducido (es/en) según `Accept-Language`. Errores de validación con `errors` por campo. (PR #5)

### Changed
- Todos los endpoints bajo `/api/v1` (antes `/api/`). (PR #5)

## [0.1.0]

Primera release a producción. Certificada en staging el SHA `7e18b69` (ver [registro de certificaciones](docs/qa/certifications.md)).
Fecha: 2026-10-29. Release PR #4 (`develop` → `main`), merge commit `ab4b546`, certificado sobre `7e18b69`.

### Added
- Backend Spring Boot 4.1 con perfiles `dev`, `test` y `prod`, Flyway, ProblemDetail (RFC 9457) y auditoría de entidades.
- Usuarios con roles `ADMIN` y `OPERATOR`; login con JWT HS256; refresh tokens opacos con rotación y detección de reutilización.
- Imagen Docker (`backend/Dockerfile`) ajustada al plan gratuito de Render y workflow de GitHub Actions (tests con H2 y con PostgreSQL, build de la imagen).
- Blueprints de Render para staging (`develop`) y producción (`main`), con base de datos en Neon.
- Equipo de agentes y reglas del proyecto en `CLAUDE.md`.
