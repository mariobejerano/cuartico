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
| `com.cuartico.product` | Catálogo de productos (HU-02): `Product`, `ProductVariant` y `VariantStock` (caché 1:1 de stock y costo por variante, ADR-002/003, HU-16), `UnitOfMeasure`, `ProductService`, `ProductController`. DTOs en `product/dto/ProductDtos.java`. |
| `com.cuartico.category` | Categorías en árbol (HU-15): `Category`, `ProductType`, `CategoryTree` (rutas y descendientes en memoria), `CategoryService`, `CategoryController`. DTOs en `category/dto/CategoryDtos.java`. |
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
  - `V3__products.sql`: `products` (SKU único `uk_products_sku`, checks de precio/moneda y cantidades, `version` para bloqueo optimista) y `product_stock` (1:1, creada con ceros; ver ADR-002). *V5 sustituyó `product_stock` por `variant_stock` y movió `sku`/`min_stock` a `product_variants`*. Moneda como `VARCHAR(3)`.
  - `V4__categories.sql` (HU-15): `categories` (árbol; `uk_categories_parent_name` = `UNIQUE NULLS NOT DISTINCT (parent_id, name_key)`), 4 raíces sembradas, migración del texto `products.category` (alias de CA-22) a `category_id NOT NULL`, columnas `brand`/`model`/`warranty_months` y `DROP COLUMN category`.
  - `V5__product_variants.sql` (HU-16): `product_variants` (`uk_product_variants_sku`, `uk_product_variants_options` = `UNIQUE NULLS NOT DISTINCT (product_id, size, color_key)`, `color_key` = `LOWER(TRIM(color))` calculado por la BD) y `variant_stock` (sustituye a `product_stock`); cada producto existente recibe su variante oculta con su SKU, umbral y stock (una fila de stock por variante aunque faltara la de `product_stock`); se eliminan `product_stock`, `products.sku` y `products.min_stock`; añade `products.has_variants`.
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
  - `category/CategoryIntegrationTests`, `category/CategoryMigrationTests` (V4 con datos sembrados, Flyway `target 3`) y `product/ProductCategoryTypeTests` (HU-15 productos y TT-14).
  - `common/MessageBundlesTests`: `messages_es` y `messages_en` tienen las mismas claves y ninguna vacía.
  - `config/OpenApiIntegrationTests`: documentación pública y rutas antiguas sin versión.
  - `config/ApiDocsDisabledIntegrationTests`: documentación cerrada cuando springdoc está desactivado.
- Comandos: `./mvnw test` (tests) y `./mvnw -q -B verify` (lo mismo que el CI).
- El CI ejecuta los tests dos veces: contra H2 y contra PostgreSQL real (ver [devops](../../devops/README.md)).

## Productos (HU-02): decisiones de implementación

- **Concurrencia**: bloqueo *optimista* (`@Version`) en `Product`. Editar el catálogo es una operación humana larga (abrir, editar, guardar) con conflictos raros; lo correcto es avisar al segundo editor (`409 resource.version_conflict`), no hacerle esperar. El servicio compara la versión enviada con la actual y, para la carrera residual al hacer flush, el `GlobalExceptionHandler` traduce `ObjectOptimisticLockingFailureException` al mismo código. El stock se bloqueará de forma pesimista en HU-04 sobre `variant_stock` (otra fila, otra versión).
- **`variant_stock` 1:1 con la variante** (V5; antes `product_stock`): `VariantStock` usa `@MapsId` (PK = `variant_id`); `ProductVariant` la referencia con `@OneToOne(mappedBy)` y cascade `PERSIST`. El alta crea variante y stock en la misma transacción. El listado agrega por producto con un `GROUP BY` por página (ver «Variantes»); el detalle carga las variantes con `join fetch` del stock.
- **SKU único** (en las variantes, `uk_product_variants_sku`; antes `uk_products_sku`): comprobación previa (`existsBySku*`) para un 409 claro y `saveAndFlush` capturando `DataIntegrityViolationException`; se reconoce el nombre de la restricción en la cadena de causas sin distinguir mayúsculas (PostgreSQL en minúsculas, H2 en mayúsculas); cualquier otra violación se relanza.
- **Normalización antes de validar**: en el constructor compacto de los records de entrada (strip, SKU en mayúsculas, vacío → `null`). La moneda no se normaliza a propósito (`usd` → `product.currency_unsupported`).
- **Listado**: `ProductQuery` con `@Valid @ModelAttribute` (no `Pageable`, que recortaría `size` en silencio). Búsqueda con `Specification` y `LIKE ... ESCAPE '\'` sobre `LOWER(name)` o `EXISTS` sobre `LOWER(sku)` de las variantes; `%`, `_` y `\` de `q` se escapan. Orden con lista blanca y desempate por `id`.
- **Escalas**: precio 2 decimales, cantidades 3, costo 4; las entidades fijan la escala para que el JSON sea estable (`0.000`).
- **Monedas**: `app.currencies.supported` y `app.currencies.reference` (`AppProperties.Currencies`, validado al arrancar: la de referencia debe estar entre las admitidas).
- Una edición que no cambia ningún valor no genera `UPDATE` y por tanto no incrementa `version` (comportamiento de JPA con entidades sin cambios).

## Categorías y tipos (HU-15, ADR-003): decisiones de implementación

- **Normalización en un solo sitio, la BD**: `name_key = LOWER(TRIM(name))`. La migración V4 lo calcula en SQL y la entidad lo escribe con `@ColumnTransformer(write = "lower(trim(?))")`; el Service comprueba duplicados con `lower(trim(:name))` en la consulta. `Lacteos` y `Lácteos` no chocan (LOWER no quita tildes; el frontend avisa). Requisito en Neon: `SHOW lc_ctype` distinto de `C`/`POSIX`.
- **Unicidad**: `UNIQUE NULLS NOT DISTINCT` cubre también las raíces. Comprobación previa para un 409 claro y `saveAndFlush` capturando `uk_categories_parent_name` (la restricción es la garantía en carrera).
- **Concurrencia**: renombrar usa bloqueo optimista (`@Version`, como productos). Crear hija, desactivar y activar usan **bloqueo pesimista** (`PESSIMISTIC_WRITE`) sobre la fila del padre / de la propia categoría, siempre padre antes que hijo (sin deadlock): cierra la carrera «alguien crea una hija activa mientras otro desactiva al padre», que ninguna restricción puede expresar. Son operaciones raras.
- **Árbol en memoria**: `CategoryService.tree()` carga todas las categorías (decenas) y `CategoryTree` calcula `path`/`pathEn`, el tipo, los descendientes (filtro `categoryId`) y el orden del listado (por niveles, sin distinguir mayúsculas, para que el padre preceda siempre a sus hijas). `ProductService` lo usa en vez de un `JOIN FETCH` de la categoría: la respuesta solo necesita su id (`getId()` de un proxy no la carga), así que tampoco hay N+1.
- **`productCount`**: una consulta `GROUP BY category_id` (`CategoryRepository.countProductsByCategory`; referencia `Product` solo por nombre en JPQL: el módulo `category` no importa `product`).
- **Tipo derivado**: no se guarda en el producto; `ProductResponse.type` sale de la categoría. Las reglas por tipo (`ProductType.allowsModelAndWarranty()`, `requiresUnitOnly()`) viven en el enum; el Service valida y **nunca anula atributos por su cuenta**.
- **Categoría inactiva**: se rechaza al crear o al cambiar a ella (`category.inactive`); un producto que ya está en una inactiva se puede editar si no cambia de categoría.
- **`GET /products/categories` retirado**: un manejador `@Hidden` responde 404 `request.not_found`; sin él la ruta caería en `/{id}` y daría 400 por «id no numérico».
- **Orden**: `sort` admite `name` y `createdAt` (`sku` y `category` retirados: HU-16 CA-17).
- **Enteros estrictos**: `spring.jackson.deserialization.accept-float-as-int=false`; `warrantyMonths: 1.5` es 400 y no se trunca a 1.

### TT-14
- **SKU**: se pasa a mayúsculas **solo si el valor ya es válido** (`[A-Za-z0-9._-]*`). Si no, se deja tal cual y falla el `@Pattern`: `ß` (que sería `SS`), `ı` (`I`) o `ſ` (`S`) dan 400 `validation.failed` (`errors.sku`) en lugar de colarse como SKU válidos.
- **Activar/desactivar idempotente también en carrera** (productos): `setActive` corre sin transacción y cada intento usa su propio `TransactionTemplate`; quien pierde la carrera optimista reintenta (máx. 3) y lee el estado ya cambiado: 200 sin nueva versión. Las categorías lo resuelven con el bloqueo pesimista.

## Variantes (HU-16, ADR-003): decisiones de implementación

- **Sin colección `Product.variants`**: las variantes se leen y escriben siempre por `ProductVariantRepository`; así ninguna operación de variantes puede subir la `version` del producto por accidente (CA-13b). Es el equivalente, más simple, del `@OptimisticLock(excluded = true)` previsto.
- **Concurrencia**: añadir, editar, activar/desactivar variantes, convertir (enable/disable) y el `PUT` del producto toman primero `PESSIMISTIC_WRITE` sobre la fila del producto (`findByIdForUpdate`, sin incrementar versión) y después tocan variantes: orden fijo producto -> variante. Cierra `disable` cruzado con un alta de variante (un «simple» con dos variantes) y serializa activar/desactivar (idempotente sin reintentos). La unicidad final es de la BD: `uk_product_variants_sku` -> `product.sku_conflict`, `uk_product_variants_options` -> `variant.options_conflict` (`Rojo`/`rojo` en carrera: una 201 y una 409, nunca 500). Cada variante se guarda con `saveAndFlush` para atribuir la violación a su variante.
- **Versión del producto simple**: el `PUT` de un simple actualiza también su variante oculta; si cambia solo la variante (SKU/umbral) se sube la versión del producto con `PESSIMISTIC_FORCE_INCREMENT` (la versión que manda es la del producto). Un `PUT` sin cambios no sube nada.
- **Comprobación previa de opciones en Java** (`size` + `color` en minúsculas, `Locale.ROOT`) solo para dar un 409 amistoso; la restricción sobre `color_key` es la garantía.
- **Agregado (CA-15)**: `VariantAggregate`. Listado: una consulta `GROUP BY` por página (`aggregateByProductIds`); detalle: la misma fórmula en Java. Costo ponderado = Σ(onHand·costo)/Σ onHand de las variantes con costo, 4 decimales `HALF_UP`, `null` si Σ = 0. `lowStock` solo con variantes activas y producto activo.
- **Orden de `variants[]`** (CA-14): `VariantOrder`; colación `es` de fuerza primaria para tallas «otras» y colores.
- **Errores de campo desde el Service**: `FieldValidationException` produce el mismo 400 `validation.failed` + `errors` que `@Valid` (p. ej. `errors.minStock` en un simple sin umbral, `errors.variants`).
- **Tests**: `ProductVariantIntegrationTests` (CA-1..CA-20), `ProductVariantMigrationTests` (CA-18/19 con datos, usa `testsupport/MigrationDb`, que en el job PostgreSQL crea un esquema propio) y `ProductVariantConcurrencyTests`.
