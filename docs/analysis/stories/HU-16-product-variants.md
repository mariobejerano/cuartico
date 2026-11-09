# HU-16: Variantes de producto

- **Sprint:** — (después de HU-15 y antes de HU-04) · **Estado:** analizada; pendiente de prototipo (Lienzo) y aprobación
  de la supervisión.
- **Alcance:** backend (módulo `product`, migración **V5**) y frontend (`cuartico-web`).
- **Decisiones:** [ADR-003](../adr/ADR-003-categories-types-variants.md) (decisión 3) y addendum de
  [ADR-002](../adr/ADR-002-product-stock-cache.md) (la caché de stock es 1:1 con la variante).
  **Depende de:** [HU-15](HU-15-categories-and-type-attributes.md).
- **Decisiones de la supervisión (2026-11-09):** variantes talla × color, cada una con su stock; **sin precio por
  variante** por ahora (el precio es del producto); ejes de variante: talla y color, texto libre.

## Necesidad
La ropa se compra y se vende por talla y color, y cada combinación tiene su propio stock. Hoy un producto tiene una sola
fila de stock, así que habría que crear un producto por combinación. Esta historia deja el stock en la **variante**
antes de que HU-04 empiece a registrar movimientos.

## Historia
**Como** administrador u operador,
**quiero** definir las tallas y colores de un producto, cada combinación con su SKU, su umbral y su stock,
**para** comprar, vender y controlar el inventario de cada talla y color sin multiplicar los productos del catálogo.

## Conceptos
- **Variante**: lo que se compra, se almacena y se vende. Tiene `sku` (opcional, único global), `size`, `color`,
  `minStock`, `active`, `version` y su fila de stock (`variant_stock`).
- **Producto simple** (`hasVariants = false`): tiene exactamente **una** variante, sin talla ni color, invisible en la
  interfaz; su SKU, umbral y stock se muestran como «del producto», igual que en HU-02.
- **Producto con variantes** (`hasVariants = true`): una o más variantes, cada una con talla, color o ambos.
- Las variantes heredan del producto: nombre, categoría (y tipo), unidad, marca, modelo, garantía y precio.
- Se admiten en cualquier tipo (ropa es el caso habitual).

## Criterios de aceptación

### Productos simples (comportamiento de HU-02 conservado)
- **CA-1 Alta simple.** Dado un `POST /products` con `hasVariants` ausente o `false`, `sku` y `minStock`, entonces
  **201** con `hasVariants = false`, `variantCount = 1`, `sku`, `minStock` y `stock` como en HU-02, y existen una fila en
  `product_variants` (sin talla ni color) y su fila en `variant_stock` con ceros.
- **CA-2 Edición simple.** `PUT /products/{id}` de un producto simple con `sku` y `minStock` actualiza su variante.
  Las reglas de SKU de HU-02 (normalización, único entre todas las variantes activas e inactivas, carrera → 409
  `product.sku_conflict`) se mantienen.
- **CA-3 Endpoints de variantes en un simple.** Crear, editar, activar o desactivar variantes de un producto simple
  → **409** `product.no_variants` (se gestiona con el `PUT` y la activación del producto).

### Alta con variantes
- **CA-4 Alta con variantes.** Dado `hasVariants = true` y `variants` con 1–100 elementos (`sku`, `size`, `color`,
  `minStock`), entonces **201** con todas las variantes y una fila de stock en ceros por cada una, en una sola
  transacción. `sku` y `minStock` del nivel de producto deben ir `null`; si no → **400** `product.variant_fields_not_allowed`.
  `variants` vacía o ausente → **400** `validation.failed` (`errors.variants`). Con `hasVariants = false`, `variants`
  debe ir ausente o vacía (si no, mismo 400).
- **CA-5 Opciones obligatorias.** Una variante sin `size` ni `color` (tras recortar) → **400** `variant.options_required`.
- **CA-6 Normalización.** `size` se recorta y pasa a mayúsculas (`" m "` → `"M"`), `color` se recorta; vacíos → `null`.
  `size` ≤ 20, `color` ≤ 30; si no → **400** `validation.failed` con `errors` por campo (`variants[0].size`).
- **CA-7 Opciones duplicadas.** Dos variantes del mismo producto con la misma talla y color (sin distinguir mayúsculas:
  `Rojo`/`rojo`, `Marrón`/`MARRÓN`), en la misma petición o contra las existentes (activas o no) → **409**
  `variant.options_conflict` (con `{0}` = `"M / Rojo"`). Dos peticiones simultáneas con `Rojo` y `rojo` → una 201 y otra
  409 (la restricción sobre `color_key` es la garantía final, nunca 500). SKU repetido en la petición o ya usado → **409**
  `product.sku_conflict`. Nada se guarda.

### Gestión de variantes
- **CA-8 Añadir variantes.** `POST /products/{id}/variants` con 1–100 variantes, en un producto con variantes → **201**
  con el producto completo; mismas validaciones que CA-5 a CA-7; todo o nada.
- **CA-9 Editar variante.** `PUT /products/{id}/variants/{variantId}` con `sku`, `size`, `color`, `minStock`, `version`
  → **200**, `version + 1`. Versión antigua → **409** `resource.version_conflict`. Una variante de **otro** producto o
  inexistente → **404** `variant.not_found`.
- **CA-10 Desactivar/activar variante** (solo `ADMIN`): **200**, idempotente. Conserva su stock y datos (futuro: no se
  usa en compras, combos ni pedidos nuevos, `variant.inactive`). Se puede desactivar la última activa (el producto queda
  sin variantes vendibles; el listado lo muestra con 0 disponibles). `OPERATOR` → **403**.
- **CA-11 Sin borrado.** `DELETE` sobre una variante → **405** `request.method_not_allowed`.

### Convertir
- **CA-12 Simple → con variantes.** `POST /products/{id}/variants/enable` con `size` y/o `color` → **200**: la variante
  existente recibe esas opciones y **conserva** su `id`, SKU, umbral y stock; `hasVariants = true`. Sin opciones → CA-5.
  Si ya tiene variantes → **409** `product.has_variants`.
- **CA-13 Con variantes → simple.** `POST /products/{id}/variants/disable` → **200** si tiene exactamente una variante
  (activa o no): pierde talla y color, se activa si estaba inactiva y `hasVariants = false`. Con más de una → **409**
  `product.has_multiple_variants`. Si ya es simple → **409** `product.no_variants`.

### Lectura
- **CA-14 Detalle.** `GET /products/{id}` (y las respuestas de alta, edición y conversión) incluyen `hasVariants`,
  `variantCount` y `variants[]` (`id, sku, size, color, minStock, active, stock, lowStock, version`). En un producto con
  variantes, `sku` y `minStock` del producto son `null`.
  **Orden de `variants[]`**: tallas canónicas `XXS, XS, S, M, L, XL, XXL, XXXL` (alias `2XL` = `XXL`, `3XL` = `XXXL`);
  después las numéricas de menor a mayor (`36` < `38` < `40`; admite decimales: `10.5`); después el resto en orden
  alfabético; las variantes sin talla al final; a igual talla, por color alfabético (sin distinguir mayúsculas) y, por
  último, por `id`. Ejemplo: tallas `L, 38, M, XL, Única, S, 36` → `S, M, L, XL, 36, 38, ÚNICA`.
- **CA-15 Agregado del producto.** En el listado y en el detalle, el `stock` de un producto con variantes agrega
  **todas** sus variantes, activas e inactivas (desactivar una talla no saca sus unidades del almacén ni su valor; el
  detalle muestra cuáles están inactivas):
  - `onHand`, `reserved`, `available` = sumas de las variantes;
  - `averageCost` = promedio **ponderado** Σ(onHand·averageCost) / Σ onHand, ambos sobre las variantes con costo;
    `null` si ese Σ onHand = 0 (nunca la suma de promedios);
  - `costCurrency` = `USD` si `averageCost` no es nulo; si no, `null`;
  - `lowStock` = el producto está activo y **alguna variante activa** tiene stock bajo (las inactivas no generan alerta).

  El listado no trae `variants[]`, para no cargarlo. **Test** (con `variant_stock` sembrado por SQL, porque hasta HU-04
  no hay movimientos): variante A con `onHand = 10`, `averageCost = 5.0000`; variante B (inactiva) con `onHand = 30`,
  `averageCost = 9.0000` → `onHand = 40` y `averageCost = (10·5 + 30·9) / 40 = 8.0000` (no 14 ni 7). Con las dos en
  `onHand = 0` → `averageCost = null`.
- **CA-16 Búsqueda.** `q` encuentra productos cuyo nombre o el **SKU de alguna de sus variantes** contiene el texto
  (producto con variantes: aparece una vez).
- **CA-17 Orden.** `sort` admite `name` y `createdAt`; `sku` deja de admitirse (**400** `request.invalid_sort`).

### Migración (V5)
- **CA-18 Productos existentes.** Tras V5 cada producto tiene `hasVariants = false` y una variante con su antiguo `sku`
  y `min_stock`; cada variante tiene su fila en `variant_stock` con los valores que tenía `product_stock`. Ya no existen
  `product_stock`, `products.sku` ni `products.min_stock`. Igual número de productos, variantes y filas de stock.
- **CA-19 Reconciliación.** Test: cada variante tiene exactamente una fila de stock; ningún producto queda sin variante.

### Permisos
- **CA-20** Sin token → **401**. `ADMIN` y `OPERATOR` crean y editan variantes y convierten; solo `ADMIN` activa y
  desactiva variantes.

### Frontend
- **CA-21 Alta.** Interruptor «Tiene tallas o colores» (por defecto apagado; encendido por defecto si el tipo es
  `CLOTHING`). Encendido: desaparecen SKU y umbral del producto y aparece un generador: tallas (lista de etiquetas) ×
  colores (lista de etiquetas) → genera las filas combinadas, cada una con SKU y umbral editables y botón para quitarla.
  Errores por fila (`errors["variants[2].sku"]`) junto al campo; `variant.options_conflict` y `product.sku_conflict` en
  la fila correspondiente cuando se pueda identificar.
- **CA-22 Edición.** Tabla de variantes con edición en línea (SKU, talla, color, umbral) y stock en solo lectura;
  «Añadir variantes» reutiliza el generador y omite las combinaciones existentes; activar/desactivar por fila solo para
  `ADMIN`. Conflicto de versión en una fila → aviso y recarga de esa fila. Botones «Convertir en producto con variantes»
  (pide talla/color de la existente) y «Convertir en producto simple» (solo visible si hay una variante).
- **CA-23 Listado.** «N variantes» bajo el nombre y disponible agregado con su unidad. Las etiquetas de stock siguen
  ocultas hasta HU-04 (como en HU-02).
- **CA-24** En móvil (360 px) la tabla de variantes se ve como tarjetas, sin desplazamiento horizontal; textos en es/en.

## Fuera de alcance
- Precio por variante (decisión de la supervisión; columna nullable futura); imagen por variante (Combazo).
- Otros ejes (voltaje…): de momento, productos distintos.
- Número de serie por unidad (decisión de la supervisión).
- Movimientos de stock (HU-04); combos con variantes (HU-06).

## Diseño técnico (backend)

### Entidades (paquete `com.cuartico.product`)
- `ProductVariant` (`AuditableEntity`, `@Version`, `@ManyToOne(optional = false, fetch = LAZY) product`,
  `@OneToOne(mappedBy = "variant", cascade = PERSIST) VariantStock stock`).
- `VariantStock` sustituye a `ProductStock` (mismo contenido, `@MapsId` sobre la variante). Sigue siendo de solo lectura
  aquí; su dueño será el módulo `inventory` (HU-04).
- `Product`: se quitan `sku`, `minStock` y `stock`; se añaden `hasVariants` y `@OneToMany(mappedBy = "product")
  List<ProductVariant> variants`.

### Migración `V5__product_variants.sql` (orientativa)
```sql
CREATE TABLE product_variants (
    id         BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    product_id BIGINT        NOT NULL REFERENCES products (id),
    sku        VARCHAR(50),
    size       VARCHAR(20),
    color      VARCHAR(30),
    color_key  VARCHAR(30),                    -- LOWER(TRIM(color)), calculado por la BD
    min_stock  NUMERIC(12,3) NOT NULL DEFAULT 0,
    active     BOOLEAN       NOT NULL DEFAULT TRUE,
    version    BIGINT        NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    CONSTRAINT uk_product_variants_sku UNIQUE (sku),
    CONSTRAINT uk_product_variants_options UNIQUE NULLS NOT DISTINCT (product_id, size, color_key),
    CONSTRAINT ck_product_variants_min_stock CHECK (min_stock >= 0)
);
CREATE INDEX idx_product_variants_product ON product_variants (product_id);

CREATE TABLE variant_stock (
    variant_id    BIGINT        PRIMARY KEY REFERENCES product_variants (id),
    on_hand       NUMERIC(14,3) NOT NULL DEFAULT 0,
    reserved      NUMERIC(14,3) NOT NULL DEFAULT 0,
    average_cost  NUMERIC(14,4),
    cost_currency VARCHAR(3),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_variant_stock_non_negative CHECK (on_hand >= 0 AND reserved >= 0)
);

ALTER TABLE products ADD COLUMN has_variants BOOLEAN NOT NULL DEFAULT FALSE;
-- 1. INSERT INTO product_variants (product_id, sku, min_stock, active, version, auditoría) SELECT … FROM products
--    (active = TRUE: la activación del producto manda; size/color NULL)
-- 2. INSERT INTO variant_stock SELECT v.id, s.on_hand, s.reserved, s.average_cost, s.cost_currency, s.updated_at
--    FROM product_stock s JOIN product_variants v ON v.product_id = s.product_id
-- 3. DROP TABLE product_stock;
--    ALTER TABLE products DROP CONSTRAINT uk_products_sku;   -- explícito, antes de la columna (H2)
--    ALTER TABLE products DROP CONSTRAINT ck_products_min_stock;
--    ALTER TABLE products DROP COLUMN sku; ALTER TABLE products DROP COLUMN min_stock;
```
- `UNIQUE NULLS NOT DISTINCT` está verificado por Lupa en H2 2.4.240 (modo PostgreSQL) y PostgreSQL 18; también los
  `DROP CONSTRAINT` antes de los `DROP COLUMN`.
- **Mayúsculas**: `size` se normaliza en el DTO (`strip()` + `toUpperCase(Locale.ROOT)`) y se guarda así; `color` se guarda
  como se escribió y su clave `color_key` la calcula la BD con `LOWER(TRIM(?))` (`@ColumnTransformer` en la entidad,
  igual que `categories.name_key` en HU-15). La restricción sobre `color_key` cubre también la carrera `Rojo`/`rojo`.
- Test de migración (Vera): CA-18 y CA-19 con datos sembrados antes de V5.

### Endpoints
| Método | Ruta | Rol | OK | Errores |
|---|---|---|---|---|
| POST | `/api/v1/products` | ADMIN, OPERATOR | 201 `ProductResponse` | los de HU-02/HU-15 + 400 `product.variant_fields_not_allowed`, `variant.options_required`; 409 `variant.options_conflict` |
| PUT | `/api/v1/products/{id}` | ADMIN, OPERATOR | 200 | ídem; en un producto con variantes, `sku`/`minStock` no nulos → 400 `product.variant_fields_not_allowed` |
| POST | `/api/v1/products/{id}/variants` | ADMIN, OPERATOR | 201 `ProductResponse` | 400 `validation.failed`, `variant.options_required`; 404 `product.not_found`; 409 `product.no_variants`, `variant.options_conflict`, `product.sku_conflict` |
| PUT | `/api/v1/products/{id}/variants/{variantId}` | ADMIN, OPERATOR | 200 `ProductResponse` | 400; 404 `variant.not_found`; 409 `product.no_variants`, `variant.options_conflict`, `product.sku_conflict`, `resource.version_conflict` |
| POST | `/api/v1/products/{id}/variants/{variantId}/deactivate` · `/activate` | ADMIN | 200 | 404; 409 `product.no_variants`; 403 |
| POST | `/api/v1/products/{id}/variants/enable` | ADMIN, OPERATOR | 200 | 400 `variant.options_required`; 404; 409 `product.has_variants`, `variant.options_conflict` |
| POST | `/api/v1/products/{id}/variants/disable` | ADMIN, OPERATOR | 200 | 404; 409 `product.no_variants`, `product.has_multiple_variants` |

Los endpoints de variantes devuelven el **producto completo** (`ProductResponse` con `variants[]`): el frontend
refresca todo de una vez.

### DTOs (`ProductDtos`)
```java
record VariantRequest(@Size(max = 50) @Pattern(regexp = SKU_REGEX, message = "{product.sku.pattern}") String sku,
                      @Size(max = 20) String size, @Size(max = 30) String color,
                      @NotNull @DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock) {}
                      // sku: normalizeSku; size: strip + upper; color: strip; vacíos → null
record UpdateVariantRequest(/* mismos campos */ ..., @NotNull Long version) {}
record AddVariantsRequest(@NotEmpty @Size(max = 100) List<@Valid VariantRequest> variants) {}
record EnableVariantsRequest(@Size(max = 20) String size, @Size(max = 30) String color) {}

// CreateProductRequest: + Boolean hasVariants (null → false), + @Size(max = 100) List<@Valid VariantRequest> variants;
//   sku y minStock pasan a ser opcionales (obligatorio minStock solo si es simple: lo valida el Service)
// UpdateProductRequest: sku y minStock opcionales (mismas reglas); no admite hasVariants ni variants
record VariantResponse(Long id, String sku, String size, String color, BigDecimal minStock, boolean active,
                       StockSummary stock, boolean lowStock, long version) {}
// ProductResponse: + boolean hasVariants, int variantCount, List<VariantResponse> variants (null en el listado);
//   sku, minStock: los de la única variante si es simple, null si no; stock: el de la única variante o el agregado de CA-15
```

### Reglas en `ProductService` (`@Transactional`)
- Simple: el `PUT` del producto actualiza también su variante (la `version` que manda es la del producto).
- Añadir variantes, convertir y crear/editar variantes **bloquean la fila del producto** (`PESSIMISTIC_WRITE`): así
  `disable` no puede cruzarse con un alta de variante (quedaría un «simple» con dos variantes). Son operaciones raras.
- Duplicados de opciones: dentro de la petición, comparando `size` y `color` en minúsculas; contra las existentes, con
  una consulta que compara `color_key = lower(trim(:color))` (la misma función de la BD). Después `saveAndFlush`
  capturando `uk_product_variants_options` → `variant.options_conflict` y `uk_product_variants_sku` →
  `product.sku_conflict` (el detector de restricción de HU-02 pasa a reconocer ambos nombres).
- `lowStock` por variante: `active && minStock > 0 && available <= minStock` (misma fórmula de HU-02), y el producto
  `active` también.
- Agregado (CA-15) sobre todas las variantes: en el listado se calcula en la consulta (`GROUP BY` sobre
  `product_variants` + `variant_stock`, con `SUM(on_hand * average_cost) / NULLIF(SUM(CASE WHEN average_cost IS NOT NULL
  THEN on_hand END), 0)` redondeado a 4 decimales, `HALF_UP`) para no cargar variantes por fila; en el detalle, en Java
  con la misma fórmula. La búsqueda por SKU con `EXISTS` sobre `product_variants`.
- Orden de `variants[]` (CA-14): `Comparator` en el Service con la lista canónica de tallas como constante
  (`SizeOrder`); el frontend respeta el orden de la API y el generador emite las filas en ese mismo orden.

### i18n (es/en)
`variant.not_found` (`{0}` = id), `variant.options_required`, `variant.options_conflict` (`{0}` = opciones),
`variant.inactive` (reservado para HU-04/06/07), `product.no_variants`, `product.has_variants`,
`product.has_multiple_variants`, `product.variant_fields_not_allowed`. Frontend: textos del generador, de la tabla de
variantes y de la conversión.

## Impacto sobre HU-02 (qué se rehace)
| Pieza | Cambio |
|---|---|
| `ProductStock` | Se sustituye por `VariantStock` (y su tabla, ADR-002 addendum). |
| `Product`, `ProductDtos`, `ProductService` | `sku`/`minStock`/`stock` pasan a la variante; `ProductResponse.from` proyecta la variante única o el agregado; búsqueda por SKU con `EXISTS`; se quita `sku` de `SORT_FIELDS`; detector de restricciones con los nombres nuevos. |
| Tests de HU-02 | CA-1 (la fila de stock es de la variante), CA-3/CA-4/CA-11 (SKU ahora en variantes, mismos códigos), CA-7, CA-17, CA-18 (búsqueda por SKU, ahora en las variantes: CA-16) y CA-21 (orden por SKU retirado). Los demás pasan sin cambios de fondo. |
| `cuartico-web` | `productSchema` y `ProductFormPage` (interruptor, generador y tabla de variantes, conversión), `ProductsListPage` (N variantes, stock agregado), `stockBadge`/`lowStock` por agregado, `queries` (mutaciones de variantes), tests. |
| Docs | API, errores, matriz QA de HU-02, `CHANGELOG.md`; diagrama ER pasa de propuesta a vigente. |

## Impacto futuro
- **HU-04**: `stock_movements.variant_id NOT NULL`; líneas de compra con `variant_id`; bloqueo de la fila de
  `variant_stock`; costo promedio por variante. Cantidades enteras si `unit = UNIT`.
- **HU-06**: `combo_items (product_id, variant_id)`; simple → su variante, fija; con variantes → fija o nula
  («se elige al vender»).
- **HU-07**: la línea del pedido siempre lleva `variant_id`; texto opcional de número de serie al entregar (decisión de
  la supervisión, si se pide).
- **Combazo**: «elige talla y color» sale directamente de `variants[]`.
