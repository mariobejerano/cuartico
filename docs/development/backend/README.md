# Backend: arquitectura

Responsable: Forja-Back. Stack: Java 17 · Spring Boot 4.1.1 · Spring Security 7 · Spring Data JPA · Flyway · PostgreSQL (H2 en local).
Build con Maven Wrapper (`backend/mvnw`), sin Lombok.

Documentos relacionados: [API](api.md) · [Códigos de error](errors.md).

## Paquetes

Paquetes por módulo, no por capa. Lo transversal va en `config/` y `common/`.

| Paquete | Contenido |
|---|---|
| `com.cuartico.auth` | Login, refresh tokens (rotación), emisión de JWT de acceso, limpieza nocturna. DTOs en `auth/dto/AuthDtos.java`. |
| `com.cuartico.user` | Usuarios y roles (`Role`: `ADMIN`, `OPERATOR`), administración de usuarios, admin inicial. DTOs en `user/dto/UserDtos.java`. |
| `com.cuartico.common` | `ApiException` (y fábricas), `GlobalExceptionHandler`, `ProblemFactory`, `AuditableEntity`. |
| `com.cuartico.config` | Seguridad, JWT, CORS, i18n de mensajes, OpenAPI, propiedades `app.*` (`AppProperties`), `Clock`, auditoría JPA. |

Módulos previstos (productos, combos, pedidos…) se añadirán con la misma estructura cuando lleguen sus historias.

## Capas

`Controller` → `Service` → `Repository`.

- La lógica de negocio vive en el **Service**, con `@Transactional` (los servicios de lectura usan `readOnly = true`).
- Los **DTOs son `record`**. Las entidades JPA nunca salen por la API.
- Validación de entrada con Bean Validation (`@Valid` en el controlador).
- Errores de negocio: se lanza `ApiException` (o sus fábricas `notFound`, `conflict`, `badRequest`, `unauthorized`).
- Inyección por constructor. El tiempo se obtiene del bean `Clock` (`AppConfig`), nunca de `Instant.now()` directo, para poder simularlo en tests.

## Seguridad

Ver también la [API](api.md) para el detalle de cada endpoint.

**Access token (JWT)**
- Firmado con HMAC-SHA256 (HS256) por la propia app (Spring Security OAuth2 Resource Server + Nimbus). Caduca a los 15 min (`app.jwt.access-token-ttl`).
- No se guarda en base de datos.
- Claims: `sub` (username), `uid`, `name`, `roles` (p. ej. `ADMIN`). El claim `roles` se convierte en authorities `ROLE_*`.
- Validación: firma, expiración y emisor (`app.jwt.issuer`).

**Refresh token**
- Valor aleatorio opaco de 32 bytes (no es JWT). Caduca a los 7 días (`app.jwt.refresh-token-ttl`).
- En la tabla `refresh_tokens` solo se guarda el **hash SHA-256**.
- **Rotación**: cada `/refresh` revoca el token usado y entrega uno nuevo.
- **Detección de reutilización**: si llega un token ya revocado, se revocan todas las sesiones del usuario
  (la revocación se guarda aunque luego se responda 401: `noRollbackFor`).
- Cambiar la contraseña (propia o restablecida por un admin) y desactivar un usuario revocan sus sesiones.
- Limpieza: `RefreshTokenCleanupJob` borra cada noche (03:00) los tokens expirados.

**Cadenas de filtros** (`SecurityConfig`)
- `@Order(1)`, solo perfil `dev`: consola H2 (`/h2-console/**`), sin JWT.
- `@Order(2)`: API. Sin sesiones (`STATELESS`), sin CSRF (la API va por cabecera, no por cookies), CORS solo para `/api/**`.
- Por defecto, todo requiere autenticación. Públicos: login, refresh, logout, `/actuator/health`, `/error`, y la documentación
  OpenAPI cuando está habilitada.

**Roles**
- `@EnableMethodSecurity` activo. `UserController` lleva `@PreAuthorize("hasRole('ADMIN')")` a nivel de clase.
- `ADMIN`: gestiona usuarios. `OPERATOR`: operación diaria (sin endpoints propios todavía).

**Login**
- Usa `AuthenticationManager` con `DaoAuthenticationProvider` sobre la tabla `users` (`AppUserDetailsService`).
- Contraseñas con `DelegatingPasswordEncoder`: `{bcrypt}` por defecto, con prefijo para poder migrar de algoritmo.
- Usuario inexistente, contraseña errónea o usuario desactivado responden lo mismo (`auth.invalid_credentials`).

**Actuator**: se exponen `health` e `info`. Solo `/actuator/health` es público; `/actuator/info` requiere autenticación.

## Auditoría

- `AuditableEntity` (`@MappedSuperclass`) añade `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
- `JpaAuditingConfig` rellena `createdBy`/`updatedBy` con el usuario del JWT. Sin usuario autenticado escribe `system`.
- Entidades que la usan: `User`. (`RefreshToken` no extiende la clase: solo guarda `createdAt`.)

## Base de datos y Flyway

- Esquema **solo por Flyway**: migraciones en `backend/src/main/resources/db/migration/V<n>__descripcion.sql`.
  SQL compatible con PostgreSQL y con H2 en modo PostgreSQL.
- `spring.jpa.hibernate.ddl-auto=validate`: Hibernate valida el esquema, no lo crea.
- Nunca modificar una migración ya mergeada: se crea una nueva.
- Migraciones actuales:
  - `V1__users_and_refresh_tokens.sql`: tablas `users` (con auditoría) y `refresh_tokens` (con índice por usuario).
- Al arrancar con la tabla `users` vacía, `AdminInitializer` crea el administrador inicial con `APP_ADMIN_USERNAME` /
  `APP_ADMIN_PASSWORD`. Si faltan, avisa en el log y no se crea nadie: como crear usuarios exige ser ADMIN, sin
administrador inicial no hay forma de entrar por la API.

## Perfiles

| Perfil | Activación | Base de datos | Configuración |
|---|---|---|---|
| `dev` | Por defecto (`spring.profiles.default`) | H2 en archivo `./data/cuartico` (modo PostgreSQL) | `application-dev.yml`: consola H2, Swagger activo, log `com.cuartico` en DEBUG. Secreto JWT y admin de desarrollo en el propio archivo. |
| `test` | Tests (`@ActiveProfiles("test")`) | H2 en memoria | `application-test.yml`. Swagger activo. El CI puede sobrescribir la base con variables `SPRING_DATASOURCE_*` para PostgreSQL real. |
| `prod` | `SPRING_PROFILES_ACTIVE=prod` (Dockerfile) | PostgreSQL (Neon) | `application-prod.yml`: todo desde variables de entorno. Sin base embebida, sin detalles de excepciones en la respuesta, Swagger según `SPRINGDOC_ENABLED`. |

Variables de entorno y su uso por entorno: [`docs/devops/README.md`](../../devops/README.md).

`application.yml` (común): `open-in-view: false`, `ddl-auto: validate`, puerto desde `PORT` (lo inyecta Render), TTL de tokens,
CORS desde `APP_CORS_ORIGINS` (por defecto `http://localhost:5173`).

## Errores

Todo error de la API sale como **ProblemDetail (RFC 9457)** con una propiedad `code` estable y un `detail` traducido.
Detalle completo en [errors.md](errors.md).

## Documentación OpenAPI

- springdoc 3.2.0. Swagger UI en `/swagger-ui.html`, JSON en `/v3/api-docs`.
- Activos en `dev` y `test`. En `prod` solo si `SPRINGDOC_ENABLED=true` (staging lo tiene; producción no).
- El esquema `bearerAuth` (HTTP bearer JWT) permite pulsar «Authorize» en Swagger UI tras hacer login.
- La versión que muestra la documentación sale de `build-info` de Maven.

## Tests

- Tests de integración con **MockMvc** y perfil `test`. Cada funcionalidad debe cubrir el camino feliz y los errores.
- Clases actuales (en `backend/src/test/java/com/cuartico/`):
  - `auth/AuthFlowIntegrationTests`: login, `/me`, rotación y detección de reutilización, logout, gestión de usuarios por roles.
  - `common/ErrorHandlingIntegrationTests`: códigos y traducción de errores, 400/401/403/404/405/415/500.
  - `common/MessageBundlesTests`: `messages_es` y `messages_en` tienen las mismas claves y ninguna vacía.
  - `config/OpenApiIntegrationTests`: documentación pública y rutas antiguas sin versión.
  - `config/ApiDocsDisabledIntegrationTests`: documentación cerrada cuando springdoc está desactivado.
- Comandos: `./mvnw test` (tests) y `./mvnw -q -B verify` (lo mismo que el CI).
- El CI ejecuta los tests dos veces: contra H2 y contra PostgreSQL real (ver [devops](../../devops/README.md)).
