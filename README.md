# Cuartico

Sistema de gestión para un negocio que vende **combos** de productos: stock, compras a proveedores,
combos, pedidos, pagos, clientes, gastos y utilidad.

- **Cuartico** es el "cuartico de atrás": la herramienta interna de gestión.
- **Combazo** es el mostrador: la marca y la tienda para clientes (fases 2 y 3), sobre la misma API y el mismo stock.

Proyecto personal de aprendizaje, desarrollado con un equipo de agentes de IA (ver [`CLAUDE.md`](CLAUDE.md)).

## Estructura

```
cuartico/
├── backend/        API REST · Java 17 · Spring Boot 4.1 · Spring Security 7 (JWT) · Flyway · PostgreSQL
├── cuartico-web/   Panel de gestión · React + TypeScript (pendiente)
├── combazo-web/    Tienda para clientes · React + TypeScript (fase 2+)
├── docs/           Historias, decisiones (ADR), diseño, guías, diagramas
└── .claude/agents/ Equipo de agentes: Faro, Lienzo, Forja-Back, Forja-Front, Vera, Lupa, Pluto
```

## Fases

1. **Cuartico**: gestión interna *(en curso)*.
2. **Combazo catálogo**: combos disponibles + "Pedir por WhatsApp".
3. **Combazo tienda**: "arma tu combo" y pedidos online.
4. **Móvil**: PWA y luego app Android (React Native).

## Modelo de negocio (fase 1)

- **Productos**: lo que se compra suelto. El stock vive aquí, con **movimientos de inventario** trazables
  (entrada, reserva, salida, ajuste) y costo promedio ponderado.
- **Combos**: catálogo. Cada combo es una receta (producto × cantidad) con un precio; se arma al vender.
- **Compras** a proveedores: suman stock.
- **Pedidos**: pendiente → confirmado → en camino → entregado (o cancelado). Reservan y luego descuentan stock.
- **Pagos** registrados a mano, independientes del pedido: sin pagar → pago parcial → pagado. Multimoneda (CUP, USD…) con tasa del día.
- **Clientes**, **Proveedores**, **Gastos**.
- **Panel**: ventas, costo, gastos y utilidad del mes; stock bajo; cuentas por cobrar.

## Infraestructura (planes gratuitos)

| Pieza | Servicio |
|---|---|
| Código y CI/CD | GitHub + GitHub Actions |
| Backend | Render (Docker) · staging (`develop`) y producción (`main`) |
| Base de datos | Neon (PostgreSQL) · rama `staging` y rama principal |
| Frontend | Vercel |

Flujo Git: `feature/*` → PR a `develop` → staging → PR a `main` (con aprobación) → producción.

## Backend: arrancar en local

No necesita instalar nada además de Java 17: usa el Maven Wrapper y H2 en archivo
(`backend/data/`, en modo compatible con PostgreSQL).

```bash
cd backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
./mvnw test                   # tests de integración
```

- API: http://localhost:8080
- Consola H2 (solo perfil `dev`): http://localhost:8080/h2-console (JDBC URL en `application-dev.yml`)
- Usuario admin inicial de desarrollo: ver `backend/src/main/resources/application-dev.yml`
- Peticiones de ejemplo: `backend/requests.http`

### Perfiles

| Perfil | Base de datos | Secretos |
|---|---|---|
| `dev` (por defecto) | H2 en archivo | En `application-dev.yml` (solo para desarrollo) |
| `prod` | PostgreSQL | Variables de entorno: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `APP_JWT_SECRET`, `APP_ADMIN_USERNAME`, `APP_ADMIN_PASSWORD`, `APP_CORS_ORIGINS` (y `PORT`, que inyecta Render) |

Generar un secreto JWT para producción: `openssl rand -base64 32`. En Neon, `DB_URL` tiene la forma `jdbc:postgresql://<host>/<db>?sslmode=require` (usuario y contraseña van aparte).

Imagen Docker: `backend/Dockerfile` (ajustada a los 512 MB del plan gratuito de Render). CI: `.github/workflows/backend-ci.yml` (tests con H2 y con PostgreSQL real, y build de la imagen).

## Seguridad

- **Access token**: JWT firmado con HS256, dura 15 min, no se guarda en BD.
  Claims: `sub` (username), `uid`, `name`, `roles`.
- **Refresh token**: valor aleatorio opaco, dura 7 días, se guarda **hasheado** (SHA-256).
  - **Rotación**: cada `/refresh` invalida el token usado y entrega uno nuevo.
  - **Detección de reutilización**: si llega un refresh token ya usado, se revocan todas las
    sesiones del usuario.
  - Cambiar o restablecer contraseña, o desactivar un usuario, revoca sus sesiones.
- **Roles**: `ADMIN` (gestiona usuarios) y `OPERATOR` (operación diaria).
- **Errores**: siempre en formato ProblemDetail (RFC 9457), con `errors` por campo en validaciones.
- **Auditoría**: las entidades que extienden `AuditableEntity` guardan `createdBy`/`updatedBy`
  automáticamente con el usuario del token.

### Endpoints

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/login` | público |
| POST | `/api/auth/refresh` | público (requiere refresh token) |
| POST | `/api/auth/logout` | público (requiere refresh token) |
| GET | `/api/auth/me` | autenticado |
| POST | `/api/auth/change-password` | autenticado |
| GET/POST | `/api/users` | ADMIN |
| GET/PUT | `/api/users/{id}` | ADMIN |
| POST | `/api/users/{id}/reset-password` | ADMIN |
| GET | `/actuator/health` | público |

## Backlog

**Base**
- [x] Arquitectura base del backend (perfiles, Flyway, ProblemDetail, auditoría)
- [x] Usuarios, login JWT, refresh tokens con rotación, roles
- [x] Equipo de agentes y `CLAUDE.md`
- [x] Repositorio en GitHub, ramas `main`/`develop` y protección de ramas
- [x] Dockerfile y CI con GitHub Actions
- [ ] Despliegue: Render (staging y producción) + Neon
- [ ] i18n del backend (códigos de error + mensajes es/en)
- [ ] API versionada `/api/v1` y documentación OpenAPI

**Fase 1: Cuartico**
- [ ] Catálogos: Productos, Proveedores, Clientes
- [ ] Combos (receta, costo, margen, combos disponibles según stock)
- [ ] Compras y movimientos de inventario
- [ ] Pedidos (estados y reservas de stock)
- [ ] Pagos manuales multimoneda
- [ ] Gastos
- [ ] Panel / reportes
- [ ] Frontend `cuartico-web` (React): login, layout, pantallas, panel, PWA

**Más adelante**
- [ ] Fase 2: Combazo catálogo + WhatsApp
- [ ] Fase 3: Combazo tienda
- [ ] Fase 4: apps móviles
