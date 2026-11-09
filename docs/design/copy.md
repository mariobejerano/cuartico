# Textos de interfaz (es / en) — Sprint 1

> Responsable: Lienzo · **Estado: aprobado por la supervisión (2026-11-07).**
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
