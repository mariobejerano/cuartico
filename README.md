# Cuartico

Sistema de gestión para un negocio cubano que vende **combos** de productos: stock, compras a proveedores,
combos, pedidos, pagos manuales, clientes, gastos y utilidad.

- **Cuartico** es el "cuartico de atrás": la herramienta interna de gestión (fase actual).
- **Combazo** es el mostrador: la marca y la tienda para clientes (fases 2 y 3), sobre la misma API y el mismo stock.

Proyecto personal de aprendizaje, desarrollado con un equipo de agentes de IA. Las reglas del proyecto están en
[`CLAUDE.md`](CLAUDE.md).

## Fases

1. **Cuartico**: gestión interna *(en curso: acceso al panel, catálogo de productos, categorías y variantes de producto; sprint 2 en curso)*.
2. **Combazo catálogo**: combos disponibles y "Pedir por WhatsApp".
3. **Combazo tienda**: "arma tu combo" y pedidos online.
4. **Móvil**: PWA y después app Android (React Native / Expo).

## Stack

- **Backend** (`backend/`): Java 17 · Spring Boot 4.1 · Spring Security 7 (JWT HS256) · JPA · Flyway · PostgreSQL (H2 en local).
- **Panel de gestión** (`cuartico-web/`): React 19 · TypeScript 6 · Vite 8 · React Router · TanStack Query · react-i18next (es/en).
  Implementado: login, sesión y layout (HU-01); catálogo de productos (HU-02); página de categorías y atributos por tipo en productos (HU-15); variantes talla × color con stock propio en productos (HU-16). Resto de pantallas de negocio pendientes.
- **Tienda** (`combazo-web/`): pendiente (fase 2).
- **Infraestructura** (planes gratuitos): GitHub y GitHub Actions · Render (backend en Docker y el panel como sitio estático) · Neon (PostgreSQL).

## Entornos desplegados

| Entorno | Servicio | URL | Rama |
|---|---|---|---|
| Producción (API) | `cuartico-api` | https://cuartico-api.onrender.com | `main` |
| Staging (API) | `cuartico-api-staging` | https://cuartico-api-staging.onrender.com | `develop` |
| Staging (panel) | `cuartico-web-staging` | https://cuartico-web-staging.onrender.com | `develop` |

Swagger UI de staging: https://cuartico-api-staging.onrender.com/swagger-ui.html (en producción está desactivado).
El panel de producción todavía no existe.

> Producción ejecuta todavía la release v0.1.0: rutas sin `/api/v1` y errores sin `code` ni traducción. Llegará con la próxima release.

## Arrancar en local

### Backend

Solo hace falta Java 17. El proyecto usa el Maven Wrapper y H2 en archivo (`backend/data/`, en modo PostgreSQL).

```bash
cd backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
./mvnw test                   # tests de integración
```

- API: http://localhost:8080 (rutas bajo `/api/v1`)
- Swagger UI: http://localhost:8080/swagger-ui.html · consola H2: http://localhost:8080/h2-console (solo perfil `dev`)
- Usuario administrador de desarrollo: definido en `backend/src/main/resources/application-dev.yml`.

### Panel (`cuartico-web`)

Requiere Node 24 (la misma versión que el CI). Con el backend ya arrancado:

```bash
cd cuartico-web
npm install                   # la primera vez
npm run dev                   # http://localhost:5173
```

- Sin configurar nada, el panel apunta a `http://localhost:8080`. Para cambiarlo, copia `.env.example` a `.env.local` y ajusta `VITE_API_BASE_URL`.
- `npm test -- --run` ejecuta los tests; `npm run lint` y `npm run typecheck` comprueban estilo y tipos.
- `npm run build` exige `VITE_API_BASE_URL` (si falta, falla a propósito).

Guía del frontend, comandos y convenciones: [`docs/development/frontend/README.md`](docs/development/frontend/README.md).
Perfiles y arquitectura del backend: [`docs/development/backend/README.md`](docs/development/backend/README.md).
Variables de entorno, CI y despliegue: [`docs/devops/README.md`](docs/devops/README.md).

## Estructura del repositorio

```
cuartico/
├── backend/        API REST (Spring Boot)
├── cuartico-web/   Panel de gestión (React + TypeScript + Vite): login, sesión, layout, catálogo de productos, categorías y variantes
├── combazo-web/    Tienda para clientes (fase 2, pendiente)
├── render/         Blueprints de Render (staging y producción)
├── docs/           Documentación por rol (ver docs/README.md)
├── .github/        Workflows de GitHub Actions (backend y frontend)
└── .claude/agents/ Definición del equipo de agentes
```

## Documentación

- [`docs/README.md`](docs/README.md): índice de toda la documentación.
- [`docs/development/backend/`](docs/development/backend/README.md): arquitectura, API, códigos de error.
- [`docs/development/frontend/`](docs/development/frontend/README.md): panel `cuartico-web`; [guía de aprendizaje](docs/development/frontend/learning/README.md) para quien viene de Java/Spring.
- [`docs/devops/README.md`](docs/devops/README.md): entornos, variables, CI y despliegue.
- [`docs/scrum/product-backlog.md`](docs/scrum/product-backlog.md): backlog del producto.
- [`CLAUDE.md`](CLAUDE.md): reglas de negocio, convenciones, flujo Git y equipo de agentes.
- [`CHANGELOG.md`](CHANGELOG.md): cambios por versión.
