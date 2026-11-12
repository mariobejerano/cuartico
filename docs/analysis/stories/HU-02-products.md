# HU-02: Catálogo de productos

- **Sprint:** 1 · **Estado:** implementada, QA APTO, en revisión; prototipo aprobado ([`products.html`](../../design/prototypes/products.html), [notas UX](../../design/ux-notes/products.md))
- **Alcance:** backend (módulo `product`, migración V3) y frontend (`cuartico-web`).
- **Depende de:** HU-01 (layout, sesión). **Decisión relacionada:** [ADR-002](../adr/ADR-002-product-stock-cache.md).
- **Revisada por [ADR-003](../adr/ADR-003-categories-types-variants.md) (2026-11-09):** la categoría de texto libre la
  sustituye [HU-15](HU-15-categories-and-type-attributes.md) (CA-2 en lo relativo a `category`, CA-19, CA-21 y CA-22), y
  el SKU, el umbral y el stock pasan a la variante en [HU-16](HU-16-product-variants.md) (CA-1, CA-3, CA-4, CA-11,
  CA-18 —la búsqueda por SKU pasa a las variantes, HU-16 CA-16— y el orden por `sku` de CA-21). El resto de esta historia sigue vigente.
- **Decisiones de la supervisión (2026-10-30):** `OPERATOR` crea y edita, solo `ADMIN` desactiva/reactiva; monedas
  iniciales `CUP` y `USD` (lista extensible); moneda de referencia para costo y utilidad: `USD`; nombre no único;
  unidades `UNIT, KG, LB, G, L, ML`.

## Necesidad
El negocio necesita un catálogo único de los productos que compra y vende (arroz, aceite, pollo…), porque el stock,
las compras y los combos se construyen sobre él.

## Historia
**Como** administrador u operador,
**quiero** dar de alta, editar, buscar y desactivar productos,
**para** tener un catálogo fiable sobre el que registrar compras, armar combos y controlar el stock.

## Campos del producto
| Campo (API) | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `name` | texto | sí | 1–120 caracteres tras recortar espacios. **No es único** (el identificador único opcional es el SKU). |
| `sku` | texto | no | 1–50, `[A-Za-z0-9._-]`. Se guarda recortado y **en mayúsculas**; vacío → `null`. **Único** entre todos los productos (activos e inactivos). *Sustituido por [HU-16](HU-16-product-variants.md):* el SKU es de la **variante** (único entre todas las variantes); en un producto simple la API lo sigue mostrando aquí (el de su única variante) y en uno con variantes es `null`. |
| `unit` | enum `UnitOfMeasure` | sí | `UNIT`, `KG`, `LB`, `G`, `L`, `ML`. Texto visible traducido en el frontend. |
| `category` | texto | no | 1–50, texto libre recortado; vacío → `null`. El frontend autocompleta con las existentes. |
| `salePrice` | decimal | no | ≥ 0, máximo 2 decimales y 10 enteros. Precio de venta **de referencia** (el precio real lo fija el combo o el pedido). |
| `salePriceCurrency` | ISO 4217 | si hay `salePrice` | Debe estar en la lista configurada `app.currencies.supported` (inicial: `CUP`, `USD`; se amplía solo con configuración, sin migración). Sin precio → debe ir `null`. |
| `minStock` | decimal | sí (por defecto 0) | ≥ 0, máximo 3 decimales. Umbral de alerta de stock bajo; 0 = sin alerta. *Sustituido por [HU-16](HU-16-product-variants.md):* el umbral es de la **variante**; obligatorio solo en productos simples (el de su única variante) y `null` en productos con variantes. |
| `active` | booleano | — | Solo lectura en el formulario; cambia con activar/desactivar. Nuevo producto → `true`. |
| `version` | entero | en edición | Bloqueo optimista: el cliente envía la versión que editó. |

**Solo lectura** (de `product_stock`, ADR-002; en HU-02 siempre 0 / `null` porque aún no hay movimientos):
`stock.onHand`, `stock.reserved`, `stock.available` (= onHand − reserved), `stock.averageCost`, `stock.costCurrency`,
y `lowStock` = `active && minStock > 0 && available <= minStock`.
*Sustituido por [HU-16](HU-16-product-variants.md):* `product_stock` ya no existe; el stock vive en `variant_stock` (1:1
con la variante, addendum de ADR-002). Producto simple: el de su única variante; con variantes: el agregado de HU-16
CA-15 (sumas de todas las variantes y costo promedio ponderado) y `lowStock` si alguna variante activa está baja.

## Criterios de aceptación

### Alta
- **CA-1 Alta correcta.** Dado un usuario autorizado, cuando envía un producto válido, entonces se responde **201** con el
  producto, `active = true`, `version = 0`, stock en 0 y `averageCost = null`, y existe su fila en `product_stock`.
- **CA-2 Normalización.** Dado `name = "  Arroz 1 kg  "`, `sku = " arr-001 "`, `category = "  "`, entonces se guarda
  `"Arroz 1 kg"`, `"ARR-001"` y `category = null`. La normalización ocurre **antes** de la validación: un `sku` con
  espacios alrededor cumple el patrón, un `name` de 120 caracteres más espacios alrededor es válido y `name = "   "` da
  **400** `validation.failed` con `errors.name`. Igual en `PUT`.
- **CA-3 SKU duplicado.** Dado un producto (activo **o inactivo**) con SKU `ARR-001`, cuando se crea otro con `arr-001`,
  entonces **409** `product.sku_conflict`. Varios productos sin SKU están permitidos.
- **CA-4 SKU duplicado en carrera.** Dadas dos altas simultáneas con el mismo SKU, entonces una responde 201 y la otra
  **409** `product.sku_conflict` (no 500): la restricción única de la base de datos es la garantía final.
- **CA-5 Validación.** Dado `name` vacío, `unit` ausente o desconocido, `minStock` negativo, `salePrice` negativo o con 3
  decimales, o `sku` con caracteres no permitidos, entonces **400** `validation.failed` con `errors` por campo, traducido
  según `Accept-Language`. Los **errores de tipo** también: `unit = "BOX"`, `minStock = "abc"` o `salePrice = true`
  → **400** `validation.failed` con `errors.unit` / `errors.minStock` / `errors.salePrice` = `validation.invalid_value`
  traducido (hoy darían `request.malformed` sin `errors`: requiere el cambio de backend descrito en el diseño).
  Un JSON mal formado (sintaxis) sigue siendo **400** `request.malformed`.
- **CA-6 Precio y moneda.** Dado `salePrice` sin `salePriceCurrency` (o moneda sin precio), entonces **400**
  `product.price_currency_mismatch`. Dada una moneda fuera de `app.currencies.supported` (p. ej. `EUR` o `usd`), entonces
  **400** `product.currency_unsupported`.
- **CA-7 Stock no editable.** Dado un cuerpo que incluye `stock`, `onHand`, `averageCost` o `active`, entonces esos campos
  se **ignoran** (no existen en el DTO de entrada) y el stock sigue en 0.

### Edición
- **CA-8 Edición correcta.** Dado un producto en versión `n`, cuando se envía `PUT` válido con `version = n`, entonces
  **200** con los cambios y `version = n + 1`. `updatedBy` es el usuario del token.
- **CA-9 Edición concurrente.** Dados dos usuarios que abren el mismo producto en versión `n`, cuando el primero guarda,
  entonces el segundo, al guardar con `version = n`, recibe **409** `resource.version_conflict`; el frontend le avisa y le
  ofrece recargar el producto. Nunca se pierde un cambio en silencio.
- **CA-10 No existe.** `GET`/`PUT`/activar/desactivar sobre un id inexistente → **404** `product.not_found`.
- **CA-11 SKU de otro.** Cambiar el SKU a uno que ya usa otro producto → **409** `product.sku_conflict`. Volver a guardar
  con su propio SKU no es conflicto.
- **CA-12 Editar inactivo.** Un producto inactivo se puede editar (p. ej. corregir el nombre) sin reactivarlo.

### Desactivar / reactivar (no se borra)
- **CA-13 Desactivar.** Dado un producto activo, cuando un `ADMIN` lo desactiva, entonces **200** con `active = false`.
  El producto sigue existiendo y sus datos (y en el futuro sus movimientos) se conservan.
- **CA-14 Desactivar con stock.** Dado un producto con `onHand > 0` o `reserved > 0`, se puede desactivar; el frontend
  pide confirmación mostrando el stock. Efecto futuro (HU-04/06/07): no se podrá usar en compras, combos ni pedidos
  **nuevos** (`product.inactive`); lo ya registrado sigue su curso.
- **CA-15 Idempotencia.** Desactivar uno ya inactivo (o activar uno activo) → **200** sin cambios ni nueva versión.
- **CA-16 Sin borrado.** `DELETE /api/v1/products/{id}` → **405** `request.method_not_allowed`.

### Listado y búsqueda
- **CA-17 Listado por defecto.** El frontend muestra solo productos activos, 20 por página, ordenados por nombre
  (sin distinguir mayúsculas), con: nombre, SKU, categoría, precio de referencia con moneda («—» si no hay) y disponible
  con su unidad («36 u», «12,5 kg»). Badge «Inactivo» para los inactivos.
  **Hasta HU-04 no se muestran las etiquetas de stock** («Sin stock», «Stock bajo»): todos los productos tendrían stock 0.
  La API ya devuelve `stock` y `lowStock`; el frontend las activa cuando existan movimientos (HU-04).
- **CA-18 Búsqueda.** Dado `q = "arr"`, se devuelven los productos cuyo nombre **o** SKU contienen "arr", sin distinguir
  mayúsculas. Los caracteres `%` y `_` de `q` se buscan literalmente. `q` vacío = sin filtro. (Sin tildes: "azucar" no
  encuentra "Azúcar"; ver fuera de alcance.)
- **CA-19 Filtros.** `active=true|false` (ausente = todos) y `category` (coincidencia exacta, sin distinguir mayúsculas).
  El frontend tiene un filtro **Estado: Activos / Inactivos / Todos** (por defecto Activos; envía `active=true`,
  `active=false` o nada) y un selector de categoría con las de CA-22.
- **CA-20 Paginación.** `page` (desde 0) y `size` (1–100, por defecto 20). Respuesta con `content`, `page`, `size`,
  `totalElements`, `totalPages`. Una página más allá del final devuelve `content` vacío (no error).
  `size` < 1 o > 100, o `page` < 0 → **400** `validation.failed` con `errors.size` / `errors.page` (**nunca** se recorta
  en silencio). Tipos inválidos (`page=abc`, `active=quizas`) → **400** `validation.failed` con `errors.<parámetro>` =
  `validation.invalid_value`. El frontend, ante una página vacía que no es
  la primera (enlace antiguo), redirige a la última página con datos.
- **CA-21 Orden.** `sort` admite `name`, `sku`, `category`, `createdAt`, con `,asc` o `,desc`. Otro campo → **400**
  `request.invalid_sort`. El orden es estable (desempate por `id`). El frontend solo ofrece ordenar por nombre (asc/desc).
- **CA-22 Categorías.** `GET /api/v1/products/categories` devuelve las categorías distintas no nulas, ordenadas, para el autocompletado.

### Permisos
- **CA-23** Sin token → **401** `auth.unauthorized` en todos los endpoints.
- **CA-24** `ADMIN` y `OPERATOR` pueden listar, ver, crear y editar. **Solo `ADMIN`** activa y desactiva; un `OPERATOR` recibe
  **403** `auth.forbidden` y en el frontend no ve esos botones (ni en la fila del listado ni en la tarjeta
  «Estado del producto» del formulario).

### Frontend
- **CA-25** Formulario único para alta y edición, en ruta propia (`/products/new`, `/products/:id/edit`); errores de `errors`
  junto a cada campo y `product.sku_conflict` en el campo SKU. Los datos de stock y costo se muestran en solo lectura con
  la nota «Se actualiza con las compras y ventas». Moneda del precio: select `CUP`/`USD`; en un producto nuevo viene
  **preseleccionada `USD`**, en edición la del producto. Si el importe está vacío se envía `salePrice` y
  `salePriceCurrency` a `null`.
- **CA-26** Búsqueda con espera de ~300 ms tras dejar de escribir; la búsqueda, los filtros, el orden y la página se
  reflejan en la URL (`?q=&cat=&status=&page=&sort=`, `page` desde 1 para personas; el cliente resta 1 al llamar a la API).
  Al recargar, compartir el enlace o volver desde el formulario se conserva la vista.
- **CA-27** En móvil (360 px) el listado se ve como tarjetas, sin desplazamiento horizontal.
- **CA-28** Todos los textos (incluidos los nombres de las unidades) en es/en; los precios con formato de la moneda y el
  idioma (`Intl.NumberFormat`).

## Fuera de alcance
- Movimientos de stock, compras y costo promedio (HU-04). Alertas de stock bajo en el panel (HU-10).
- Imágenes, descripción pública y datos para Combazo (fase 2).
- Tabla de categorías con jerarquía; búsqueda sin tildes (`unaccent`); importación masiva (CSV); borrado físico.
- Precios por moneda (un precio de referencia en cada moneda) y conversión.

## Diseño técnico (backend)

### Paquete `com.cuartico.product`
`Product` (entidad, extiende `AuditableEntity`, `@Version`), `UnitOfMeasure` (enum), `ProductStock` (entidad de solo
lectura en HU-02; su dueño será el módulo `inventory` en HU-04), `ProductRepository`, `ProductService`, `ProductController`,
`dto/ProductDtos.java`. `PageResponse<T>` en `common/dto` (genérico, reutilizable; no se serializa `Page` de Spring directamente).

### Migración `V3__products.sql`
```sql
CREATE TABLE products (
    id                  BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name                VARCHAR(120)  NOT NULL,
    sku                 VARCHAR(50),
    unit                VARCHAR(10)   NOT NULL,
    category            VARCHAR(50),
    sale_price          NUMERIC(12,2),
    sale_price_currency VARCHAR(3),
    min_stock           NUMERIC(12,3) NOT NULL DEFAULT 0,
    active              BOOLEAN       NOT NULL DEFAULT TRUE,
    version             BIGINT        NOT NULL DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by          VARCHAR(50),
    updated_by          VARCHAR(50),
    CONSTRAINT uk_products_sku UNIQUE (sku),
    CONSTRAINT ck_products_price_currency CHECK (
        (sale_price IS NULL AND sale_price_currency IS NULL)
        OR (sale_price IS NOT NULL AND sale_price_currency IS NOT NULL)),
    CONSTRAINT ck_products_sale_price CHECK (sale_price IS NULL OR sale_price >= 0),
    CONSTRAINT ck_products_min_stock CHECK (min_stock >= 0)
);

-- Sin índices de búsqueda en V3: la búsqueda es LIKE '%…%' sobre LOWER(name)/LOWER(sku) y el filtro de categoría
-- compara LOWER(category); un índice B-tree sobre la columna no se usaría en ninguno de los dos casos. Con el volumen
-- esperado (cientos de productos) el recorrido completo es inmediato. Si crece: pg_trgm (solo PostgreSQL) en otra migración.
-- El SKU ya tiene índice por la restricción UNIQUE.

-- Caché de stock y costo (ADR-002). Solo la modifica el servicio de inventario (HU-04).
CREATE TABLE product_stock (
    product_id    BIGINT        PRIMARY KEY REFERENCES products (id),
    on_hand       NUMERIC(14,3) NOT NULL DEFAULT 0,
    reserved      NUMERIC(14,3) NOT NULL DEFAULT 0,
    average_cost  NUMERIC(14,4),
    cost_currency VARCHAR(3),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_product_stock_non_negative CHECK (on_hand >= 0 AND reserved >= 0)
);
```
Notas: `VARCHAR(3)` y no `CHAR(3)` para que `ddl-auto=validate` no choque con `bpchar` en PostgreSQL. `UNIQUE` admite
varios `NULL` en PostgreSQL y H2. Las cantidades son `NUMERIC(…,3)` para permitir kg o litros fraccionados.

### Endpoints
| Método | Ruta | Rol | OK | Errores |
|---|---|---|---|---|
| GET | `/api/v1/products?q=&active=&category=&page=0&size=20&sort=name,asc` | ADMIN, OPERATOR | 200 `PageResponse<ProductResponse>` | 400 `validation.failed` (con `errors`), `request.invalid_sort` |
| GET | `/api/v1/products/{id}` | ADMIN, OPERATOR | 200 `ProductResponse` | 404 `product.not_found` |
| GET | `/api/v1/products/categories` | ADMIN, OPERATOR | 200 `List<String>` | — |
| POST | `/api/v1/products` | ADMIN, OPERATOR | 201 `ProductResponse` + `Location` | 400 `validation.failed`, `product.price_currency_mismatch`, `product.currency_unsupported`; 409 `product.sku_conflict` |
| PUT | `/api/v1/products/{id}` | ADMIN, OPERATOR | 200 `ProductResponse` | los de POST + 404 `product.not_found`, 409 `resource.version_conflict` |
| POST | `/api/v1/products/{id}/deactivate` | ADMIN | 200 `ProductResponse` | 404, 403 `auth.forbidden` |
| POST | `/api/v1/products/{id}/activate` | ADMIN | 200 `ProductResponse` | 404, 403 `auth.forbidden` |

### DTOs (`ProductDtos`)
```java
record CreateProductRequest(
    @NotBlank @Size(max = 120) String name,
    @Size(max = 50) @Pattern(regexp = "^[A-Za-z0-9._-]*$", message = "{product.sku.pattern}") String sku,
    @NotNull UnitOfMeasure unit,
    @Size(max = 50) String category,
    @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal salePrice,
    String salePriceCurrency,
    @NotNull @DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock) {

    // Normalización en el constructor compacto: Jackson construye el record con estos valores ya
    // normalizados y Bean Validation (@Valid) valida DESPUÉS, sobre ellos (CA-2).
    CreateProductRequest {
        name = name == null ? null : name.strip();
        sku = Normalize.blankToNull(sku);          // strip + vacío → null
        if (sku != null) sku = sku.toUpperCase(Locale.ROOT);
        category = Normalize.blankToNull(category);
        // salePriceCurrency NO se normaliza: "usd" debe dar product.currency_unsupported (CA-6)
    }
}

record UpdateProductRequest(/* mismos campos y misma normalización */ ..., @NotNull Long version) {}

// Parámetros del listado como record con @Valid @ModelAttribute (no Pageable: recortaría size en silencio).
// Los errores (incluidos los de conversión de tipo) llegan como MethodArgumentNotValidException → validation.failed + errors.
record ProductQuery(
    @Size(max = 100) String q,
    Boolean active,
    @Size(max = 50) String category,
    @Min(0) Integer page,                // null → 0
    @Min(1) @Max(100) Integer size,      // null → 20
    String sort) {}                      // null → "name,asc"; whitelist en el Service → request.invalid_sort

record StockSummary(BigDecimal onHand, BigDecimal reserved, BigDecimal available,
                    BigDecimal averageCost, String costCurrency) {}

record ProductResponse(Long id, String name, String sku, UnitOfMeasure unit, String category,
    BigDecimal salePrice, String salePriceCurrency, BigDecimal minStock, boolean active,
    StockSummary stock, boolean lowStock, long version,
    Instant createdAt, String createdBy, Instant updatedAt, String updatedBy) {}

record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {}  // common/dto
```
`minStock` es obligatorio en el DTO; el formulario lo inicializa a 0. Los decimales viajan como número JSON; el frontend no hace aritmética con ellos.

### Cambios transversales en `common/GlobalExceptionHandler` (los exigen CA-5, CA-9 y CA-20)
1. `HttpMessageNotReadableException` cuya causa es un error de tipo de Jackson (`InvalidFormatException` /
   `MismatchedInputException`; en Spring Boot 4 es Jackson 3, paquete `tools.jackson.databind.exc`) → **400**
   `validation.failed` con `errors.<campo>` = mensaje de `validation.invalid_value` (el campo sale de la ruta de la
   excepción; para anidados, ruta con puntos). Si la ruta está **vacía** (p. ej. cuerpo `[]` o `"texto"` en lugar de un
   objeto) no hay campo al que asignarlo: sigue siendo `request.malformed`. Cualquier otro `HttpMessageNotReadableException`
   (JSON con sintaxis inválida, cuerpo vacío) sigue en `request.malformed`.
2. En `handleMethodArgumentNotValid`, los `FieldError` con `isBindingFailure()` (p. ej. `page=abc`) usan el mensaje de
   `validation.invalid_value` en vez del texto técnico de Spring.
3. `ObjectOptimisticLockingFailureException` → **409** `resource.version_conflict` (ver reglas abajo).
Cada uno con su test de integración. Afectan a toda la API, no solo a productos: documentarlo en `errors.md` (Forja-Back/Pluto).

### Reglas en `ProductService` (`@Transactional`)
- La normalización ya viene hecha en el DTO (CA-2). Comprobación previa `existsBySkuAndIdNot` para un 409 claro, y
  `saveAndFlush` capturando `DataIntegrityViolationException` de `uk_products_sku` → `product.sku_conflict` (CA-4).
  El nombre de la restricción se reconoce **sin distinguir mayúsculas** (PostgreSQL informa `uk_products_sku`, H2
  `UK_PRODUCTS_SKU`); cualquier otra violación se relanza.
- Monedas en `application.yml`: `app.currencies.supported: [CUP, USD]` y `app.currencies.reference: USD` (la usará
  HU-04 para `cost_currency` y HU-10 para la utilidad). Se compara exacto (mayúsculas). Añadir una moneda = cambiar la
  configuración. Si más adelante hacen falta datos por moneda (nombre, decimales, activa), se pasa a una tabla `currencies`.
- Versión: si `request.version != entity.version` → 409 `resource.version_conflict`. La carrera residual al hacer flush
  (`ObjectOptimisticLockingFailureException`) la traduce el `GlobalExceptionHandler` al mismo código (**hoy acabaría en 500**: hay que añadir ese manejador).
- Alta: crea `Product` y su `ProductStock` (ceros, `updated_at` desde `Clock`) en la misma transacción.
- Búsqueda: `LOWER(name) LIKE :pattern ESCAPE '\'` o `LOWER(sku) LIKE …`, con `%`, `_` y `\` de `q` escapados.
  Listado con `JOIN` a `product_stock` (una consulta, sin N+1).

### i18n (nuevos códigos en `messages_es` y `messages_en`)
`product.not_found` (con `{0}` = id), `product.sku_conflict` (con `{0}` = SKU), `product.price_currency_mismatch`,
`product.currency_unsupported` (con `{0}` = moneda), `product.sku.pattern` (Bean Validation),
`resource.version_conflict`, `request.invalid_sort` (con `{0}` = campo), `validation.invalid_value` («valor no válido»). Reservado para HU-04/06/07: `product.inactive`.
Mensajes Bean Validation nuevos si no existen: `DecimalMin`, `Digits`, `Min`, `Max`.

### Impacto futuro
- **HU-04**: escribe en `product_stock` con bloqueo pesimista; valida `product.inactive`; fija `cost_currency` = `USD` (moneda de referencia).
- **HU-06**: combos disponibles = todos sus productos activos con `available` suficiente (lectura barata gracias al caché).
- **Combazo**: necesitará imagen/descripción pública y probablemente un endpoint público de solo lectura; nada aquí lo impide.
- **Multimoneda**: un solo precio de referencia por producto; si se necesitan precios por moneda, tabla aparte.

## Preguntas abiertas
Ninguna. Resueltas por la supervisión (2026-10-30 y 2026-11-05): moneda preseleccionada `USD`; etiquetas de stock ocultas
hasta HU-04; filtro de estado con tres opciones. Prototipos aprobados: `docs/design/prototypes/products.html`.
