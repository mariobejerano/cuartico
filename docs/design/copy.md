# Textos de interfaz (es / en) — Sprints 1 y 2

> Responsable: Lienzo · **Estado: §1–7 aprobadas por la supervisión (2026-11-07); §8–10 (Sprint 2) Aprobado (2026-11-09).**
> Complementa el [§9 del design system](design-system.md#9-textos-de-interfaz-comunes-es--en) (textos comunes).
> Las claves son orientativas para `react-i18next` (Forja-Front fija la estructura); **el texto sí es el propuesto**.
> Los prototipos usan exactamente estas claves: [`login.html`](prototypes/login.html) y [`products.html`](prototypes/products.html).

**Tono**: tuteo, frases cortas, verbo concreto en los botones («Guardar producto», no «Aceptar»), sin culpar al usuario
(«No pudimos conectar», no «Has perdido la conexión»). Variables con `{{nombre}}`. Comillas: «» en español, "" en inglés.

## 1. Comunes nuevos (añadir a §9)

| Clave | es | en |
|---|---|---|
| `common.language` | Idioma | Language |
| `common.previous` | Anterior | Previous |
| `common.next` | Siguiente | Next |
| `common.page_of` | Página {{page}} de {{pages}} | Page {{page}} of {{pages}} |
| `common.clear_filters` | Limpiar filtros | Clear filters |
| `validation.max_length` | Máximo {{max}} caracteres. | Maximum {{max}} characters. |

## 2. Red y servidor (los genera el frontend, no la API)

| Clave | es | en | Cuándo |
|---|---|---|---|
| `net.waking_title` | El servidor se está despertando | The server is waking up | Cualquier petición sin respuesta a los 5 s (HU-01 CA-8) |
| `net.waking_body` | Puede tardar hasta un minuto. No cierres esta pantalla. | It can take up to a minute. Please keep this screen open. | ídem |
| `net.unreachable_title` | No pudimos conectar con el servidor | We couldn't reach the server | Red, CORS, 90 s, 502/503/504 (HU-01 CA-9) |
| `net.unreachable_body` | Revisa tu conexión a internet e inténtalo de nuevo. | Check your internet connection and try again. | ídem |
| `net.unexpected_generic` | Algo salió mal en el servidor. Inténtalo de nuevo en unos minutos. | Something went wrong on the server. Please try again in a few minutes. | 5xx sin ProblemDetail legible (HU-01 CA-10) |

## 3. Login (HU-01)

| Clave | es | en |
|---|---|---|
| `login.page_title` | Cuartico · Iniciar sesión | Cuartico · Log in |
| `login.checking_session` | Comprobando tu sesión… | Checking your session… |
| `login.title` | Inicia sesión | Log in |
| `login.subtitle` | Panel de gestión del negocio | Business management panel |
| `login.username` | Usuario | Username |
| `login.password` | Contraseña | Password |
| `login.show_password` | Mostrar | Show |
| `login.hide_password` | Ocultar | Hide |
| `login.submit` | Entrar | Log in |
| `login.submitting` | Entrando… | Logging in… |
| `login.username_required` | Escribe tu usuario. | Enter your username. |
| `login.password_required` | Escribe tu contraseña. | Enter your password. |
| `login.forgot_help` | ¿Olvidaste tu contraseña? Pide a un administrador que te la restablezca. | Forgot your password? Ask an administrator to reset it. |
| `session.ended` | Tu sesión ha terminado, vuelve a iniciar sesión. | Your session has ended. Please log in again. |
| `session.password_changed` | Contraseña cambiada, inicia sesión de nuevo. | Password changed. Please log in again. |

El selector de idioma muestra **«Español» / «English»** escritos en su propio idioma (con `lang="es"`/`lang="en"`), nunca traducidos.

## 4. Layout y navegación (HU-01)

| Clave | es | en |
|---|---|---|
| `nav.main` | Navegación principal | Main navigation |
| `nav.home` | Inicio | Home |
| `nav.products` | Productos | Products |
| `nav.account` | Cuenta de {{name}} | {{name}}'s account |
| `nav.account_short` | Cuenta | Account |
| `nav.change_password` | Cambiar contraseña | Change password |
| `nav.logout` | Cerrar sesión | Log out |
| `role.ADMIN` | Administrador | Administrator |
| `role.OPERATOR` | Operador | Operator |

## 5. Productos (HU-02)

### Listado

| Clave | es | en |
|---|---|---|
| `products.page_title` | Cuartico · Productos | Cuartico · Products |
| `products.title` | Productos | Products |
| `products.new` | Nuevo producto | New product |
| `products.search_label` | Buscar por nombre o SKU | Search by name or SKU |
| `products.category` | Categoría | Category |
| `products.all_categories` | Todas | All |
| `products.status` | Estado | Status |
| `products.status_active` | Activos | Active |
| `products.status_inactive` | Inactivos | Inactive |
| `products.status_all` | Todos | All |
| `products.col_product` | Producto | Product |
| `products.col_price` | Precio de referencia | Reference price |
| `products.col_available` | Disponible | Available |
| `products.col_status` | Estado | Status |
| `products.col_actions` | Acciones | Actions |
| `products.sort_by_name` | Ordenar por nombre | Sort by name |
| `products.sku_inline` | SKU {{sku}} | SKU {{sku}} |
| `products.no_sku` | Sin SKU | No SKU |
| `products.no_category` | Sin categoría | No category |
| `products.badge_inactive` | Inactivo | Inactive |
| `products.badge_low_stock` | Stock bajo | Low stock |
| `products.badge_out_of_stock` | Sin stock | Out of stock |

> `badge_low_stock` y `badge_out_of_stock` se incluyen ya en los archivos de traducción, pero **no se muestran hasta HU-04** (ver [ux-notes/products.md §5](ux-notes/products.md#5-etiquetas-de-stock-ocultas-hasta-hu-04-decisión-2026-11-05)).

| Clave | es | en |
|---|---|---|
| `products.edit` | Editar | Edit |
| `products.deactivate` | Desactivar | Deactivate |
| `products.activate` | Activar | Activate |
| `products.results_one` | 1 producto | 1 product |
| `products.results_other` | {{count}} productos | {{count}} products |
| `products.empty_title` | Todavía no hay productos | No products yet |
| `products.empty_body` | Crea el primero para poder registrar compras y armar combos. | Create the first one so you can record purchases and build combos. |
| `products.no_results_query` | No hay productos que coincidan con «{{q}}» | No products match "{{q}}" |
| `products.no_results_filters` | No hay productos con estos filtros | No products match these filters |
| `products.no_results_body` | Prueba con otra palabra o revisa los filtros. La búsqueda distingue tildes: «azucar» no encuentra «Azúcar». | Try another word or check the filters. Search is accent-sensitive: "azucar" won't find "Azúcar". |
| `products.load_error_title` | No se pudieron cargar los productos | We couldn't load the products |
| `products.error_code` | Código para soporte: {{code}} | Support code: {{code}} |

### Formulario

| Clave | es | en |
|---|---|---|
| `products.edit_title` | Editar producto | Edit product |
| `products.back_to_list` | Volver a productos | Back to products |
| `products.section_data` | Datos del producto | Product details |
| `products.name` | Nombre | Name |
| `products.name_help` | Incluye la presentación si importa: «Aceite de girasol 1 L». | Include the size if it matters: "Sunflower oil 1 L". |
| `products.sku_help` | Código interno único. Letras, números, punto, guion y guion bajo. | Unique internal code. Letters, numbers, dot, hyphen and underscore. |
| `products.category_help` | Elige una existente o escribe una nueva. | Pick an existing one or type a new one. |
| `products.unit` | Unidad de medida | Unit of measure |
| `products.unit_placeholder` | Elige una unidad | Choose a unit |
| `products.unit_help` | Cómo se cuenta el stock de este producto. | How this product's stock is counted. |
| `products.min_stock` | Stock mínimo | Minimum stock |
| `products.min_stock_help` | Te avisaremos cuando el disponible llegue a esta cantidad. 0 = sin aviso. | We'll warn you when available stock reaches this amount. 0 = no warning. |
| `products.sale_price` | Precio de venta de referencia | Reference sale price |
| `products.amount` | Importe | Amount |
| `products.currency` | Moneda | Currency |
| `products.sale_price_help` | Orientativo. El precio real lo fija cada combo o pedido. | A guide only. The actual price is set by each combo or order. |
| `products.section_stock` | Stock y costo | Stock and cost |
| `products.on_hand` | Físico | On hand |
| `products.reserved` | Reservado | Reserved |
| `products.available` | Disponible | Available |
| `products.avg_cost` | Costo promedio | Average cost |
| `products.stock_readonly_note` | Se actualiza con las compras y ventas. | Updated by purchases and sales. |
| `products.stock_new_note` | El stock empieza en 0 y se actualiza con las compras y ventas. | Stock starts at 0 and is updated by purchases and sales. |
| `products.save` | Guardar producto | Save product |
| `products.audit` | Creado por {{createdBy}} el {{createdAt}} · Última modificación por {{updatedBy}} el {{updatedAt}} | Created by {{createdBy}} on {{createdAt}} · Last changed by {{updatedBy}} on {{updatedAt}} |
| `products.created` | Producto «{{name}}» creado. | Product "{{name}}" created. |
| `products.saved` | Cambios guardados. | Changes saved. |
| `products.discard_title` | ¿Descartar los cambios? | Discard changes? |
| `products.discard_body` | Lo que has escrito en este producto no se guardará. | What you typed for this product won't be saved. |
| `products.keep_editing` | Seguir editando | Keep editing |
| `products.discard` | Descartar | Discard |
| `products.not_found_title` | Este producto no existe | This product doesn't exist |
| `products.not_found_body` | Puede que el enlace esté mal escrito. | The link may be mistyped. |
| `products.version_conflict_title` | Otra persona cambió este producto mientras lo editabas | Someone else changed this product while you were editing |
| `products.version_conflict_body` | Tus cambios no se han guardado. Recarga para ver la versión actual y vuelve a aplicarlos. | Your changes weren't saved. Reload to see the current version and apply them again. |
| `products.reload` | Recargar producto | Reload product |
| `product.sku_pattern` | Usa solo letras sin tilde, números, punto (.), guion (-) o guion bajo (_). | Use only unaccented letters, numbers, dot (.), hyphen (-) or underscore (_). |
| `product.price_format` | Escribe un número igual o mayor que 0, con hasta 2 decimales. | Enter a number of 0 or more, with up to 2 decimals. |
| `product.min_stock_format` | Escribe un número igual o mayor que 0, con hasta 3 decimales. | Enter a number of 0 or more, with up to 3 decimals. |

### Estado (solo ADMIN)

| Clave | es | en |
|---|---|---|
| `products.section_status` | Estado del producto | Product status |
| `products.status_text_active` | Activo: se puede usar en compras, combos y pedidos. | Active: can be used in purchases, combos and orders. |
| `products.status_text_inactive` | Inactivo: no se puede usar en compras, combos ni pedidos nuevos. | Inactive: can't be used in new purchases, combos or orders. |
| `products.deactivate_product` | Desactivar producto | Deactivate product |
| `products.activate_product` | Activar producto | Activate product |
| `products.deactivate_title` | ¿Desactivar «{{name}}»? | Deactivate "{{name}}"? |
| `products.deactivate_body` | No se podrá usar en compras, combos ni pedidos nuevos. Lo ya registrado no cambia. Puedes volver a activarlo cuando quieras. | It can't be used in new purchases, combos or orders. Existing records don't change. You can activate it again at any time. |
| `products.deactivate_stock` | Todavía tiene stock: {{onHand}} físico y {{reserved}} reservado. | It still has stock: {{onHand}} on hand and {{reserved}} reserved. |
| `products.deactivating` | Desactivando… | Deactivating… |
| `products.deactivated` | «{{name}}» desactivado. | "{{name}}" deactivated. |
| `products.activated` | «{{name}}» activado. | "{{name}}" activated. |

### Unidades (`UnitOfMeasure`)

| Código | es (selector) | es (corta) | en (selector) | en (corta) |
|---|---|---|---|---|
| `UNIT` | Unidad (u) | u | Piece (pcs) | pcs |
| `KG` | Kilogramo (kg) | kg | Kilogram (kg) | kg |
| `LB` | Libra (lb) | lb | Pound (lb) | lb |
| `G` | Gramo (g) | g | Gram (g) | g |
| `L` | Litro (L) | L | Liter (L) | L |
| `ML` | Mililitro (mL) | mL | Milliliter (mL) | mL |

Claves: `unit.<CÓDIGO>` y `unit_short.<CÓDIGO>`. La corta va tras las cantidades con espacio duro: `36 u`, `12,5 kg`.

## 6. Añadidos en implementación (aprobados 2026-11-07)

> Textos que Forja-Front añadió en `cuartico-web/src/i18n/locales/{es,en}.json` (revisados por Lienzo el 2026-11-07).
> **Estado: aprobados por la supervisión (2026-11-07), con los cambios propuestos.** La columna «Implementado» refleja el valor actual de los
> archivos de traducción cuando difiere de la propuesta; **Forja-Front aplica el cambio** (Lienzo solo escribe en `docs/design/`).

| Clave | es (propuesto) | en (propuesto) | Implementado (si difiere) | Por qué del cambio |
|---|---|---|---|---|
| `language.es` | Español | Español | — | Nombre del idioma en su propio idioma (igual en ambos archivos), como en el login. |
| `language.en` | English | English | — | ídem. |
| `home.page_title` | Cuartico · Inicio | Cuartico · Home | — | — |
| `home.title` | Inicio | Home | — | — |
| `home.greeting` | Hola, {{name}} | Hi, {{name}} | — | — |
| `home.empty` | Aquí verás el resumen del negocio. Mientras tanto, empieza por el catálogo de productos. | The business summary will appear here. Meanwhile, start with the product catalog. | es: «Aquí verás el resumen del negocio. Próximamente.» · en: «The business summary will appear here. Coming soon.» | Un vacío debe decir qué hacer (§7.9); «Próximamente» no da salida. |
| `home.go_to_products` *(nueva)* | Ir a productos | Go to products | — (no existe) | Acción del estado vacío; botón secundario bajo el texto. Opcional si Forja-Front prefiere no añadir clave. |
| `products.page_title` | Cuartico · Productos | Cuartico · Products | — | — |
| `products.title` | Productos | Products | — | — |
| `products.coming_soon` | Esta sección llegará pronto. | This section is coming soon. | es: «Esta sección llega muy pronto.» | Sin intensificador ni promesa de plazo. Texto temporal: desaparece al implementar HU-02. |
| `not_found.page_title` | Cuartico · Página no encontrada | Cuartico · Page not found | — | — |
| `not_found.title` | Esta página no existe | This page doesn't exist | — | Coherente con `products.not_found_title`. |
| `not_found.body` | Puede que el enlace esté mal escrito. | The link may be mistyped. | — | — |
| `not_found.home_link` | Ir al inicio | Go to Home | en: «Go to home» | «Home» es el nombre de la sección (como en la navegación): con mayúscula. |

**Productos (HU-02), revisado el 2026-11-09; aprobado por la supervisión el 2026-11-09, incluido `common.not_set` («Sin definir» / "Not set"):**

| Clave | es (propuesto) | en (propuesto) | Implementado (si difiere) | Comentario |
|---|---|---|---|---|
| `products.results_one` / `products.results_other` | 1 producto / {{count}} productos | 1 product / {{count}} products | — | Sustituyen a `products.results` + `products.results_one` (plurales de i18next: `_one`/`_other`). Correcto y suficiente para es/en. §5 ya actualizado. |
| `products.no_price` | — | — | — | Bien como valor visible (no ensucia la columna). **Propuesta de accesibilidad:** un lector de pantalla lee «raya» o nada, así que conviene añadir texto oculto con una clave genérica nueva `common.not_set` = «Sin definir» / "Not set" (`<span aria-hidden="true">—</span><span class="sr-only">…</span>`). Es genérica porque el mismo formateador se usa también para el costo promedio vacío. Aprobada: la implementa Forja-Front. |
| `products.sku` | SKU | SKU | — | Etiqueta del campo; igual en ambos idiomas (sigla de uso común). Sin cambios. |

## 7. Mensajes de la API que propongo (para Forja-Back)

Viven en `messages_es/en.properties` (los decide Forja-Back); aquí la redacción sugerida, coherente con el tono:

| Código | es | en |
|---|---|---|
| `product.not_found` | No existe el producto {0}. | Product {0} doesn't exist. |
| `product.sku_conflict` | Ya existe un producto con el SKU {0}. | A product with SKU {0} already exists. |
| `product.price_currency_mismatch` | Si indicas un precio, indica también su moneda (y al revés). | If you enter a price, also choose its currency (and vice versa). |
| `product.currency_unsupported` | La moneda {0} no está admitida. | Currency {0} isn't supported. |
| `product.sku.pattern` | Usa solo letras sin tilde, números, punto (.), guion (-) o guion bajo (_). | Use only unaccented letters, numbers, dot (.), hyphen (-) or underscore (_). |
| `resource.version_conflict` | Otra persona cambió este registro mientras lo editabas. Recárgalo y vuelve a intentarlo. | Someone else changed this record while you were editing. Reload it and try again. |

El frontend **no** muestra el `detail` de `auth.invalid_credentials` desde su propio archivo: usa el que manda la API
(«Usuario o contraseña incorrectos»), que ya existe.

---

# Sprint 2 — Catálogo completo (HU-15, HU-16) · **Aprobado (2026-11-09)**

> Prototipos: [`categories.html`](prototypes/categories.html) y [`products-v2.html`](prototypes/products-v2.html), que usan exactamente estas claves.
> Notas: [`ux-notes/categories.md`](ux-notes/categories.md) y [`ux-notes/products-v2.md`](ux-notes/products-v2.md).
> Plurales con `_one` / `_other` (i18next). Las claves marcadas **(cambia)** ya existían: se mantiene la clave y cambia el texto.

## Nombres elegidos

**Tipo `OTHER`: «Aseo y hogar» / "Personal care & home"** (decisión de la supervisión, 2026-11-09; se descartaron «Otros», «General» y
«Varios»). Coincide con el nombre de la raíz creada por V4. Si en el futuro hay otra raíz `OTHER` que no sea de aseo (ferretería…),
habrá que revisar esta etiqueta.

**Casilla de variantes: «Tiene tallas o colores» / "Has sizes or colors"** (la de
CA-21); alternativa «Tiene variantes» / "Has variants" (más corta, pero «variante» es jerga). En el resto de la interfaz sí se usa
«variante» cuando ya hay contexto («8 variantes», «Añadir variantes»).

## 8. Categorías (HU-15)

### Navegación y acceso

| Clave | es | en |
|---|---|---|
| `nav.categories` | Categorías | Categories |
| `nav.more` | Más | More |
| `nav.manage` | Gestión | Management |
| `forbidden.title` | No tienes acceso a esta página | You don't have access to this page |
| `forbidden.body` | Solo un administrador puede gestionar las categorías. Si lo necesitas, pídeselo a uno. | Only an administrator can manage categories. If you need it, ask one. |
| `forbidden.go_products` | Ir a productos | Go to Products |
| `common.got_it` | Entendido | Got it |

### Tipos de producto (`ProductType`)

| Clave | es | en |
|---|---|---|
| `product_type.FOOD` | Alimentos | Food |
| `product_type.CLOTHING` | Ropa | Clothing |
| `product_type.APPLIANCE` | Electrodomésticos | Appliances |
| `product_type.OTHER` | Aseo y hogar | Personal care & home |

### Página y árbol

| Clave | es | en |
|---|---|---|
| `categories.page_title` | Cuartico · Categorías | Cuartico · Categories |
| `categories.title` | Categorías | Categories |
| `categories.intro` | Organiza el catálogo en categorías y subcategorías (hasta 3 niveles). El tipo de la categoría principal decide qué datos pide cada producto. | Organize the catalog into categories and subcategories (up to 3 levels). The main category's type decides which details each product needs. |
| `categories.new` | Nueva categoría | New category |
| `categories.show_inactive` | Mostrar inactivas ({{count}}) | Show inactive ({{count}}) |
| `categories.type_tag` | Tipo: {{type}} | Type: {{type}} |
| `categories.badge_inactive` | Inactiva | Inactive |
| `categories.other_lang_name` | EN: {{name}} | ES: {{name}} |
| `categories.missing_other_lang` | Sin nombre en inglés | No English name |
| `categories.add_sub` | Añadir subcategoría | Add subcategory |
| `categories.rename` | Renombrar | Rename |
| `categories.deactivate` | Desactivar | Deactivate |
| `categories.activate` | Activar | Activate |
| `categories.actions_for` | Acciones de «{{name}}» | Actions for "{{name}}" |
| `categories.max_level_note` | Último nivel: no admite subcategorías. | Last level: it can't have subcategories. |
| `categories.inactive_note` | Inactiva: actívala para añadirle subcategorías. | Inactive: activate it to add subcategories. |
| `categories.load_error_title` | No se pudieron cargar las categorías | We couldn't load the categories |

> `categories.other_lang_name` muestra el nombre **en el otro idioma**: en español «EN: Grains», en inglés «ES: Granos».

### Crear y renombrar

| Clave | es | en |
|---|---|---|
| `categories.form_new_title` | Nueva categoría | New category |
| `categories.form_rename_title` | Renombrar «{{name}}» | Rename "{{name}}" |
| `categories.parent` | Categoría superior | Parent category |
| `categories.parent_none` | Ninguna (categoría principal) | None (main category) |
| `categories.parent_help` | Solo aparecen las activas de los niveles 1 y 2: el máximo son 3 niveles. | Only active categories from levels 1 and 2 are listed: 3 levels is the maximum. |
| `categories.type` | Tipo de producto | Product type |
| `categories.type_placeholder` | Elige un tipo | Choose a type |
| `categories.type_help` | Decide qué datos pide cada producto. No se puede cambiar después. | Decides which details each product needs. It can't be changed later. |
| `categories.type_inherited` | Tipo: {{type}} (lo hereda de «{{root}}») | Type: {{type}} (inherited from "{{root}}") |
| `categories.name_es` | Nombre en español | Name in Spanish |
| `categories.name_en` | Nombre en inglés | Name in English |
| `categories.name_en_help` | Si lo dejas vacío, en inglés se muestra el nombre en español. | If left empty, the Spanish name is shown in English. |
| `categories.rename_note` | No se puede mover a otra categoría ni cambiar su tipo. | It can't be moved to another category or change its type. |
| `categories.create` | Crear categoría | Create category |
| `categories.save_name` | Guardar nombre | Save name |
| `categories.created` | Categoría «{{name}}» creada. | Category "{{name}}" created. |
| `categories.renamed` | Categoría renombrada. | Category renamed. |
| `categories.similar_warning` | Se parece a «{{name}}», que ya existe aquí. Si es la misma, no la crees otra vez. | Looks like "{{name}}", which already exists here. If it's the same one, don't create it again. |
| `categories.version_conflict_title` | Otra persona cambió esta categoría mientras la editabas | Someone else changed this category while you were editing |
| `categories.version_conflict_body` | Tu cambio no se ha guardado. Recarga para ver el nombre actual y vuelve a intentarlo. | Your change wasn't saved. Reload to see the current name and try again. |
| `categories.reload` | Recargar categoría | Reload category |

### Desactivar / activar

| Clave | es | en |
|---|---|---|
| `categories.deactivate_title` | ¿Desactivar «{{name}}»? | Deactivate "{{name}}"? |
| `categories.deactivate_body` | No se podrá elegir en productos nuevos ni al cambiar la categoría de uno. Los productos que ya la tienen la conservan. Puedes volver a activarla cuando quieras. | It can't be chosen for new products or when changing a product's category. Products that already have it keep it. You can activate it again at any time. |
| `categories.deactivate_products_one` | 1 producto conserva esta categoría. | 1 product keeps this category. |
| `categories.deactivate_products_other` | {{count}} productos conservan esta categoría. | {{count}} products keep this category. |

> `categories.deactivate_products_*` (aprobado por la supervisión, 2026-11-10): se muestra en el diálogo de desactivar, antes de `categories.deactivate_body`, solo si `productCount` > 0 (HU-15 CA-12).
| `categories.deactivating` | Desactivando… | Deactivating… |
| `categories.deactivated` | «{{name}}» desactivada. | "{{name}}" deactivated. |
| `categories.activated` | «{{name}}» activada. | "{{name}}" activated. |
| `categories.blocked_children_title` | Todavía no se puede desactivar «{{name}}» | "{{name}}" can't be deactivated yet |
| `categories.blocked_children_body` | Primero desactiva sus subcategorías activas: {{list}}. | First deactivate its active subcategories: {{list}}. |
| `categories.and_more` | {{list}} y {{count}} más | {{list}} and {{count}} more |
| `categories.blocked_parent_title` | Primero activa «{{parent}}» | First activate "{{parent}}" |
| `categories.blocked_parent_body` | Una subcategoría no puede estar activa si su categoría superior está desactivada. | A subcategory can't be active while its parent category is inactive. |

### Errores mostrados por el frontend (con datos que ya tiene)

| Clave | es | en | Cuándo |
|---|---|---|---|
| `api.category.name_conflict` | Ya existe «{{name}}» dentro de «{{parent}}». | "{{name}}" already exists in "{{parent}}". | Duplicado bajo un padre (cliente o 409) |
| `api.category.name_conflict_root` | Ya existe una categoría principal llamada «{{name}}». | There's already a main category called "{{name}}". | Duplicado entre raíces |
| `api.category.max_depth` | No se puede crear aquí: el máximo son 3 niveles. Elige otra categoría superior. | It can't be created here: 3 levels is the maximum. Choose another parent category. | 400 (carrera) |
| `api.category.parent_inactive` | La categoría superior está desactivada. Actívala primero o elige otra. | The parent category is inactive. Activate it first or choose another one. | 409 (carrera) |
| `api.category.has_active_children` | Tiene subcategorías activas. Desactívalas primero. | It has active subcategories. Deactivate them first. | 409 (carrera) |

## 9. Productos v2 (HU-15 + HU-16)

### Listado

| Clave | es | en |
|---|---|---|
| `products.type` | Tipo | Type |
| `products.all_types` | Todos | All |
| `products.col_category` | Categoría | Category |
| `products.category_inactive_suffix` | {{path}} (inactiva) | {{path}} (inactive) |
| `products.variant_count_one` | 1 variante | 1 variant |
| `products.variant_count_other` | {{count}} variantes | {{count}} variants |
| `products.no_category` | *(se elimina: la categoría es obligatoria)* | |

### Formulario: categoría y atributos

| Clave | es | en |
|---|---|---|
| `products.category_placeholder` | Elige una categoría | Choose a category |
| `products.category_help` **(cambia)** | El tipo sale de la categoría y decide qué datos se piden. | The type comes from the category and decides which details are needed. |
| `products.type_tag` | Tipo: {{type}} | Type: {{type}} |
| `products.type_change_attrs` | Este tipo no usa modelo ni garantía: no se guardarán. | This type doesn't use model or warranty: they won't be saved. |
| `products.type_change_unit` | La unidad pasa a «{{unit}}»: {{type}} se cuenta por unidades. | The unit changes to "{{unit}}": {{type}} is counted in pieces. |
| `products.brand` | Marca | Brand |
| `products.model` | Modelo | Model |
| `products.model_help` | Como aparece en la caja o la etiqueta: «RC-18». | As shown on the box or label: "RC-18". |
| `products.warranty` | Garantía | Warranty |
| `products.months` | meses | months |
| `products.warranty_help` | En meses, de 0 a 120. Es informativa: se muestra al vender. | In months, from 0 to 120. For information only: shown when selling. |
| `products.unit_locked_help` | Fija: {{type}} se cuenta por unidades. | Fixed: {{type}} is counted in pieces. |
| `products.sale_price_help` **(cambia)** | Orientativo y para todas sus tallas y colores. El precio real lo fija cada combo o pedido. | A guide only, the same for all sizes and colors. The actual price is set by each combo or order. |
| `product.warranty_format` | Escribe un número entero de 0 a 120. | Enter a whole number from 0 to 120. |
| `api.category.inactive` | Esta categoría se ha desactivado. Elige otra. | This category has been deactivated. Choose another one. |
| `api.product.sku_conflict` **(cambia)** | El SKU {{sku}} ya lo usa otro producto o variante. | SKU {{sku}} is already used by another product or variant. |

> `{{type}}` en `type_change_unit` y `unit_locked_help` es el nombre del tipo («Ropa», «Electrodomésticos»): «Ropa se cuenta por unidades».

### Inventario y variantes

| Clave | es | en |
|---|---|---|
| `products.section_inventory` | Inventario | Inventory |
| `products.has_variants` | Tiene tallas o colores | Has sizes or colors |
| `products.has_variants_help` | Márcalo si cada talla o color lleva su propio SKU y stock. En ropa viene marcado. | Tick it if each size or color has its own SKU and stock. Ticked by default for clothing. |
| `products.stock_new_note_variants` | El stock de cada variante empieza en 0 y se actualiza con las compras y ventas. | Each variant's stock starts at 0 and is updated by purchases and sales. |
| `variants.section` | Tallas y colores | Sizes and colors |
| `variants.title_count` | Tallas y colores ({{count}}) | Sizes and colors ({{count}}) |
| `variants.col_variant` | Variante | Variant |
| `variants.size` | Talla | Size |
| `variants.color` | Color | Color |
| `variants.count_one` / `_other` | 1 variante / {{count}} variantes | 1 variant / {{count}} variants |
| `variants.count_inactive` | {{count}} inactivas | {{count}} inactive |
| `variants.badge_inactive` | Inactiva | Inactive |
| `variants.remove` | Quitar {{name}} | Remove {{name}} |
| `variants.required` | Añade al menos una variante: elige tallas o colores y pulsa «Añadir variantes». | Add at least one variant: choose sizes or colors and press "Add variants". |
| `variants.max` | Máximo 100 variantes por producto. | A product can have up to 100 variants. |
| `variant.options_required` | Indica al menos una talla o un color. | Enter at least a size or a color. |
| `variant.sku_repeated` | Este SKU se repite en otra variante. | This SKU is repeated in another variant. |
| `api.variant.options_conflict` | Ya existe la variante {{options}} en este producto. | Variant {{options}} already exists in this product. |

### Generador

| Clave | es | en |
|---|---|---|
| `gen.title` | Generar combinaciones | Generate combinations |
| `gen.sizes` | Tallas | Sizes |
| `gen.colors` | Colores | Colors |
| `gen.add` | Añadir | Add |
| `gen.presets` | Habituales: | Common: |
| `gen.sizes_help` | Escribe una o varias separadas por comas y pulsa Intro. Ej.: M, 38, 10. | Type one or more, separated by commas, and press Enter. E.g.: M, 38, 10. |
| `gen.colors_help` | Ej.: Blanco, Azul marino. Puedes dejarlo vacío si solo cambia la talla. | E.g.: White, Navy blue. Leave it empty if only the size changes. |
| `gen.chosen_sizes` / `gen.chosen_colors` | Tallas elegidas / Colores elegidos | Chosen sizes / Chosen colors |
| `gen.remove_size` / `gen.remove_color` | Quitar la talla {{v}} / Quitar el color {{v}} | Remove size {{v}} / Remove color {{v}} |
| `gen.prefix` | Prefijo de SKU | SKU prefix |
| `gen.prefix_help` | Propone cada SKU como PREFIJO-TALLA-COLOR (p. ej. CAM-M-BLA). Puedes cambiarlos después. | Suggests each SKU as PREFIX-SIZE-COLOR (e.g. TSH-M-WHI). You can change them afterwards. |
| `gen.min` | Stock mínimo de cada una | Minimum stock for each |
| `gen.preview_none` | Elige al menos una talla o un color. | Choose at least one size or color. |
| `gen.preview_one` / `gen.preview` | 1 combinación nueva. / {{count}} combinaciones nuevas. | 1 new combination. / {{count}} new combinations. |
| `gen.preview_skipped` | {{n}} ya existen y se omiten. | {{n}} already exist and are skipped. |
| `gen.apply_zero` / `_one` / `_other` | Añadir variantes / Añadir 1 variante / Añadir {{count}} variantes | Add variants / Add 1 variant / Add {{count}} variants |

### Edición de variantes

| Clave | es | en |
|---|---|---|
| `variants.add` | Añadir variantes | Add variants |
| `variants.immediate_note` | Los cambios de cada variante se guardan con su propio botón, sin tocar «Guardar producto». | Each variant is saved with its own button, without "Save product". |
| `variants.total_title` | Total de todas las variantes | Total of all variants |
| `variants.total_note` | Suma de todas las variantes, también las inactivas. Se actualiza con las compras y ventas. | Sum of all variants, inactive ones included. Updated by purchases and sales. |
| `common.edit` | Editar | Edit |
| `variants.save_row` | Guardar variante | Save variant |
| `variants.saved` | Variante «{{name}}» guardada. | Variant "{{name}}" saved. |
| `variants.staged_one` / `_other` | 1 variante por guardar / {{count}} variantes por guardar | 1 variant to save / {{count}} variants to save |
| `variants.save_new_zero` / `_one` / `_other` | Guardar variantes nuevas / Guardar 1 variante nueva / Guardar {{count}} variantes nuevas | Save new variants / Save 1 new variant / Save {{count}} new variants |
| `variants.added_one` / `_other` | 1 variante añadida. / {{count}} variantes añadidas. | 1 variant added. / {{count}} variants added. |
| `variants.deactivated` | Variante «{{name}}» desactivada. | Variant "{{name}}" deactivated. |
| `variants.activated` | Variante «{{name}}» activada. | Variant "{{name}}" activated. |
| `variants.version_conflict` | Otra persona cambió esta variante. Tu cambio no se ha guardado. | Someone else changed this variant. Your change wasn't saved. |
| `variants.reload_row` | Recargar variante | Reload variant |

### Conversión simple ↔ con variantes

| Clave | es | en |
|---|---|---|
| `variants.simple_text` | Este producto no tiene tallas ni colores: todo su stock se cuenta junto. | This product has no sizes or colors: all its stock is counted together. |
| `variants.to_variants` | Convertir en producto con variantes | Convert to product with variants |
| `variants.convert` | Convertir | Convert |
| `variants.enable_body` | Las unidades que ya tienes ({{onHand}}) pasan a ser la primera variante, con su SKU y su stock mínimo. ¿Qué talla o color tienen? Después podrás añadir las demás. | The units you already have ({{onHand}}) become the first variant, keeping their SKU and minimum stock. What size or color are they? You can add the others afterwards. |
| `variants.enabled` | «{{name}}» ya tiene tallas o colores. Añade las demás variantes. | "{{name}}" now has sizes or colors. Add the other variants. |
| `variants.save_first_title` | Guarda antes los cambios del producto | Save the product changes first |
| `variants.save_first_body` | La conversión se guarda al momento. Para no perder lo que has escrito, guarda o descarta los cambios del producto y vuelve a intentarlo. | Converting is saved right away. To keep what you typed, save or discard the product changes and try again. |
| `variants.to_simple` | Convertir en producto simple | Convert to simple product |
| `variants.to_simple_hint` | Tiene una sola variante: puedes volver a gestionarlo como producto simple. | It has a single variant: you can manage it as a simple product again. |
| `variants.to_simple_title` | ¿Convertir en producto simple? | Convert to a simple product? |
| `variants.to_simple_body` | «{{name}}» deja de tener talla y color. Su SKU, su stock mínimo y su stock pasan a ser los del producto. | "{{name}}" will no longer have a size or color. Its SKU, minimum stock and stock become the product's. |
| `variants.to_simple_body_inactive` | «{{name}}» deja de tener talla y color y se vuelve a activar. Su SKU, su stock mínimo y su stock pasan a ser los del producto. | "{{name}}" will no longer have a size or color and will be activated again. Its SKU, minimum stock and stock become the product's. |
| `variants.disabled_done` | «{{name}}» es ahora un producto simple. | "{{name}}" is now a simple product. |

## 10. Mensajes de la API que propongo (Sprint 2, para Forja-Back)

Redacción sugerida para `messages_es/en.properties` (los códigos son los de HU-15 y HU-16):

| Código | es | en |
|---|---|---|
| `category.not_found` | No existe la categoría {0}. | Category {0} doesn't exist. |
| `category.name_conflict` | Ya existe una categoría llamada «{0}» en ese nivel. | A category called "{0}" already exists at that level. |
| `category.max_depth` | No se puede crear: el máximo son 3 niveles de categorías. | It can't be created: categories can have up to 3 levels. |
| `category.inactive` | La categoría elegida está desactivada. Elige otra. | The chosen category is inactive. Choose another one. |
| `category.parent_inactive` | La categoría superior está desactivada. | The parent category is inactive. |
| `category.has_active_children` | La categoría tiene subcategorías activas. Desactívalas primero. | The category has active subcategories. Deactivate them first. |
| `category.type_required` | Indica el tipo de producto de la categoría principal. | Choose the product type of the main category. |
| `category.type_inherited` | Una subcategoría hereda el tipo de su categoría principal: no lo envíes. | A subcategory inherits its main category's type: don't send it. |
| `product.category_not_found` | No existe la categoría {0}. | Category {0} doesn't exist. |
| `product.attribute_not_allowed` | El campo {0} no se admite en productos de este tipo. | Field {0} isn't allowed for this product type. |
| `product.unit_not_allowed` | Los productos de este tipo solo se cuentan por unidades. | Products of this type can only be counted in pieces. |
| `product.sku_conflict` **(cambia)** | El SKU {0} ya lo usa otro producto o variante. | SKU {0} is already used by another product or variant. |
| `product.variant_fields_not_allowed` | Un producto con variantes no lleva SKU ni stock mínimo propios: van en cada variante. | A product with variants has no SKU or minimum stock of its own: they go in each variant. |
| `product.no_variants` | Este producto no tiene variantes. | This product has no variants. |
| `product.has_variants` | Este producto ya tiene variantes. | This product already has variants. |
| `product.has_multiple_variants` | Solo se puede convertir en simple si tiene una sola variante. | It can only become a simple product if it has a single variant. |
| `variant.not_found` | No existe la variante {0} en este producto. | Variant {0} doesn't exist in this product. |
| `variant.options_required` | Cada variante necesita una talla, un color o ambos. | Each variant needs a size, a color or both. |
| `variant.options_conflict` | Ya existe la variante {0} en este producto. | Variant {0} already exists in this product. |
| `variant.inactive` | La variante {0} está desactivada. | Variant {0} is inactive. |

`{0}` de `product.attribute_not_allowed` es el nombre del campo de la API (`model`, `warrantyMonths`): el frontend no lo muestra (la UI ya
vacía esos campos); si llegara, se ve la alerta genérica con este `detail`.
