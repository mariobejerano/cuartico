# HU-15: Categorías y atributos por tipo

- **Sprint:** — (antes de HU-04) · **Estado:** analizada; pendiente de prototipo (Lienzo) y aprobación de la supervisión.
- **Alcance:** backend (módulo nuevo `category`, cambios en `product`, migración **V4**) y frontend (`cuartico-web`).
- **Decisión:** [ADR-003](../adr/ADR-003-categories-types-variants.md) (decisiones 1 y 2). **Depende de:** HU-02.
  **La sigue:** [HU-16](HU-16-product-variants.md) (variantes, V5).
- **Decisiones de la supervisión (2026-11-09):** 4 raíces iniciales (Alimentos, Ropa, Electrodomésticos, Aseo y hogar);
  solo `ADMIN` gestiona categorías; sin número de serie; garantía en meses, informativa; máximo 3 niveles; el tipo se
  hereda de la categoría raíz.

## Necesidad
El negocio vende alimentos, ropa, electrodomésticos y artículos de aseo, y quiere clasificarlos en categorías y
subcategorías gestionadas desde el panel (no en texto libre), y registrar los datos propios de cada tipo (marca, modelo,
garantía).

## Historia
**Como** administrador,
**quiero** gestionar un árbol de categorías y que cada producto pertenezca a una, con los campos de su tipo,
**para** tener el catálogo ordenado, filtrarlo bien y, más adelante, mostrarlo por secciones en Combazo.

## Conceptos
- **Categoría**: nodo de un árbol de hasta 3 niveles (`depth` 1 = raíz). Nombre en español obligatorio y en inglés opcional
  (si falta, se muestra el español). No se borra: se desactiva. No cambia de padre (solo se renombra).
- **Tipo de producto** (`ProductType`): `FOOD`, `CLOTHING`, `APPLIANCE`, `OTHER`. Se elige al crear una **raíz** y lo
  heredan sus descendientes; el tipo de un producto es el de su categoría. Textos visibles en el frontend.
- **Atributos por tipo**: `brand` (todos), `model` y `warrantyMonths` (solo `APPLIANCE`). Ropa y electrodomésticos solo
  admiten la unidad `UNIT`.

## Criterios de aceptación

### Gestión de categorías
- **CA-1 Raíces iniciales.** Tras la migración existen 4 raíces activas: `Alimentos`/`Food` (`FOOD`), `Ropa`/`Clothing`
  (`CLOTHING`), `Electrodomésticos`/`Appliances` (`APPLIANCE`) y `Aseo y hogar`/`Personal care & home` (`OTHER`).
- **CA-2 Crear raíz.** Dado un `ADMIN`, cuando crea una categoría sin `parentId` con `name`, `nameEn` opcional y
  `productType`, entonces **201** con `depth = 1`, `active = true`, `version = 0`, `path = name`. Sin `productType`
  → **400** `category.type_required`.
- **CA-3 Crear subcategoría.** Dado un padre activo de `depth` 1 o 2, cuando se crea un hijo, entonces **201** con
  `depth = padre + 1`, `productType` = el del padre y `path` = `"Alimentos › Granos"`. Si se envía `productType` (aunque
  coincida) → **400** `category.type_inherited`.
- **CA-4 Profundidad.** Crear un hijo bajo una categoría de `depth = 3` → **400** `category.max_depth`.
- **CA-5 Padre inválido.** `parentId` inexistente → **404** `category.not_found`; padre inactivo → **409**
  `category.parent_inactive`.
- **CA-6 Nombre único por padre.** Dado `Granos` bajo `Alimentos`, cuando se crea `  granos ` bajo `Alimentos` (o se
  renombra otra hija a ese nombre), entonces **409** `category.name_conflict`. `Granos` bajo `Ropa` sí se permite.
  Dos raíces con el mismo nombre (sin distinguir mayúsculas) → **409**. Dos altas simultáneas iguales → una 201 y otra
  409 (la restricción de BD es la garantía final, nunca 500). Las categorías inactivas también cuentan.
- **CA-7 Normalización y validación.** `name` y `nameEn` se recortan; `nameEn` vacío → `null`. `name` vacío o de más de
  60 caracteres, o `nameEn` de más de 60 → **400** `validation.failed` con `errors` por campo.
- **CA-8 Renombrar.** `PUT` con `name`, `nameEn` y `version` → **200**, `version + 1`; las rutas (`path`) de sus
  descendientes y de los productos reflejan el nombre nuevo. Versión antigua → **409** `resource.version_conflict`.
  El `PUT` no cambia padre ni tipo (esos campos no existen en el DTO de edición).
- **CA-9 Desactivar.** Dada una categoría sin hijas activas, cuando un `ADMIN` la desactiva, entonces **200** con
  `active = false`; sus productos la conservan. Con alguna hija activa → **409** `category.has_active_children`.
- **CA-10 Reactivar.** Reactivar una categoría cuyo padre está inactivo → **409** `category.parent_inactive`.
  Activar/desactivar es idempotente (**200** sin nueva versión).
- **CA-11 Sin borrado.** `DELETE /api/v1/categories/{id}` → **405** `request.method_not_allowed`.
- **CA-12 Listado.** `GET /api/v1/categories` (`?active=true|false`, ausente = todas) devuelve la lista plana ordenada
  por `path` (sin distinguir mayúsculas), sin paginar, con `id, parentId, name, nameEn, productType, depth, active,
  path, pathEn, version`. `pathEn` usa `nameEn` de cada nivel o, si falta, `name`.

### Productos
- **CA-13 Categoría obligatoria.** Alta o edición de producto sin `categoryId` → **400** `validation.failed`
  (`errors.categoryId`); inexistente → **400** `product.category_not_found` (400 y no 404: el recurso de la URL sí
  existe); inactiva → **400** `category.inactive`. Un producto que **ya** está en una categoría desactivada se puede
  editar sin cambiarla.
- **CA-14 Cualquier nivel.** Un producto puede colgar de una raíz o de una subcategoría.
- **CA-15 Tipo derivado.** La respuesta del producto incluye `type` (el de su categoría) y
  `category {id, name, nameEn, path, pathEn, active}`. El cuerpo de entrada no admite `type`: si llega, se ignora.
- **CA-16 Atributos.** `brand` (≤ 80, recortado, vacío → `null`) en cualquier tipo. `model` (≤ 80) y `warrantyMonths`
  (entero 0–120) solo si el tipo es `APPLIANCE`; en otro tipo, con valor no nulo → **400**
  `product.attribute_not_allowed` (con `{0}` = campo).
- **CA-17 Unidad por tipo.** En `CLOTHING` o `APPLIANCE` con `unit ≠ UNIT` → **400** `product.unit_not_allowed`.
- **CA-18 Cambio de categoría y de tipo.** Mover un producto de `Electrodomésticos` a `Alimentos` exige enviar
  `model = null` y `warrantyMonths = null` (si no, CA-16); mover a `Ropa` con `unit = KG` → CA-17.
- **CA-19 Filtros.** `GET /api/v1/products?categoryId=` incluye los productos de la categoría **y de sus descendientes**;
  `type=FOOD|CLOTHING|APPLIANCE|OTHER` filtra por tipo; ambos combinables con `q` y `active`. `categoryId` inexistente
  → `content` vacío (no error). `type` desconocido → **400** `validation.failed` (`errors.type`).
- **CA-20 Orden.** `sort` admite `name`, `sku`, `createdAt`; `category` deja de admitirse (**400** `request.invalid_sort`).
- **CA-21 Endpoint retirado.** `GET /api/v1/products/categories` deja de existir (**404**).

### Migración (V4)
- **CA-22 Texto → categoría.** Dados productos con `category` = `"alimentos"`, `"ROPA"`, `"Granos"`, `"granos"` y `null`,
  tras V4: los dos primeros quedan en las raíces `Alimentos` y `Ropa`; los dos `Granos` en **una** subcategoría `Granos`
  bajo `Alimentos`; el de `null` en `Alimentos`. La columna `products.category` ya no existe y `category_id` es `NOT NULL`.
  Ningún producto cambia de `id`, `sku`, precio ni stock.

### Permisos
- **CA-23** Sin token → **401** en todos los endpoints de categorías.
- **CA-24** `ADMIN` y `OPERATOR` listan y consultan categorías. Solo `ADMIN` crea, renombra, activa y desactiva;
  `OPERATOR` → **403** `auth.forbidden` y en el frontend no ve la página «Categorías» ni su entrada de menú.

### Frontend
- **CA-25 Página «Categorías»** (`/categories`, solo `ADMIN`): árbol con nombre (en el idioma de la interfaz), tipo
  (solo en las raíces) y estado; acciones «Nueva categoría» (raíz, con tipo), «Añadir subcategoría» (oculta en el nivel 3
  y en categorías inactivas), «Renombrar» (es/en) y activar/desactivar con confirmación. Errores de `errors` junto a cada
  campo y `category.name_conflict` en el campo nombre.
- **CA-26 Formulario de producto.** Selector de categoría con las activas como rutas indentadas
  (`Alimentos › Granos`); si el producto está en una inactiva, se muestra también, marcada «(inactiva)». El tipo se ve
  como etiqueta derivada. `brand` siempre; `model` y «Garantía (meses)» solo si el tipo es `APPLIANCE`; si el tipo es
  `CLOTHING` o `APPLIANCE`, la unidad queda fija en «Unidad» (deshabilitada). Al cambiar a una categoría de otro tipo,
  los campos que no aplican se vacían antes de enviar.
- **CA-27 Listado.** Columna «Categoría» con la ruta; filtros «Tipo» y «Categoría» (árbol; incluye subcategorías). En la
  URL: `?type=&cat=<id>` (antes `cat` era texto: un enlace antiguo con texto se ignora y muestra todas).
- **CA-28** Todos los textos (tipos incluidos) en es/en; nombres de categoría con `nameEn ?? name` en inglés. En móvil
  (360 px) la página de categorías no tiene desplazamiento horizontal.

## Fuera de alcance
- Mover una categoría de padre; ordenar categorías a mano; imágenes de categoría (Combazo).
- Variantes, SKU y umbral por variante (HU-16).
- Número de serie; gestión de reclamaciones de garantía.
- Nombres de producto en inglés (fase 2, Combazo).

## Diseño técnico (backend)

### Paquete `com.cuartico.category`
`Category` (entidad, `AuditableEntity`, `@Version`, `@ManyToOne(fetch = LAZY) parent`), `ProductType` (enum, en
`category` porque es atributo de la categoría; `product` lo usa), `CategoryRepository`, `CategoryService`,
`CategoryController`, `dto/CategoryDtos.java`. `Product` pasa a tener `@ManyToOne(optional = false) Category category`
y los campos `brand`, `model`, `warrantyMonths`.

### Migración `V4__categories.sql` (orientativa; Forja-Back ajusta la sintaxis común H2/PostgreSQL)
```sql
CREATE TABLE categories (
    id           BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    parent_id    BIGINT REFERENCES categories (id),
    name         VARCHAR(60) NOT NULL,
    name_en      VARCHAR(60),
    name_key     VARCHAR(60) NOT NULL,
    product_type VARCHAR(20) NOT NULL,
    depth        SMALLINT    NOT NULL,
    active       BOOLEAN     NOT NULL DEFAULT TRUE,
    version      BIGINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by   VARCHAR(50),
    updated_by   VARCHAR(50),
    CONSTRAINT uk_categories_parent_name UNIQUE NULLS NOT DISTINCT (parent_id, name_key),
    CONSTRAINT ck_categories_depth CHECK ((parent_id IS NULL AND depth = 1)
                                       OR (parent_id IS NOT NULL AND depth BETWEEN 2 AND 3)),
    CONSTRAINT ck_categories_type CHECK (product_type IN ('FOOD', 'CLOTHING', 'APPLIANCE', 'OTHER'))
);
CREATE INDEX idx_categories_parent ON categories (parent_id);

-- 1. Raíces (created_by = 'system', created_at = updated_at = CURRENT_TIMESTAMP)
-- 2. Subcategorías bajo Alimentos para cada LOWER(category) distinto que no coincida con el name/name_en de una raíz
--    (nombre = MIN(category) del grupo, name_key = LOWER(TRIM(...)))
-- 3. ALTER TABLE products ADD category_id BIGINT; UPDATE según 1–2; los NULL → Alimentos;
--    ALTER COLUMN category_id SET NOT NULL; FK fk_products_category; índice idx_products_category
-- 4. ALTER TABLE products ADD brand VARCHAR(80), model VARCHAR(80), warranty_months SMALLINT
--    con CHECK (warranty_months IS NULL OR warranty_months BETWEEN 0 AND 120)
-- 5. ALTER TABLE products DROP COLUMN category
```
- **Verificar en H2** `UNIQUE NULLS NOT DISTINCT` (PostgreSQL ≥ 15 lo admite). Si H2 no lo admite: quitar la cláusula,
  comprobar en el Service las raíces duplicadas y aceptar que la carrera entre dos raíces iguales solo la frene
  PostgreSQL (documentarlo). La unicidad de hijas no depende de esto.
- Test de migración (Vera): CA-22 con datos sembrados antes de V4 (Flyway `target` o script de test).

### Endpoints
| Método | Ruta | Rol | OK | Errores |
|---|---|---|---|---|
| GET | `/api/v1/categories?active=` | ADMIN, OPERATOR | 200 `List<CategoryResponse>` | 400 `validation.failed` |
| GET | `/api/v1/categories/{id}` | ADMIN, OPERATOR | 200 `CategoryResponse` | 404 `category.not_found` |
| POST | `/api/v1/categories` | ADMIN | 201 + `Location` | 400 `validation.failed`, `category.type_required`, `category.type_inherited`, `category.max_depth`; 404 `category.not_found` (padre); 409 `category.name_conflict`, `category.parent_inactive` |
| PUT | `/api/v1/categories/{id}` | ADMIN | 200 | 400 `validation.failed`; 404; 409 `category.name_conflict`, `resource.version_conflict` |
| POST | `/api/v1/categories/{id}/deactivate` | ADMIN | 200 | 404; 409 `category.has_active_children` |
| POST | `/api/v1/categories/{id}/activate` | ADMIN | 200 | 404; 409 `category.parent_inactive` |
| GET/POST/PUT | `/api/v1/products…` | como HU-02 | | además: 400 `product.category_not_found`, `category.inactive`, `product.attribute_not_allowed`, `product.unit_not_allowed` |
| ~~GET~~ | ~~`/api/v1/products/categories`~~ | | se elimina | |

### DTOs
```java
record CreateCategoryRequest(@NotBlank @Size(max = 60) String name, @Size(max = 60) String nameEn,
                             Long parentId, ProductType productType) {}          // strip; nameEn vacío → null
record UpdateCategoryRequest(@NotBlank @Size(max = 60) String name, @Size(max = 60) String nameEn,
                             @NotNull Long version) {}
record CategoryResponse(Long id, Long parentId, String name, String nameEn, ProductType productType, int depth,
                        boolean active, String path, String pathEn, long version,
                        Instant createdAt, String createdBy, Instant updatedAt, String updatedBy) {}
record CategoryRef(Long id, String name, String nameEn, String path, String pathEn, boolean active) {}

// ProductDtos: category (String) → @NotNull Long categoryId; nuevos:
//   @Size(max = 80) String brand, @Size(max = 80) String model, @Min(0) @Max(120) Integer warrantyMonths
// ProductResponse: category (String) → CategoryRef category; nuevos: ProductType type, brand, model, warrantyMonths
// ProductQuery: category (String) → Long categoryId; nuevo ProductType type
```

### Reglas en `CategoryService` (`@Transactional`)
- `name_key = name.strip().toLowerCase(Locale.ROOT)`. Comprobación previa de duplicado + `saveAndFlush` capturando la
  violación de `uk_categories_parent_name` → `category.name_conflict` (mismo patrón que el SKU en HU-02).
- Las rutas (`path`, `pathEn`) se calculan en memoria: el servicio carga todas las categorías (decenas) en un mapa por id.
  Lo mismo para los descendientes del filtro de productos (`descendantIds(id)`, incluido el propio id).
- Desactivar: comprueba hijas activas en la misma transacción. Carrera residual (alguien crea una hija activa mientras
  otro desactiva el padre): para evitarla, crear hija y desactivar bloquean la fila del **padre** con
  `PESSIMISTIC_WRITE` (operaciones raras; el coste es nulo).

### Reglas en `ProductService`
- Carga la categoría (`product.category_not_found` / `category.inactive` si cambia a una inactiva), deriva el tipo y
  valida atributos y unidad (CA-16, CA-17). La normalización de `brand`/`model` va en el constructor compacto del DTO.
- Filtro `categoryId` → `category.id IN (:ids)`; filtro `type` → `category.productType = :type`.
- Listado: `JOIN FETCH` de la categoría además del stock (sin N+1); la ruta sale del mapa en memoria.

### i18n (es/en)
`category.not_found` (`{0}` = id), `category.name_conflict` (`{0}` = nombre), `category.max_depth`, `category.inactive`,
`category.parent_inactive`, `category.has_active_children`, `category.type_required`, `category.type_inherited`,
`product.category_not_found` (`{0}` = id), `product.attribute_not_allowed` (`{0}` = campo), `product.unit_not_allowed`.
Frontend: etiquetas de `ProductType`, textos de la página de categorías, nuevos campos del formulario.

## Impacto sobre HU-02 (qué se rehace)
| Pieza | Cambio |
|---|---|
| `Product`, `ProductDtos`, `ProductService` | `category` texto → `Category`; `brand`, `model`, `warrantyMonths`; validaciones por tipo; filtros `categoryId`/`type`; se quita `category` de `SORT_FIELDS`; se elimina `categories()` y su endpoint. |
| Tests de HU-02 | Reescribir CA-2 (parte de `category`), CA-19, CA-21 (orden por categoría) y CA-22; todos los altas de test necesitan `categoryId` (helper/fixture con las raíces). |
| `cuartico-web` | `productSchema`, `ProductFormPage` (selector de categoría, campos por tipo), `ProductsListPage` y `listQuery` (`cat` pasa a id, filtro de tipo), `queries` (hook de categorías), tests de componente; página nueva de categorías y entrada de menú solo `ADMIN`. |
| Docs | API y errores del backend, matriz QA de HU-02 (CA sustituidos), guía del panel, `CHANGELOG.md`. |
Como HU-02 no está publicada en producción, no hay compatibilidad hacia atrás que mantener.

## Impacto futuro
- **HU-16**: V5 parte de este esquema (los productos ya tienen categoría y tipo).
- **HU-04**: exigirá cantidades enteras en productos con `unit = UNIT` (garantizado para ropa y electrodomésticos).
- **Combazo**: el árbol con `nameEn` sirve para el menú público; faltarán imagen y orden manual (columnas nuevas).
