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
| `com.cuartico.product` | Catálogo de productos (HU-02): `Product`, `ProductStock` (caché 1:1 de stock y costo, ADR-002), `UnitOfMeasure`, `ProductService`, `ProductController`. DTOs en `product/dto/ProductDtos.java`. |
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
- **Rotación**: cada `/refresh` revoca el token usado (`revoked_reason = ROTATED`), entrega uno nuevo y enlaza `replaced_by_id`.
- **Detección de reutilización**: si llega un token ya revocado sin derecho a gracia, se revocan todas las sesiones del usuario
  (`REUSE_DETECTED`; la revocación se guarda aunque luego se responda 401: `noRollbackFor`).
- **Ventana de gracia**: ver la sección siguiente.
- Cambiar la contraseña (propia o restablecida por un admin) y desactivar un usuario revocan sus sesiones.
- Limpieza: `RefreshTokenCleanupJob` borra cada noche (03:00) los tokens expirados.

**Ventana de gracia del refresh (HU-01 CA-28..33, ADR-001)**
- Problema: con red inestable el servidor rota el refresh y la respuesta se pierde; el reintento con el token anterior se tomaba por robo.
- `app.jwt.refresh-reuse-grace` (por defecto 120 s). Se aplica solo si el token presentado `T` está `ROTATED`, `now - T.revoked_at <= 120 s`
  (inclusivo), no ha caducado, el usuario está activo y su sucesor `S` (`replaced_by_id`) sigue sin revocar. Entonces `S` pasa a `SUPERSEDED`,
  se emite un par nuevo `N` y `T.replaced_by_id = N`; `T.revoked_at` no cambia (la ventana no se alarga con reintentos) y la cadena
  tiene siempre un único token vivo. Si no, es reutilización.
- Motivos (`RevocationReason`, columna `revoked_reason`): `ROTATED`, `SUPERSEDED`, `LOGOUT`, `PASSWORD_CHANGE`, `PASSWORD_RESET`,
  `USER_DISABLED`, `REUSE_DETECTED`. `revokeAll` solo toca filas sin revocar, así que las ya revocadas conservan su motivo (clave para que
  una desactivación, cambio de contraseña o logout posteriores a la rotación impidan la gracia). Revocados antes de V2: motivo `NULL`, sin gracia.
- **Concurrencia (decisión)**: bloqueo *pesimista* (`PESSIMISTIC_WRITE`, `SELECT ... FOR UPDATE`) y no optimista: aquí un conflicto no se
  resuelve reintentando, sino serializando, y la segunda petición debe ver el resultado de la primera para decidir (gracia o robo). Orden fijo
  presentado -> sucesor, así no hay ciclos. `logout` (`revoke`) usa la misma búsqueda con bloqueo para no pisar `ROTATED`/`replaced_by_id`.
  Las decisiones se toman con los datos leídos tras cada bloqueo. Con dos peticiones simultáneas (mismo token, o token viejo y sucesor) queda
  como mucho un token vivo; los tests lo verifican con dos hilos.
- Log `warn` (en inglés, con el usuario, nunca el token) al aplicar la gracia y al detectar reutilización.

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
- Entidades que la usan: `User`, `Product`. (`RefreshToken` no extiende la clase: solo guarda `createdAt`.)

## Base de datos y Flyway

- Esquema **solo por Flyway**: migraciones en `backend/src/main/resources/db/migration/V<n>__descripcion.sql`.
  SQL compatible con PostgreSQL y con H2 en modo PostgreSQL.
- `spring.jpa.hibernate.ddl-auto=validate`: Hibernate valida el esquema, no lo crea.
- Nunca modificar una migración ya mergeada: se crea una nueva.
- Migraciones actuales:
  - `V1__users_and_refresh_tokens.sql`: tablas `users` (con auditoría) y `refresh_tokens` (con índice por usuario).
  - `V2__refresh_token_grace.sql`: `refresh_tokens.revoked_reason`, `replaced_by_id` (FK a sí misma, `ON DELETE SET NULL`) e índice `idx_refresh_tokens_replaced_by`.
  - `V3__products.sql`: `products` (SKU único `uk_products_sku`, checks de precio/moneda y cantidades, `version` para bloqueo optimista) y `product_stock` (1:1, PK = `product_id`, creada con ceros; ver ADR-002). Moneda como `VARCHAR(3)`.
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
  - `product/ProductIntegrationTests`: HU-02 completa (alta, normalización, SKU duplicado y en carrera, validación y errores de tipo, moneda, edición, versión, activar/desactivar, listado, búsqueda, paginación, orden, categorías, roles, i18n es/en).
  - `common/MessageBundlesTests`: `messages_es` y `messages_en` tienen las mismas claves y ninguna vacía.
  - `config/OpenApiIntegrationTests`: documentación pública y rutas antiguas sin versión.
  - `config/ApiDocsDisabledIntegrationTests`: documentación cerrada cuando springdoc está desactivado.
- Comandos: `./mvnw test` (tests) y `./mvnw -q -B verify` (lo mismo que el CI).
- El CI ejecuta los tests dos veces: contra H2 y contra PostgreSQL real (ver [devops](../../devops/README.md)).

## Productos (HU-02): decisiones de implementación

- **Concurrencia**: bloqueo *optimista* (`@Version`) en `Product`. Editar el catálogo es una operación humana larga (abrir, editar, guardar) con conflictos raros; lo correcto es avisar al segundo editor (`409 resource.version_conflict`), no hacerle esperar. El servicio compara la versión enviada con la actual y, para la carrera residual al hacer flush, el `GlobalExceptionHandler` traduce `ObjectOptimisticLockingFailureException` al mismo código. El stock se bloqueará de forma pesimista en HU-04 sobre `product_stock` (otra fila, otra versión).
- **`product_stock` 1:1**: `ProductStock` usa `@MapsId` (PK = `product_id`); `Product` la referencia con `@OneToOne(mappedBy)` y cascade `PERSIST`. El alta crea ambas filas en la misma transacción. El listado trae producto y stock con `join fetch` (una consulta, sin N+1); el conteo de la paginación va sin `fetch`.
- **SKU único**: comprobación previa (`existsBySku*`) para un 409 claro y `saveAndFlush` capturando `DataIntegrityViolationException`; se reconoce `uk_products_sku` en la cadena de causas sin distinguir mayúsculas (PostgreSQL lo informa en minúsculas, H2 en mayúsculas); cualquier otra violación se relanza.
- **Normalización antes de validar**: en el constructor compacto de los records de entrada (strip, SKU en mayúsculas, vacío → `null`). La moneda no se normaliza a propósito (`usd` → `product.currency_unsupported`).
- **Listado**: `ProductQuery` con `@Valid @ModelAttribute` (no `Pageable`, que recortaría `size` en silencio). Búsqueda con `Specification` y `LIKE ... ESCAPE '\'` sobre `LOWER(name)`/`LOWER(sku)`; `%`, `_` y `\` de `q` se escapan. Orden con lista blanca y desempate por `id`.
- **Escalas**: precio 2 decimales, cantidades 3, costo 4; las entidades fijan la escala para que el JSON sea estable (`0.000`).
- **Monedas**: `app.currencies.supported` y `app.currencies.reference` (`AppProperties.Currencies`, validado al arrancar: la de referencia debe estar entre las admitidas).
- Una edición que no cambia ningún valor no genera `UPDATE` y por tanto no incrementa `version` (comportamiento de JPA con entidades sin cambios).
