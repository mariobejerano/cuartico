# Cuartico

Sistema de gestión para un negocio cubano que vende **combos** de productos: stock, compras a proveedores,
combos, pedidos, pagos manuales, clientes, gastos y utilidad.

- **Cuartico** es el "cuartico de atrás": la herramienta interna de gestión (fase actual).
- **Combazo** es el mostrador: la marca y la tienda para clientes (fases 2 y 3), sobre la misma API y el mismo stock.

Proyecto personal de aprendizaje, desarrollado con un equipo de agentes de IA. Las reglas del proyecto están en
[`CLAUDE.md`](CLAUDE.md).

## Fases

1. **Cuartico**: gestión interna *(en curso)*.
2. **Combazo catálogo**: combos disponibles y "Pedir por WhatsApp".
3. **Combazo tienda**: "arma tu combo" y pedidos online.
4. **Móvil**: PWA y después app Android (React Native / Expo).

## Stack

- **Backend** (`backend/`): Java 17 · Spring Boot 4.1 · Spring Security 7 (JWT HS256) · JPA · Flyway · PostgreSQL (H2 en local).
- **Frontend** (pendiente): `cuartico-web/` (panel) y `combazo-web/` (tienda) con React + TypeScript + Vite.
- **Infraestructura** (planes gratuitos): GitHub y GitHub Actions · Render (backend, Docker) · Neon (PostgreSQL) · Vercel (frontends).

## Entornos desplegados

| Entorno | URL | Rama |
|---|---|---|
| Producción | https://cuartico-api.onrender.com | `main` |
| Staging | https://cuartico-api-staging.onrender.com | `develop` |

Swagger UI de staging: https://cuartico-api-staging.onrender.com/swagger-ui.html (en producción está desactivado).

> Producción ejecuta todavía la release v0.1.0: rutas sin `/api/v1` y errores sin `code` ni traducción. Llegará con la próxima release.

## Arrancar el backend en local

Solo hace falta Java 17. El proyecto usa el Maven Wrapper y H2 en archivo (`backend/data/`, en modo PostgreSQL).

```bash
cd backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
./mvnw test                   # tests de integración
```

- API: http://localhost:8080 (rutas bajo `/api/v1`)
- Swagger UI: http://localhost:8080/swagger-ui.html · consola H2: http://localhost:8080/h2-console (solo perfil `dev`)
- Usuario administrador de desarrollo: definido en `backend/src/main/resources/application-dev.yml`.

Perfiles y arquitectura: [`docs/development/backend/README.md`](docs/development/backend/README.md). Variables de entorno, CI y despliegue: [`docs/devops/README.md`](docs/devops/README.md).

## Estructura del repositorio

```
cuartico/
├── backend/        API REST (Spring Boot)
├── cuartico-web/   Panel de gestión (pendiente)
├── combazo-web/    Tienda para clientes (fase 2+, pendiente)
├── render/         Blueprints de Render (staging y producción)
├── docs/           Documentación por rol (ver docs/README.md)
├── .github/        Workflows de GitHub Actions
└── .claude/agents/ Definición del equipo de agentes
```

## Documentación

- [`docs/README.md`](docs/README.md): índice de toda la documentación.
- [`docs/development/backend/`](docs/development/backend/README.md): arquitectura, API, códigos de error.
- [`docs/devops/README.md`](docs/devops/README.md): entornos, variables, CI y despliegue.
- [`docs/scrum/product-backlog.md`](docs/scrum/product-backlog.md): backlog del producto.
- [`CLAUDE.md`](CLAUDE.md): reglas de negocio, convenciones, flujo Git y equipo de agentes.
- [`CHANGELOG.md`](CHANGELOG.md): cambios por versión.
