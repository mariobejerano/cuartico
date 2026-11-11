# Notas de UX · Productos v2: categoría, atributos por tipo y variantes (HU-15 + HU-16)

> Prototipo: [`prototypes/products-v2.html`](../prototypes/products-v2.html) · Textos: [`copy.md` §9](../copy.md#9-productos-v2-hu-15--hu-16)
> **Estado: Aprobado (2026-11-09)**: tipo `OTHER` visible como «Aseo y hogar»; aprobados el prefijo de SKU editable y desactivar variante sin diálogo con «Deshacer».
> Parte de [`products.html`](../prototypes/products.html) y de [`ux-notes/products.md`](products.md) (**aprobados 2026-11-05**) y de lo
> implementado en `cuartico-web/src/features/products/`. Todo lo que no aparece aquí **no cambia** (búsqueda con espera, URL, paginación,
> estados de carga/error, desactivar producto, descartar cambios, auditoría, etiquetas de stock ocultas hasta HU-04).
> Historias: [HU-15](../../analysis/stories/HU-15-categories-and-type-attributes.md) CA-13 a CA-19, CA-26 a CA-28 ·
> [HU-16](../../analysis/stories/HU-16-product-variants.md) CA-1 a CA-17, CA-21 a CA-24.
> Para ver variantes en el prototipo: «Camiseta básica de algodón» (8 variantes, una inactiva), «Chancletas de playa» (número × color),
> «Uniforme escolar» (una sola variante: se puede volver a simple). Para atributos: cualquier electrodoméstico («Olla arrocera 1,8 L»).

## 1. Qué cambia respecto a lo aprobado

| Antes (HU-02) | Ahora | Por qué |
|---|---|---|
| Categoría: texto libre con `<datalist>`, opcional | **Select nativo obligatorio** con la ruta completa de las activas (`Alimentos › Granos › Arroz`) | Ya no se inventan categorías al escribir (CA-13, CA-26); el select nativo abre el selector del sistema en móvil y no pesa nada. |
| SKU y Stock mínimo en «Datos del producto» | Nueva tarjeta **«Inventario»**: casilla «Tiene tallas o colores» + SKU/Stock mínimo (simple) o generador de variantes | SKU y umbral son de la variante (HU-16): ponerlos junto a la casilla que los sustituye hace evidente qué cambia al marcarla. |
| — | **Marca** (todos), **Modelo** y **Garantía (meses)** (solo electrodomésticos), **unidad fija** en ropa y electrodomésticos | CA-16, CA-17, CA-26. |
| Filtros: Categoría (texto) + Estado | **Tipo** + **Categoría** (por id, incluye subcategorías) + Estado | CA-19, CA-27. |
| Línea secundaria «SKU · categoría» | «SKU X» o **«8 variantes»** + ruta de la categoría; **columna «Categoría»** en escritorio ≥ 1024 | CA-23, CA-27 (ver §2). |
| Barra inferior «Inicio · Productos · Cuenta» | Para ADMIN, **«Más»** (lleva «Categorías») | Ver [categories.md §1](categories.md#1-dónde-vive-la-página-navegación). |

## 2. Listado

| Decisión | Por qué |
|---|---|
| Filtros en móvil: buscador (ancho completo) · Tipo + Estado (dos columnas) · Categoría (ancho completo); en ≥ 1024, los 4 en una fila | Las rutas de categoría son largas: a media anchura se cortarían. |
| Filtro **Tipo** con «Todos» + los 4 tipos | CA-27. Hoy cada tipo coincide con una raíz, pero si mañana se crea otra raíz de alimentos el filtro sigue teniendo sentido. |
| Filtro **Categoría**: «Todas» + **todas** las categorías por ruta, las inactivas marcadas «(inactiva)»; si hay Tipo elegido, solo las de ese tipo | Filtrar por una inactiva sirve para encontrar lo que hay que reclasificar; limitar por tipo evita combinaciones siempre vacías. Si se cambia el tipo y la categoría elegida no es de él, la categoría se quita. |
| URL `?type=&cat=<id>`; un enlace antiguo con texto (`?cat=Granos`) se ignora | CA-27. |
| Columna **«Categoría»** solo en ≥ 1024; entre 768 y 1023 la ruta va en la línea secundaria («SKU ARR-001 · Alimentos › Granos › Arroz») | Con 6 columnas, en tablet no cabe sin scroll lateral; así nadie pierde el dato. |
| Producto con variantes: «8 variantes» donde iba el SKU; «Disponible» = suma de todas (CA-15, CA-23) | Se ve que hay detalle por talla sin cargar las variantes en el listado. |
| Búsqueda «por nombre o SKU» encuentra también el SKU de cualquier variante (CA-16) | Sin cambio de etiqueta: para el usuario es lo mismo. |

## 3. Formulario: categoría, tipo y atributos

**Orden de campos**: Nombre · Categoría (ancho completo) + «Tipo: Ropa» · Marca | Unidad · [Modelo | Garantía] · Precio · **Inventario**.

| Decisión | Por qué |
|---|---|
| Categoría a ancho completo, opciones con la **ruta completa** (no sangría con espacios) | La sangría con espacios no se ve igual en todos los selectores nativos y el lector de pantalla no la lee; la ruta sí. |
| Si el producto está en una categoría **inactiva**, aparece también, como «… (inactiva)», y se puede guardar sin cambiarla (CA-13) | Editar el precio de un producto viejo no debe obligar a reclasificarlo. |
| Debajo, etiqueta gris **«Tipo: Electrodomésticos»** + ayuda «El tipo sale de la categoría y decide qué datos se piden.» | El tipo es derivado (CA-15): se enseña, no se elige. |
| **Modelo** y **Garantía** aparecen solo con tipo Electrodomésticos; garantía con sufijo «meses», entero 0–120, «Es informativa: se muestra al vender» | CA-16; P-7 (informativa). |
| **Unidad** fija en «Unidad (u)» y **deshabilitada** en ropa y electrodomésticos, con la ayuda «Fija: Ropa se cuenta por unidades.» | CA-17, CA-26. La ayuda explica por qué no se puede cambiar. |
| Al cambiar a una categoría de **otro tipo**, aviso ámbar bajo la categoría (región `role="status"`) con lo que cambia: «Este tipo no usa modelo ni garantía: no se guardarán.» / «La unidad pasa a «Unidad (u)»: Ropa se cuenta por unidades.» | El servidor nunca anula datos (CA-18); el frontend los vacía al enviar (CA-26) y **avisa** para que no se pierdan en silencio. Los valores quedan en pantalla ocultos: si se vuelve al tipo anterior, reaparecen. |
| Precio: ayuda «Orientativo y para todas sus tallas y colores…» | P-5: sin precio por variante; mejor decirlo donde se escribe el precio. |

## 4. Inventario: simple o con variantes

### Alta
- Casilla **«Tiene tallas o colores»** (checkbox nativo, no interruptor: el cambio se aplica al **Guardar**, no al tocarlo).
  Desmarcada por defecto; **se marca sola al elegir una categoría de Ropa** si el usuario no la ha tocado (CA-21). Si la toca, se respeta.
- Desmarcada: SKU + Stock mínimo, como en HU-02 (el producto tendrá su variante invisible, CA-1).
- Marcada: desaparecen SKU y Stock mínimo y aparece el **generador** + la lista de variantes en borrador. Las filas ya generadas no se
  pierden si se desmarca y se vuelve a marcar (solo se envían si está marcada).

### Generador talla × color (CA-21; se reutiliza en «Añadir variantes»)
| Elemento | Comportamiento | Por qué |
|---|---|---|
| **Tallas**: campo + [Añadir] | Intro o coma añade (varias a la vez: «S, M, L»); se pasan a mayúsculas; sin repetidas (sin distinguir mayúsculas) | Rápido con teclado de móvil; lo que se ve es lo que guarda la API (CA-6). Intro nunca envía el formulario. |
| **Habituales**: XS · S · M · L · XL · XXL | Botones que se activan/desactivan (`aria-pressed`, con «✓» además del color) | Un toque por talla en el caso más común (camisetas). Para calzado y pantalones (38, 40…) se escriben. |
| **Colores**: campo + [Añadir] | Igual; se respeta cómo se escribe («Azul marino»); «Rojo» y «rojo» son el mismo | CA-7. Se puede dejar vacío si solo cambia la talla (o al revés). |
| Etiquetas elegidas | Píldoras con «×» de 44 px en móvil (`aria-label` «Quitar la talla M»); al quitar, el foco pasa a la siguiente | Objetivo táctil y foco que no se pierde. |
| **Prefijo de SKU** (opcional) | Propone cada SKU como `PREFIJO-TALLA-COLOR` (`CAM-M-BLA`, `CAM-XL-AZM` para «Azul marino»); sin tildes; si choca, añade `-2` | Escribir 12 SKU a mano en el móvil es lo más lento del alta. Añadido por diseño (no estaba en CA-21), **aprobado 2026-11-09**: solo frontend, editable fila a fila. |
| **Stock mínimo de cada una** | Valor inicial para todas las filas (por defecto 0) | Normalmente es el mismo; luego se ajusta por fila. |
| Resumen vivo | «6 combinaciones nuevas. 2 ya existen y se omiten.» (`role="status"`) | Se sabe qué va a pasar antes de pulsar. |
| [Añadir 6 variantes] | Añade **solo las que faltan** a la lista (nunca borra ni duplica), ordenadas como la API (CA-14), y lleva el foco a la primera nueva | Pulsar dos veces no duplica; se pueden ir añadiendo tallas en varios pasos. |

### Lista de variantes en borrador
- **Una sola marcación** (`<ul>` de filas): en móvil, tarjetas («M · Blanco» + quitar, y debajo SKU | Stock mínimo); en ≥ 768, filas
  alineadas bajo una cabecera (Variante · SKU · Stock mínimo · quitar). Sin scroll lateral a 360 px (CA-24) y sin duplicar inputs.
- Cada campo se etiqueta con la fila («M · Blanco SKU») vía `aria-labelledby`.
- Errores **por fila** junto al campo (CA-21): patrón del SKU, SKU repetido en otra fila (lo comprueba el cliente), `product.sku_conflict`
  del servidor en la fila cuyo SKU choca. Al enviar, foco al primer campo con error.
- Sin filas al guardar: «Añade al menos una variante: elige tallas o colores y pulsa «Añadir variantes».» y foco en Tallas. Máximo 100.
- Contador «8 variantes»; nota final «El stock de cada variante empieza en 0…».

### Edición de un producto simple
Tarjeta «Inventario» con SKU y Stock mínimo (se guardan con «Guardar producto», CA-2) + tarjeta **«Tallas y colores»** fuera del formulario:
«Este producto no tiene tallas ni colores: todo su stock se cuenta junto.» + [Convertir en producto con variantes] (CA-12).
- Abre un diálogo: «Las unidades que ya tienes (12 u) pasan a ser la primera variante, con su SKU y su stock mínimo. ¿Qué talla o color
  tienen?» + Talla | Color (al menos uno) + [Convertir].
- Al terminar: toast y se abre directamente **«Añadir variantes»** con el foco en Tallas (el siguiente paso natural).
- Si hay cambios sin guardar en el formulario: aviso «Guarda antes los cambios del producto» (la conversión se guarda al momento y
  recargaría el producto). Ver §6 nota 2.

### Edición de un producto con variantes (CA-22)
La tarjeta «Inventario» desaparece del formulario. Debajo de [Guardar producto], tarjeta **«Tallas y colores (8)»**:
1. Nota: «Los cambios de cada variante se guardan con su propio botón, sin tocar «Guardar producto».» — **todo lo de esta tarjeta se guarda
   al momento**, como la tarjeta de Estado aprobada (por eso va fuera del formulario).
2. **Total de todas las variantes**: Físico · Reservado · Disponible · Costo promedio + «Suma de todas las variantes, también las inactivas.» (CA-15).
3. Lista: Variante (con etiqueta «Inactiva») · SKU · Stock mínimo · Disponible (solo lectura) · [Editar] [Desactivar] (este último solo ADMIN, CA-20).
   Orden de la API (CA-14). Contador «8 variantes · 1 inactivas».
4. **Editar** convierte esa fila en un mini-formulario (Talla, Color, SKU, Stock mínimo + [Cancelar] [Guardar variante]); una fila a la vez;
   Esc cancela, Intro guarda. Errores en la fila: opciones vacías, `variant.options_conflict` («Ya existe la variante «S / Blanco»…»,
   asociado a Talla y Color), `product.sku_conflict` en SKU, conflicto de versión con [Recargar variante] (CA-22).
5. **Desactivar/Activar variante**: sin diálogo, toast «Variante «XL · Azul marino» desactivada.» con [Deshacer]. Es reversible y de
   alcance pequeño (una talla); el producto sí pide confirmación porque afecta a todo. La fila queda atenuada con «Inactiva».
6. **[Añadir variantes]** abre un panel con el mismo generador; omite las combinaciones existentes (activas o no, CA-8); las nuevas quedan
   «por guardar» con SKU y mínimo editables y se guardan juntas con [Guardar 3 variantes nuevas] (todo o nada).
7. **[Convertir en producto simple]** al pie, solo si hay **una** variante (CA-13). Diálogo: «¿Convertir en producto simple?» · ««8» deja de tener
   talla y color. Su SKU, su stock mínimo y su stock pasan a ser los del producto.» (si está inactiva: «…y se vuelve a activar»).

### Móvil (360 px)
Variantes como tarjetas (título + etiqueta, `dl` de 3 columnas SKU/Mínimo/Disponible, botones a ancho completo); edición en la propia tarjeta
con los campos en 2 columnas. Sin scroll lateral (CA-24).

## 5. Errores nuevos en el formulario

| Código | Dónde |
|---|---|
| `validation.failed` con `errors.categoryId` | Campo Categoría |
| `product.category_not_found` / `category.inactive` (400) | Campo Categoría: «Esta categoría se ha desactivado. Elige otra.»; el selector se pone al día |
| `product.attribute_not_allowed`, `product.unit_not_allowed`, `product.variant_fields_not_allowed` | No deberían ocurrir (la UI no lo permite): alerta genérica arriba con el `detail` |
| `product.sku_conflict` | SKU (simple) o fila de la variante |
| `variant.options_conflict`, `variant.options_required` | Fila de la variante (Talla y Color) |
| `errors["variants[2].sku"]` | Campo de esa fila |
| `product.no_variants`, `product.has_variants`, `product.has_multiple_variants` (409) | Solo por carrera: toast de error + recarga del producto |
| `resource.version_conflict` | Producto: alerta arriba (como HU-02); variante: alerta en su fila |

## 6. Notas para Faro

1. **HU-16 CA-10 contradice CA-15.** CA-10: al desactivar la última variante activa «el listado lo muestra con 0 disponibles»; CA-15: el
   agregado suma **todas** las variantes, también las inactivas. El prototipo sigue CA-15 (el listado muestra las unidades aunque no sean
   vendibles). Hay que corregir CA-10, o decidir que «Disponible» del listado sume solo las activas (y el detalle muestre ambas).
2. **¿Las operaciones de variantes suben la `version` del producto?** Si añadir, editar o desactivar una variante incrementa
   `products.version` (p. ej. por `PESSIMISTIC_FORCE_INCREMENT` o por tocar `updatedAt`), el siguiente «Guardar producto» daría un falso
   `resource.version_conflict`. Propuesta: las operaciones de **fila** bloquean el producto con `PESSIMISTIC_WRITE` **sin** cambiar su
   versión; solo `enable`/`disable` (cambian `hasVariants`) la suben. Con eso, en la UI se puede editar variantes con el formulario a medias.
   Para `enable`/`disable` la UI pide guardar antes (§4).
3. **Recargar una fila** tras un conflicto de versión (CA-22): no hay `GET` de una variante; se hace `GET /products/{id}` y se toma esa
   variante. Basta, pero conviene decirlo en la historia.
4. **Prefijo de SKU** en el generador: añadido por diseño (solo frontend). Si se aprueba, añadirlo a CA-21.
5. **CA-27** dice «Columna «Categoría»»: el prototipo la muestra como columna en ≥ 1024 y en la línea secundaria por debajo (§2). Ajustar
   la redacción si se aprueba.
6. **Filtro de categoría con inactivas** (marcadas): CA-27 no lo dice; propuesta en §2.
7. **Variantes fuera de la ropa** (p. ej. un ventilador en blanco y negro): la casilla está disponible en cualquier tipo, como dice HU-16
   («se admiten en cualquier tipo»); solo en Ropa viene marcada. Confirmar que es lo deseado.
