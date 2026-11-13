# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Secciones: `Added`, `Changed`, `Fixed`.

## [Sin publicar]

Cambios en `develop`, pendientes de la próxima release.

### Added
- Documentación OpenAPI con springdoc: Swagger UI en `/swagger-ui.html` y JSON en `/v3/api-docs` (activos en `dev` y `test`; en `prod` solo con `SPRINGDOC_ENABLED=true`). (PR #5)
- Códigos de error estables en la propiedad `code` de cada ProblemDetail, con `detail` traducido (es/en) según `Accept-Language`. Errores de validación con `errors` por campo. (PR #5)
- Panel `cuartico-web` (React 19 + TypeScript + Vite): pantalla de login, sesión con renovación automática del access token, layout con barra lateral, barra inferior y hoja de cuenta, textos en es/en y manifest PWA con iconos. (HU-01, PR #9)
- Ventana de gracia de 120 s en el refresh token: si la respuesta de `/api/v1/auth/refresh` se pierde por red, el reintento recibe un par nuevo en lugar de cerrar todas las sesiones del usuario. Migración `V2__refresh_token_grace.sql`. (HU-01, PR #9)
- Workflow `frontend-ci.yml` en GitHub Actions: lint, tests y build de `cuartico-web`. Todavía no es check obligatorio. (HU-01, PR #9)
- Sitio estático `cuartico-web-staging` en `render/staging.yaml` (rama `develop`), con rewrite de SPA y cabeceras de seguridad. (HU-01, PR #9)
- Catálogo de productos en la API: `GET /api/v1/products` (búsqueda por nombre o SKU, filtros, orden y paginación), `GET /api/v1/products/categories` (retirado en HU-15), `GET`, `POST` y `PUT /api/v1/products/{id}`, y `activate`/`deactivate` (solo `ADMIN`). SKU único (sin distinguir mayúsculas), bloqueo optimista con `version` y stock y costo en solo lectura. Migración `V3__products.sql` (tablas `products` y `product_stock`, ADR-002). (HU-02)
- Monedas admitidas por configuración (`app.currencies.supported`: CUP, USD; `app.currencies.reference`: USD), sin migración para añadir una. (HU-02)
- Códigos de error `product.not_found`, `product.sku_conflict`, `product.price_currency_mismatch`, `product.currency_unsupported`, `resource.version_conflict`, `request.invalid_sort` y `validation.invalid_value`, traducidos es/en. (HU-02)
- Panel `cuartico-web`: listado de productos (búsqueda, filtros, orden y página en la URL; tabla en escritorio y tarjetas en móvil), formulario de alta y edición con errores junto a cada campo y aviso de conflicto de versión, activar/desactivar solo para `ADMIN` con confirmación y «Deshacer», y avisos (toasts). (HU-02)
- Tests del catálogo: `ProductIntegrationTests` y `ProductEdgeCaseTests` (MockMvc), tests de componente en Vitest y matriz CA → tests en `docs/qa/stories/HU-02.md`. (HU-02)
- Documentación del catálogo: API, errores y arquitectura del backend, panel y guía de aprendizaje de React (temas 14 a 18). (HU-02)
- Documentación de análisis y diseño del sprint 1: historias HU-01, HU-02 y HU-14, ADR-001 (almacenamiento de tokens en el frontend) y ADR-002 (stock en caché), design system, prototipos de login y productos, y textos es/en. (PR #8)
- Categorías en árbol de hasta 3 niveles (módulo `category`): `GET /api/v1/categories` (filtro `active`), `GET /{id}`, `POST`, `PUT /{id}` (renombrar), y `activate`/`deactivate`. Sin borrado (405). Nombre único entre hermanas sin distinguir mayúsculas (activas e inactivas). Solo `ADMIN` escribe; `ADMIN` y `OPERATOR` leen. Migración `V4__categories.sql`. (HU-15)
- Cuatro categorías raíz iniciales, cada una con su tipo de producto (`FOOD`, `CLOTHING`, `APPLIANCE`, `OTHER`): Alimentos, Ropa, Electrodomésticos y Aseo y hogar. Las subcategorías heredan el tipo de su raíz. (HU-15)
- Productos con `categoryId` obligatorio (cualquier nivel del árbol), `type` derivado de la categoría y atributos por tipo: `brand` en todos los tipos; `model` y `warrantyMonths` (0–120) solo en electrodomésticos; ropa y electrodomésticos solo admiten la unidad `UNIT`. (HU-15)
- Filtros de `GET /api/v1/products` por `categoryId` (incluye subcategorías) y `type`, combinables con `q` y `active`. (HU-15)
- Migración V4 de datos: el texto de categoría de HU-02 pasa a una categoría con alias reconocidos (p. ej. «limpieza» → Aseo y hogar, «calzado» → Ropa); el resto, a subcategorías de Alimentos. (HU-15)
- Códigos de error `category.not_found`, `category.name_conflict`, `category.max_depth`, `category.inactive`, `category.parent_inactive`, `category.has_active_children`, `category.type_required`, `category.type_inherited`, `product.category_not_found`, `product.attribute_not_allowed` y `product.unit_not_allowed`, traducidos es/en. (HU-15)
- Panel `cuartico-web`: página «Categorías» (solo `ADMIN`) con árbol, alta de raíz o subcategoría, renombrar (es/en), activar y desactivar con confirmación y «Deshacer»; aviso no bloqueante si un nombre solo difiere de una hermana en tildes. Formulario de producto con selector de categoría por rutas y campos según el tipo. Listado con columna y filtros de tipo y categoría. (HU-15)
- Guía de aprendizaje de React, temas 19 a 23. (HU-15)
- Análisis y diseño del sprint 2: ADR-003 (categorías, tipos y variantes), historias HU-15 y HU-16, y prototipos de categorías y de productos v2 (PR #11 y sprint 2).
- Matriz CA → tests de HU-15 y TT-14 en `docs/qa/stories/HU-15.md` (APTO), con `CategoryIntegrationTests`, `CategoryMigrationTests`, `ProductCategoryTypeTests` y los tests de QA y de componente del panel. (HU-15)
- Variantes de producto (talla × color): cada variante tiene su SKU, su umbral (`minStock`), su versión y su stock (`variant_stock`). Un producto simple tiene una variante oculta sin talla ni color. Endpoints bajo `/api/v1/products/{id}/variants`: alta de 1 a 100 variantes (todo o nada), edición, activar y desactivar (solo `ADMIN`) y conversión simple ↔ con variantes (`enable`/`disable`). Sin borrado de variantes (405). El alta de producto acepta `hasVariants` y `variants`. Agregado de stock por producto: suma de todas las variantes, costo promedio ponderado y alerta de stock bajo según las variantes activas. (HU-16)
- Búsqueda de `GET /api/v1/products` (`q`) por el SKU de cualquier variante, sin duplicar productos. (HU-16)
- Migración `V5__product_variants.sql`: tablas `product_variants` y `variant_stock` (sustituye a `product_stock`). Cada producto existente recibe una variante oculta con su SKU, umbral y stock, y `products` gana `has_variants`. (HU-16)
- Códigos de error `variant.not_found`, `variant.options_required`, `variant.options_conflict`, `variant.inactive` (reservado: todavía no se lanza), `product.no_variants`, `product.has_variants`, `product.has_multiple_variants` y `product.variant_fields_not_allowed`, traducidos es/en. (HU-16)
- Panel `cuartico-web`: en el alta de producto, casilla «Tiene tallas o colores» (Ropa la marca sola) y generador de combinaciones (tallas, colores, prefijo de SKU, omitir las que ya existen y aviso de colores que solo difieren en tildes). En la edición: tabla de variantes con edición en línea, activar y desactivar con «Deshacer», «Añadir variantes» y «Convertir en producto simple». Errores de variante en su fila. (HU-16)
- Matriz CA → tests de HU-16 en `docs/qa/stories/HU-16.md` (APTO), con `ProductVariantIntegrationTests`, `ProductVariantMigrationTests`, `ProductVariantConcurrencyTests`, `ProductVariantQaEdgeTests` y los tests de variantes del panel. (HU-16)
- Documentación de variantes: sección «Variantes (HU-16)» en la API, códigos de error, arquitectura del backend y panel, y guía de aprendizaje de React (temas 24 a 28). (HU-16)

### Changed
- Todos los endpoints bajo `/api/v1` (antes `/api/`). (PR #5)
- `/api/v1/auth/refresh` responde 200 cuando se reenvía un refresh token rotado dentro de la ventana de gracia de 120 s. Fuera de ella sigue respondiendo 401 `auth.refresh_invalid` y cierra las sesiones del usuario. (HU-01, PR #9)
- Errores de tipo en el cuerpo JSON (p. ej. `unit = "BOX"`, `minStock = "abc"`) y en parámetros de consulta (p. ej. `page=abc`) responden 400 `validation.failed` con `errors` por campo, en lugar de `request.malformed` sin `errors`. El JSON con sintaxis inválida sigue en `request.malformed`. (HU-02)
- **API de productos incompatible con HU-02** (HU-02 no está en producción, así que no afecta a ningún cliente publicado). `POST` y `PUT /api/v1/products`: el campo `category` (texto) se sustituye por `categoryId` (obligatorio). La respuesta sustituye `category` (texto) por un objeto `{id, name, nameEn, path, pathEn, active}` y añade `type`, `brand`, `model` y `warrantyMonths`. Un `type` enviado en el cuerpo se ignora. (HU-15)
- `GET /api/v1/products`: el filtro `category` (texto) se sustituye por `categoryId`, y `sort=category` responde 400 `request.invalid_sort`. (HU-15)
- `GET /api/v1/products/categories` retirado: responde 404 `request.not_found`. Sustituido por `GET /api/v1/categories`. (HU-15)
- Enteros estrictos en el JSON: un decimal en un campo entero (p. ej. `warrantyMonths: 1.5`) responde 400 `validation.failed` en lugar de truncarse. (HU-15)
- Panel: la pestaña «Cuenta» de la barra inferior se llama «Más» para `ADMIN` (para `OPERATOR` sigue siendo «Cuenta»). (HU-15)
- Panel: el filtro de categoría del listado de productos va por id en la URL (`?cat=<id>`); un enlace antiguo con texto se ignora y se muestran todas. (HU-15)
- **API de productos incompatible con HU-02 y HU-15** (HU-02 y HU-15 no están en producción; ningún cliente publicado las usa). `sku` y `minStock` viven en la variante:
  - Producto **con variantes** (`hasVariants = true`): `sku` y `minStock` del producto son `null` en la respuesta. En `POST` y `PUT` deben ir `null`; si no, 400 `product.variant_fields_not_allowed`. Los SKU y umbrales se envían dentro de `variants[]`.
  - Producto **simple**: `sku` y `minStock` siguen en el nivel de producto (se leen y escriben sobre su variante oculta, que la API no muestra). `minStock` sigue siendo obligatorio.
  - `ProductResponse` añade `hasVariants`, `variantCount` y, en el detalle y en las respuestas de variantes, `variants[]`. `stock` de un producto con variantes es el agregado. El listado no incluye `variants[]`.
  - `GET /api/v1/products`: `sort=sku` se retira y responde 400 `request.invalid_sort` (solo `name` y `createdAt`). (HU-16)
- Esquema interno (V5): `product_stock` desaparece y su caché de stock pasa a `variant_stock` (1:1 con la variante); `products.sku` y `products.min_stock` se eliminan. Quien consulte la base de datos directamente debe usar las tablas nuevas. (HU-16)
- Panel: el listado de productos ordena solo por nombre (`name,asc` / `name,desc`), a juego con la API. (HU-16)

### Fixed
- `PUT /api/v1/users/{id}` exige el campo `active`. Antes, omitirlo desactivaba al usuario y revocaba sus sesiones; ahora responde 400 `validation.failed`. (TT-11, PR #7)
- SKU de producto: se pasa a mayúsculas solo si el valor ya es válido. `ß`, `ı` y `ſ` responden 400 `validation.failed` (`errors.sku`) en lugar de guardarse como SKU válidos. (TT-14)
- Activar y desactivar un producto es idempotente también en carrera: quien pierde la carrera recibe 200 sin nueva versión. (TT-14)
- Listado de productos: una `page` absurda muestra la primera página en lugar de un error. (TT-14)
- Formulario de edición de producto: un fallo al recargar en segundo plano ya no desmonta el formulario. (TT-14)
- Formulario de producto: USD preseleccionado como moneda por defecto, y la lista de monedas del panel en `config/currencies.ts`, a juego con `app.currencies.supported`. (TT-14)

## [0.1.0]

Primera release a producción. Certificada en staging el SHA `7e18b69` (ver [registro de certificaciones](docs/qa/certifications.md)).
Fecha: 2026-10-29. Release PR #4 (`develop` → `main`), merge commit `ab4b546`, certificado sobre `7e18b69`.

### Added
- Backend Spring Boot 4.1 con perfiles `dev`, `test` y `prod`, Flyway, ProblemDetail (RFC 9457) y auditoría de entidades.
- Usuarios con roles `ADMIN` y `OPERATOR`; login con JWT HS256; refresh tokens opacos con rotación y detección de reutilización.
- Imagen Docker (`backend/Dockerfile`) ajustada al plan gratuito de Render y workflow de GitHub Actions (tests con H2 y con PostgreSQL, build de la imagen).
- Blueprints de Render para staging (`develop`) y producción (`main`), con base de datos en Neon.
- Equipo de agentes y reglas del proyecto en `CLAUDE.md`.
