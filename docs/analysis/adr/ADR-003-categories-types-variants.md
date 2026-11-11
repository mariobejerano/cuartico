# ADR-003: Categorías con jerarquía, tipos de producto y variantes

- **Estado:** Aceptado (2026-11-09). Respuestas de la supervisión en «Preguntas abiertas»: P-2, P-4, P-5 y P-6 respondidas
  expresamente; P-1, P-3, P-7, P-8, P-9, P-10 y P-11 siguen la recomendación de Faro salvo que la supervisión diga lo contrario.
- **Historias que lo implementan:** [HU-15](../stories/HU-15-categories-and-type-attributes.md) (V4) y
  [HU-16](../stories/HU-16-product-variants.md) (V5), ambas antes de HU-04.
- **Fecha:** 2026-11-09
- **Origen:** TT-15 (decisiones de la supervisión del 2026-11-09). Pregunta de Lupa en el PR #10 sobre el 1:1 `products`–`product_stock`.
- **Historias:** [HU-02](../stories/HU-02-products.md) (se modifica), HU-04 (requisito previo), HU-06 y HU-07 (consumen el modelo).
- **Modifica:** [ADR-002](ADR-002-product-stock-cache.md): su razonamiento se mantiene, pero la caché pasa a ser 1:1 con la **variante**
  (ver el addendum del 2026-11-09 en ADR-002).

## Necesidad
El negocio deja de vender solo alimentos: también ropa (con talla y color, cada combinación con su stock) y electrodomésticos
(marca, modelo, garantía). El catálogo de HU-02 (categoría como texto libre, un producto = una fila de stock) no lo representa.

## Contexto (código actual de HU-02)
- `products.category` es `VARCHAR(50)` libre; `GET /api/v1/products/categories` devuelve los textos distintos; el filtro es
  igualdad sin distinguir mayúsculas.
- `products.sku` (único, opcional) y `products.min_stock` están en el producto. `product_stock` es 1:1 con `products`
  (`@MapsId`), se crea con ceros en el alta y aún **no tiene movimientos** (HU-04 no ha empezado).
- HU-02 está mergeada en `develop` pero **sin publicar en producción** (`CHANGELOG.md`, «Sin publicar»): solo hay datos de
  dev/staging. Ningún cliente externo usa la API. **Es el momento más barato** para cambiar la clave del stock: después de
  HU-04 habría que migrar movimientos y costos.
- No se puede tocar `V3__products.sql` (ya mergeada): todo va en migraciones nuevas.

---

## Decisión 1: categorías en árbol

### Opciones
1. **Texto libre con separador** (`"Alimentos/Granos"`). Cero esquema, pero sin renombrar en bloque, sin i18n, sin desactivar,
   y los errores de tecleo crean categorías nuevas. Descartada.
2. **Tabla `categories` con `parent_id`** (lista de adyacencia). Simple, H2/PostgreSQL sin extensiones; las consultas de
   descendientes se resuelven en memoria (son decenas de filas).
3. **Árbol con `path` materializado o *closure table*.** Consultas por subárbol en SQL, pero más complejidad al renombrar
   o mover. Innecesario con este volumen.

### Recomendación: opción 2
- **Profundidad máxima 3** (`Alimentos › Granos › Arroz`); hoy se usan 2. Se guarda `depth` (1 = raíz) para validarla
  sin recorrer el árbol. Crear un hijo con `depth` > 3 → 400 `category.max_depth`.
- **Nombre único por padre**, sin distinguir mayúsculas: columna `name_key` con
  `UNIQUE NULLS NOT DISTINCT (parent_id, name_key)` para que también sean únicas las raíces (`parent_id` nulo).
  Verificado por Lupa (PR #11): funciona en H2 2.4.240 (modo PostgreSQL) y en PostgreSQL 18 (CI y Neon). Duplicado → 409
  `category.name_conflict`.
- **Normalización de claves en un solo sitio: la base de datos.** `name_key` = `LOWER(TRIM(name))` calculado por la BD,
  tanto en la migración (SQL) como en la aplicación (`@ColumnTransformer(write = "lower(trim(?))")` en la entidad, y la
  comprobación previa del Service compara con `lower(trim(:name))` en la consulta). Así migración y altas posteriores
  usan exactamente la misma función y la misma *collation*, también con `Á`/`Ñ`. El `name` ya llega recortado (`strip()`
  del DTO), así que el `TRIM` de la BD no difiere del de Java. Requisito: el `lc_ctype` de la base de Neon no debe ser
  `C`/`POSIX` (con esos, PostgreSQL solo pasa a minúsculas ASCII); Timon lo comprueba con `SHOW lc_ctype` (`C.UTF-8` o
  `en_US.UTF-8` valen).
- **Tildes: aviso, no bloqueo** (2026-11-09, a propuesta de Lienzo). `LOWER` no quita tildes: `Lacteos` y `Lácteos`
  no chocan. Bloquearlo exigiría `unaccent` (solo PostgreSQL, no existe en H2) o calcular la clave en Java (dos
  funciones de normalización, justo lo que se quiere evitar). Es un caso raro: el frontend avisa sin bloquear
  (HU-15 CA-6). `name_en` no es único.
- **i18n**: `name` (español, obligatorio, es la clave de unicidad) y `name_en` (opcional; si falta, se muestra `name`).
  Dos columnas en vez de tabla de traducciones: solo hay dos idiomas.
- **No se borra**: `active`. Desactivar una categoría con hijos activos → 409 `category.has_active_children`. Una categoría
  inactiva no se puede asignar a productos nuevos o editados (400 `category.inactive`); los productos que ya la tienen la
  conservan.
- **No se mueve** de padre en esta versión (solo se renombra). Evita ciclos, recálculo de `depth` y cambios de tipo
  (decisión 2). Si se necesita, se añade después con esas validaciones.
- El producto puede colgar de **cualquier nivel** (raíz o subcategoría): así los productos actuales siguen siendo válidos
  cuando se creen subcategorías y se reclasifican cuando haga falta. Filtrar por una categoría incluye sus descendientes
  (`category_id IN (…)`, ids calculados en memoria).
- La categoría pasa a ser **obligatoria** en el producto (ver decisión 2 y migración).

## Decisión 2: tipo de producto

### Opciones
- **A. El tipo es la categoría raíz** (el código reconoce «Ropa» por su id o nombre). Sin columna nueva, pero el
  comportamiento (qué campos pide el formulario) dependería de filas editables desde el panel: renombrar o crear una raíz
  rompería la lógica. Descartada.
- **B. Campo aparte en el producto** (`products.product_type`, enum). Independiente de la clasificación, pero redundante con
  las 3 raíces (el operador elige «Ropa» dos veces) y permite incoherencias (un pantalón en «Alimentos»).
- **C. Enum declarado en la categoría raíz y heredado por sus descendientes**; el tipo del producto se deriva de su categoría.
  Una sola fuente de verdad, el operador solo elige categoría, y el comportamiento sigue en código (enum), no en nombres.
  Exige categoría obligatoria y que una subcategoría no cambie de raíz (no se permite mover, decisión 1).

### Recomendación: opción C
- Enum `ProductType`: `FOOD`, `CLOTHING`, `APPLIANCE`, `OTHER` (`OTHER` para aseo, hogar, etc.; ver pregunta P-2).
  Textos visibles en los archivos de traducción del frontend; `OTHER` se muestra como «Aseo y hogar» / «Personal care &
  home» (decisión D-1 de la supervisión, 2026-11-09).
- `categories.product_type`: obligatorio al crear una **raíz**; los hijos lo copian de su padre (inmutable).
- Cambiar un producto a una categoría de **otro tipo** está permitido salvo que tenga variantes y el nuevo tipo no las
  admita (hoy todos las admiten, así que no hay bloqueo). El servidor **no anula** atributos por su cuenta: el `PUT` es un
  reemplazo completo y, si llegan atributos que no aplican al nuevo tipo (`model`, `warrantyMonths` fuera de `APPLIANCE`),
  responde **400** `product.attribute_not_allowed`. El frontend los vacía antes de enviar (HU-15 CA-18 y CA-26). Así no se
  pierden datos en silencio y la regla es la misma en alta y en edición.

### Atributos por tipo
| Atributo | Tipos | Columna |
|---|---|---|
| Marca | todos (útil también en alimentos) | `products.brand VARCHAR(80)` |
| Modelo | `APPLIANCE` | `products.model VARCHAR(80)` |
| Garantía (meses) | `APPLIANCE` | `products.warranty_months INTEGER` (0–120, informativa) |
| Talla, color | los de las variantes (decisión 3) | en `product_variants` |

Columnas nulas en `products` en lugar de JSON, EAV o tablas por subtipo: son tres campos, se validan con Bean Validation y
el Service, y se filtran con SQL normal. El Service rechaza `model`/`warrantyMonths` en tipos que no los admiten
(400 `product.attribute_not_allowed`). Si algún día hay muchos atributos por tipo, se reconsidera (JSONB o subtablas).

**Unidad por tipo**: `CLOTHING` y `APPLIANCE` solo admiten `UNIT` (400 `product.unit_not_allowed`); así HU-04 puede
exigir cantidades enteras para esos productos.

**Número de serie por unidad: no ahora.** Implicaría inventario por unidad (cada electrodoméstico con su estado: en stock,
reservado, vendido), que cambia HU-04 y HU-07 a fondo. Puerta abierta: una tabla futura
`serial_numbers (variant_id, serial, status, purchase_line_id, order_line_id)` encaja sobre el modelo propuesto sin cambiarlo.
Si solo hace falta para garantías, basta un campo de texto opcional en la línea del pedido al entregar (HU-07). Ver P-6.

## Decisión 3: variantes

### Opciones
1. **Cada variante es un producto independiente** («Camiseta azul M»). Cero esquema, pero sin agrupación: el catálogo se
   multiplica, no se puede ofrecer «elige talla» en combos ni en Combazo, y cambiar el nombre o el precio es N ediciones.
2. **Variantes como filas de `products` con `parent_id`.** Conserva el 1:1 de ADR-002 y los endpoints, pero mezcla en una
   tabla padres (sin stock) e hijos (con stock): cada consulta y cada regla de inventario tiene que distinguirlos
   («el padre no puede tener stock», «el hijo no tiene categoría propia»…), y los campos heredados quedan nulos o duplicados.
3. **Producto + tabla `product_variants`; la variante es lo vendible** (tiene SKU, umbral y stock). Todo producto tiene
   **al menos una variante**; un producto simple (arroz) tiene exactamente una, sin talla ni color, invisible en la interfaz.
   Es el modelo habitual de comercio electrónico.

### Recomendación: opción 3
- **El stock, los movimientos, las compras y los pedidos referencian siempre `variant_id`**: un único camino de código,
  sin casos especiales para «productos sin variantes».
- **Respuesta a Lupa (PR #10):** el 1:1 de ADR-002 se mantiene, pero **entre la variante y su caché**:
  `product_stock` se sustituye por `variant_stock (variant_id PK/FK)`. Bloqueo pesimista, punto único de escritura e
  invariante de reconciliación de ADR-002 quedan igual, ahora por variante. Dos pedidos por la misma camiseta en talla M
  y en talla L ya no compiten por la misma fila.
- **En la variante**: `sku` (único global, mismas reglas de HU-02), `size`, `color` (texto libre; `size` en mayúsculas),
  `min_stock`, `active`, `version`. Única por `(product_id, size, color_key)`, con `color_key` = `LOWER(TRIM(color))`
  calculado por la BD igual que `name_key`: `Rojo`/`rojo` chocan también en carrera, sin riesgo residual.
- **Orden de las variantes**: tallas en orden canónico `XXS, XS, S, M, L, XL, XXL, XXXL` (alias `2XL` = `XXL`,
  `3XL` = `XXXL`), después las numéricas de menor a mayor (`36`, `38`, `10.5`), después el resto alfabético, y sin talla
  al final; a igual talla, color alfabético. Lo aplica el Service al construir la respuesta (son pocas filas).
- **En el producto** se quedan: nombre, categoría (y por tanto tipo), unidad, marca, modelo, garantía, precio de
  referencia y `has_variants`.
  - `has_variants = false` ⇒ exactamente una variante, con `size` y `color` nulos.
  - `has_variants = true` ⇒ ≥ 1 variante, cada una con talla o color.
  - Pasar de simple a con variantes: la variante existente recibe su talla/color y **conserva su stock y movimientos**.
    Volver a simple solo si queda una sola variante (si no, 409 `product.has_multiple_variants`).
- **Costo promedio por variante** (es donde está el stock). Agregado por producto (listado, reportes), sobre **todas**
  sus variantes, activas o no: `onHand`, `reserved` y `available` = sumas; `averageCost` = promedio ponderado
  Σ(onHand·averageCost) / Σ onHand, ambos sobre las variantes con costo, `null` si ese Σ onHand = 0; `costCurrency` = `USD` si hay
  costo. Todas, porque desactivar una talla no hace desaparecer las unidades del almacén ni su valor; el detalle por
  variante muestra cuáles están inactivas (HU-16 CA-15).
- **Precio**: uno por producto (P-5 propone no tener precio por variante todavía; añadir `product_variants.sale_price`
  nullable más adelante no rompe nada).
- **Activo**: desactivar el producto impide usar cualquiera de sus variantes en operaciones nuevas; desactivar una variante
  (talla descatalogada) solo impide esa. Mismo código `product.inactive` / nuevo `variant.inactive`.

### Impacto en HU-04 (movimientos)
- `stock_movements.variant_id NOT NULL` (FK a `product_variants`); líneas de compra con `variant_id`. Nada de `product_id`
  en inventario: el producto se obtiene por la variante.
- En la interfaz de compras el operador elige el producto y, si `has_variants`, la variante (talla × color); si es simple,
  la única variante se usa sin preguntar.

## Combos (HU-06): solo lo que toca al modelo de producto
- `combo_items (combo_id, product_id NOT NULL, variant_id NULL, quantity)`:
  - producto simple → `variant_id` = su única variante (fijo, lo pone el Service);
  - producto con variantes → `variant_id` fijo, **o nulo = «se elige al vender»**; la línea del pedido (HU-07) siempre
    lleva `variant_id`, y es al crear el pedido cuando se reserva.
- **Mixtos**: la receta no restringe el tipo; un combo puede mezclar alimentos, ropa y electrodomésticos sin cambios de modelo.
- La rebaja opcional es del combo (precio fijo o descuento), no del producto: no afecta a este ADR.
- A resolver en HU-06 (no aquí): disponibilidad y costo estimado de una línea «se elige al vender» (p. ej. disponible si
  alguna variante activa tiene stock suficiente; costo = el mayor de sus variantes).

---

## Modelo de datos propuesto

```sql
-- V4: categorías y tipo (esquema orientativo; el definitivo está en HU-15 y HU-16)
CREATE TABLE categories (
    id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    parent_id     BIGINT REFERENCES categories (id),
    name          VARCHAR(60) NOT NULL,          -- español
    name_en       VARCHAR(60),                   -- opcional; fallback a name
    name_key      VARCHAR(60) NOT NULL,          -- LOWER(TRIM(name)), calculado por la BD (@ColumnTransformer)
    product_type  VARCHAR(20) NOT NULL,          -- FOOD | CLOTHING | APPLIANCE | OTHER; heredado de la raíz
    depth         INTEGER     NOT NULL,          -- 1 = raíz, máx. 3 (INTEGER ↔ Integer/int, sin choques con validate)
    active        BOOLEAN     NOT NULL DEFAULT TRUE,
    version       BIGINT      NOT NULL DEFAULT 0,
    created_at …, updated_at …, created_by …, updated_by …,
    CONSTRAINT uk_categories_parent_name UNIQUE NULLS NOT DISTINCT (parent_id, name_key),
    CONSTRAINT ck_categories_depth CHECK ((parent_id IS NULL AND depth = 1) OR (parent_id IS NOT NULL AND depth BETWEEN 2 AND 3))
);
CREATE INDEX idx_categories_parent ON categories (parent_id);

ALTER TABLE products ADD COLUMN category_id BIGINT REFERENCES categories (id);   -- NOT NULL tras migrar los datos
ALTER TABLE products ADD COLUMN brand VARCHAR(80);
ALTER TABLE products ADD COLUMN model VARCHAR(80);
ALTER TABLE products ADD COLUMN warranty_months INTEGER;                           -- CHECK 0..120
CREATE INDEX idx_products_category ON products (category_id);
-- después de migrar: DROP COLUMN category

-- V5: variantes (sustituye a product_stock)
CREATE TABLE product_variants (
    id         BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    product_id BIGINT        NOT NULL REFERENCES products (id),
    sku        VARCHAR(50),
    size       VARCHAR(20),
    color      VARCHAR(30),
    color_key  VARCHAR(30),                      -- LOWER(TRIM(color)), calculado por la BD
    min_stock  NUMERIC(12,3) NOT NULL DEFAULT 0,
    active     BOOLEAN       NOT NULL DEFAULT TRUE,
    version    BIGINT        NOT NULL DEFAULT 0,
    created_at …, updated_at …, created_by …, updated_by …,
    CONSTRAINT uk_product_variants_sku UNIQUE (sku),
    CONSTRAINT uk_product_variants_options UNIQUE NULLS NOT DISTINCT (product_id, size, color_key),
    CONSTRAINT ck_product_variants_min_stock CHECK (min_stock >= 0)
);
CREATE INDEX idx_product_variants_product ON product_variants (product_id);

CREATE TABLE variant_stock (                     -- misma estructura y reglas que product_stock (ADR-002)
    variant_id    BIGINT PRIMARY KEY REFERENCES product_variants (id),
    on_hand       NUMERIC(14,3) NOT NULL DEFAULT 0,
    reserved      NUMERIC(14,3) NOT NULL DEFAULT 0,
    average_cost  NUMERIC(14,4),
    cost_currency VARCHAR(3),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_variant_stock_non_negative CHECK (on_hand >= 0 AND reserved >= 0)
);

ALTER TABLE products ADD COLUMN has_variants BOOLEAN NOT NULL DEFAULT FALSE;
-- después de migrar: DROP TABLE product_stock; DROP CONSTRAINT uk_products_sku; DROP COLUMN sku, min_stock
```
Diagrama: [er.md, sección «Modelo ADR-003»](../diagrams/er.md#modelo-adr-003-v4-implementada-v5-pendiente).

### Migración de datos (solo hay datos de dev/staging)
**V4 (categorías):**
1. Insertar las 4 raíces: `Alimentos`/`Food` (`FOOD`), `Ropa`/`Clothing` (`CLOTHING`),
   `Electrodomésticos`/`Appliances` (`APPLIANCE`) y `Aseo y hogar`/`Personal care & home` (`OTHER`, P-2), con
   `created_by = 'system'`.
2. Para cada `products.category` distinto (sin distinguir mayúsculas, `GROUP BY LOWER(TRIM(category))`):
   si coincide con el nombre es/en de una de las 4 raíces **o con uno de sus alias** (lista corta y explícita en HU-15
   CA-22: p. ej. `aseo`, `limpieza`, `higiene` → «Aseo y hogar»; `calzado` → «Ropa») → esa raíz; si no →
   **subcategoría bajo `Alimentos`** (hasta hoy el negocio solo vendía alimentos; ver P-8). Los alias evitan que el
   texto «Aseo» de HU-02 acabe como `Alimentos › Aseo` con tipo `FOOD`.
3. `products.category_id` según el paso 2; los que no tenían categoría → `Alimentos`. Luego `category_id NOT NULL` y
   `DROP COLUMN category`.

**V5 (variantes):**
1. Una variante por producto: copia `sku`, `min_stock`, auditoría; `size`/`color` nulos; `has_variants = false`.
2. `variant_stock` desde `product_stock` (todo ceros hoy). Drop de `product_stock`, de `uk_products_sku` (explícito, antes
   de la columna, por H2) y de `products.sku` / `min_stock`.
3. Test de migración: mismo número de productos, variantes y filas de stock; SKU conservados.

## Impacto en la API (`/api/v1`)
Como HU-02 no está publicada, los cambios incompatibles no afectan a nadie; se documentan en `CHANGELOG.md`.

| Método | Ruta | Rol | Notas |
|---|---|---|---|
| GET | `/categories?active=` | ADMIN, OPERATOR | Lista plana con `id, parentId, name, nameEn, productType, depth, active, path` (`"Alimentos › Granos"`); el frontend arma el árbol. Sustituye a `/products/categories` (se elimina). |
| POST | `/categories` | ADMIN (P-4, confirmado) | `CreateCategoryRequest(name, nameEn, parentId, productType)`; `productType` obligatorio solo si `parentId` es nulo (si no, 400 `category.type_inherited`). |
| PUT | `/categories/{id}` | ADMIN (P-4, confirmado) | `name`, `nameEn`, `version` (no cambia padre ni tipo). |
| POST | `/categories/{id}/activate` · `/deactivate` | ADMIN | Idempotentes como en productos. |
| GET/POST/PUT | `/products…` | igual que HU-02 | Entrada: `categoryId` (obligatorio) en vez de `category`; `brand`, `model`, `warrantyMonths`; sin `sku`/`minStock` si `hasVariants`. Respuesta: `category {id, name, nameEn, path}`, `type`, `hasVariants`, y para productos simples `sku`, `minStock`, `stock` como hoy (de su única variante); con variantes, `stock` agregado (suma) y `variantCount`. Filtros nuevos: `categoryId` (incluye descendientes), `type`. `q` busca también en los SKU de las variantes. Orden por `sku`: se propone retirarlo (con variantes deja de ser único por producto; el frontend no lo usa). |
| GET | `/products/{id}` | ADMIN, OPERATOR | Incluye `variants[]` con `id, sku, size, color, minStock, active, stock, lowStock, version`. |
| POST | `/products/{id}/variants` | ADMIN, OPERATOR | Una variante, o una lista para crear la rejilla talla × color en una transacción. |
| PUT | `/products/{id}/variants/{variantId}` | ADMIN, OPERATOR | `sku`, `size`, `color`, `minStock`, `version`. |
| POST | `/products/{id}/variants/{variantId}/activate` · `/deactivate` | ADMIN | Como productos. |

Códigos nuevos (es/en): `category.not_found`, `category.name_conflict`, `category.max_depth`, `category.inactive`,
`category.has_active_children`, `category.type_inherited`, `product.attribute_not_allowed`, `product.unit_not_allowed`,
`product.has_multiple_variants`, `variant.not_found`, `variant.options_conflict`, `variant.options_required`,
`variant.inactive`. `product.sku_conflict` se mantiene (ahora sobre variantes). La lista definitiva, con los
endpoints de conversión, está en HU-15 y HU-16.

Módulos: `category` (paquete nuevo) y `product` (incluye variantes). `variant_stock` pasa a ser del futuro módulo
`inventory` (HU-04), igual que preveía ADR-002.

## Impacto en el frontend (`cuartico-web`)
- **Página nueva «Categorías»** (solo `ADMIN`): árbol con crear raíz/subcategoría, renombrar (es/en) y activar/desactivar.
- **Formulario de producto**: selector de categoría con rutas indentadas (`Alimentos › Granos`); el tipo se muestra derivado
  y decide qué campos aparecen (modelo y garantía solo en electrodomésticos; unidad fija en `UNIT` para ropa y
  electrodomésticos); interruptor «Tiene variantes» y sección de variantes con generador de rejilla talla × color, cada
  fila con SKU, umbral, activo y stock de solo lectura.
- **Listado**: columna de categoría con ruta, filtro por tipo y por categoría (árbol), «N variantes» y stock agregado.
- Nombre de categoría según idioma: `nameEn ?? name` en inglés. Etiquetas de tipo en los archivos de traducción.
- Necesita prototipo de Lienzo (formulario con variantes y página de categorías) y aprobación de la supervisión.

## Plan por fases
| Fase | Qué | Cuándo |
|---|---|---|
| 1 | **Categorías + tipo + atributos** (V4, módulo `category`, página de categorías, cambios en el formulario y el listado). Historia nueva. | Antes de HU-04 |
| 2 | **Variantes** (V5, `variant_stock` sustituye a `product_stock`, sección de variantes). Historia nueva. Imprescindible antes de HU-04: los movimientos nacen con `variant_id`. | Antes de HU-04 |
| 3 | Despliegue a producción con las 4 raíces. Las subcategorías se crean desde el panel: **datos, no código**. Completar `name_en`. | Tras el release |
| 4 | Según uso real: precio por variante, mover categorías, orden manual de categorías, números de serie, imagen por variante (color) para Combazo. | Cuando haga falta |

Fase 1 = [HU-15](../stories/HU-15-categories-and-type-attributes.md); fase 2 = [HU-16](../stories/HU-16-product-variants.md).

## Consecuencias
- (+) Un solo modelo para alimentos, ropa y electrodomésticos; inventario, compras, pedidos y combos trabajan siempre con
  `variant_id`, sin casos especiales.
- (+) Las categorías crecen desde el panel sin despliegues; el comportamiento por tipo vive en código (enum), no en nombres.
- (+) ADR-002 sigue valiendo, con la concurrencia ahora por variante (menos contención).
- (+) El cambio se hace antes de que existan movimientos y antes de publicar HU-02: migración trivial.
- (−) Rehacer parte de HU-02 (backend, frontend y tests) recién terminada; la API de productos cambia de forma incompatible.
- (−) Una fila de variante «invisible» por producto simple (un `JOIN` más).
- (−) Sin mover categorías ni precio por variante hasta que se necesiten.

## Preguntas a la supervisión y respuestas (2026-11-09)
«Recomendación» = se aplica la recomendación de Faro salvo que la supervisión diga lo contrario.

| # | Pregunta | Recomendación de Faro | Respuesta |
|---|---|---|---|
| P-1 | ¿El tipo se hereda de la categoría raíz (opción C) en vez de elegirse aparte en cada producto? | Sí, opción C. | Recomendación |
| P-2 | Jabón, detergente, pasta dental… ¿qué son? ¿Añadimos un tipo `OTHER` y una 4.ª raíz (p. ej. «Aseo y hogar»)? | Sí: tipo `OTHER` ya en el enum; crear la raíz «Aseo y hogar» si hoy se venden. | **Sí**: 4.ª raíz «Aseo y hogar» (`OTHER`), creada por la migración V4. |
| P-3 | ¿Profundidad máxima de 3 niveles (`Alimentos › Granos › Arroz`)? | Sí, 3 (hoy se usarán 2). | Recomendación |
| P-4 | ¿Quién gestiona las categorías? | Solo `ADMIN` crea, renombra y desactiva; `OPERATOR` solo las usa. | **Solo `ADMIN`.** |
| P-5 | ¿Precio distinto por talla/color (p. ej. XL más cara)? | No por ahora: precio por producto; se añade por variante si aparece el caso. | **Sin precio por variante** por ahora. |
| P-6 | ¿Hace falta número de serie de electrodomésticos? ¿Para qué (garantía, control de robo)? | No como inventario por unidad. Si es para garantía, un texto opcional en la línea del pedido al entregar (HU-07). | **Sin número de serie**; como mucho, texto opcional al entregar (HU-07). |
| P-7 | ¿La garantía la da el negocio o es la del fabricante? ¿Basta con «meses de garantía» informativo? | Meses, informativo. Gestionar reclamaciones queda fuera. | Recomendación |
| P-8 | Migración: las categorías de texto actuales que no sean «Alimentos/Ropa/Electrodomésticos» pasan a subcategorías de Alimentos (solo hay datos de dev/staging). ¿De acuerdo? | Sí. | Recomendación (con «Aseo y hogar» como 4.ª raíz reconocida) |
| P-9 | Ejes de variante: ¿bastan talla y color (texto libre)? ¿Hace falta otro (p. ej. voltaje 110/220 V en electrodomésticos)? | Talla y color; el voltaje como productos distintos hasta que se repita mucho. | Recomendación |
| P-10 | ¿Los nombres de productos también necesitarán inglés (Combazo)? | No ahora: solo las categorías llevan `name_en`; los productos se revisan en la fase 2 (Combazo). | Recomendación |
| P-11 | En combos con ropa: ¿se permiten ambas modalidades (talla fija en el combo o elegida al vender)? | Sí, ambas; el detalle de disponibilidad se decide en HU-06. | Recomendación |
