# Notas de UX · Layout del panel (HU-01) y Productos (HU-02)

> Prototipo: [`prototypes/products.html`](../prototypes/products.html) · Textos: [`copy.md` §4–5](../copy.md#5-productos-hu-02)
> **Estado: Aprobado (2026-11-05)**, con dos ajustes de la supervisión ya aplicados: moneda por defecto USD y etiquetas de stock ocultas hasta HU-04.
> En el prototipo, el botón **⚙ Prototipo** (borde discontinuo magenta, no es diseño) cambia rol, respuestas de la API, conexión, tema y la previsualización de las etiquetas de stock.
> Referencias: §1 → HU-01 (layout, CA-24/CA-25); §2–5 → HU-02 salvo que se indique otra historia.

## 1. Layout del panel (HU-01 CA-24)

| Ancho | Navegación | Cuenta (usuario, rol, idioma, cerrar sesión) |
|---|---|---|
| Móvil < 768 | Barra superior (título de la página + avatar) y **barra inferior: Inicio · Productos · Cuenta** | Hoja inferior al tocar «Cuenta» o el avatar |
| Tablet 768–1023 | Barra lateral de iconos (64 px) con nombre accesible | Avatar al pie → misma hoja |
| Escritorio ≥ 1024 | Barra lateral de 240 px | Al pie de la barra: nombre, rol, selector de idioma y «Cerrar sesión» |

| Decisión | Por qué |
|---|---|
| Barra inferior con 3 destinos en Sprint 1 (no 5) | Solo existen Inicio y Productos: no ponemos enlaces muertos. Cuando lleguen más módulos, «Cuenta» pasa a «Más» (opción C del design system). |
| En móvil el `h1` va en la barra superior (en el contenido queda solo para lectores de pantalla) | Ahorra ~48 px de alto en pantallas pequeñas sin perder la estructura de encabezados. |
| Rol como etiqueta gris («Administrador»), no como badge de color | Es información, no un estado que pida atención. |
| «Usuarios» no aparece | La gestión de usuarios es HU-14; su entrada solo ADMIN irá dentro de «Cuenta»/«Más» (HU-14 CA-1). |

## 2. Listado de productos

**Flujo**: entrar → listado de activos ordenado por nombre → buscar/filtrar → «Editar» o «Nuevo producto».

| Decisión | Por qué |
|---|---|
| Buscador con etiqueta visible «Buscar por nombre o SKU» | Dice qué campos busca y no depende del placeholder (desaparece al escribir). |
| Filtro **Estado: Activos / Inactivos / Todos** (select nativo), por defecto Activos (CA-19) | Permite ver *solo* los inactivos para reactivar uno; aprovecha `active=true|false|ausente` de la API. |
| Categoría como select nativo con las categorías de `/products/categories` | Abre el selector del sistema en móvil; 0 KB. |
| En móvil, buscador a ancho completo y los dos selects en dos columnas | Los filtros ocupan 2 filas en vez de 3: más productos a la vista. |
| Tabla en ≥ 768 con 5 columnas: Producto (nombre + «SKU · categoría» debajo), Precio de referencia, Disponible, Estado, acciones | Cabe en tablet sin scroll lateral; unidad va junto a la cantidad («36 u»), así no necesita columna propia. |
| En < 768, **lista `<ul>` de tarjetas `<article>`** con `h2` y `<dl>` (no la tabla con `display:block`) | Semántica real de lista y pares término/valor; evita el fallo de Safari/VoiceOver al cambiar el `display` de una tabla (§7.4). En React: renderizar **una** de las dos vistas según `matchMedia` (hook `useMediaQuery`). |
| Badge de estado solo cuando hay algo que decir: Inactivo (gris); desde HU-04 también Sin stock (rojo) y Stock bajo (ámbar) | El color se reserva para lo que pide atención; una columna llena de «Activo» sería ruido. Las de stock se ocultan hasta HU-04 (ver §5). |
| Precio con su moneda siempre (`3,50 USD`, `3.200,00 CUP`) y «—» si no hay | Nunca un importe sin moneda en un negocio multimoneda. |
| «Editar» explícito en cada fila/tarjeta (no la fila entera clicable) | Verbo claro para usuarios no técnicos y compatible con el botón Desactivar en la misma fila. Texto oculto con el nombre del producto para lectores («Editar Arroz blanco»). |
| **Desactivar/Activar** en la fila **solo para ADMIN** (CA-24; utilidad común de roles de HU-01 CA-25) | Un toque menos que entrar al formulario; el OPERATOR ni lo ve. |
| Orden: solo por nombre (asc/desc) en la cabecera (CA-21) | Lo único que se usa a diario; SKU/categoría siguen disponibles en la API si hacen falta. |
| «Mostrando 1–20 de 26» arriba y paginación «Anterior · Página 1 de 2 · Siguiente» abajo | Arriba sabes cuántos hay sin bajar; los botones grandes funcionan con el pulgar (sin números de página diminutos). |
| «Nuevo producto»: botón primario en la cabecera (≥ 768) y **botón flotante con texto** sobre la barra inferior (móvil) | Acción principal siempre a mano mientras se hace scroll; con texto, no solo «+». |

**Estado en la URL (CA-26)**: `?q=&cat=&status=&page=&sort=`; solo se escriben los valores que no son por defecto.
`page` en la URL empieza en **1** (legible para personas); el cliente resta 1 al llamar a la API (que empieza en 0).
Búsqueda con espera de 300 ms y `replace` en el historial (escribir no llena el botón «atrás»); filtros y página sí crean entrada.
«Volver a productos» desde el formulario conserva búsqueda, filtros y página.

### Estados del listado
| Estado | Qué se ve |
|---|---|
| Cargando | Skeleton con forma de filas (escritorio) o tarjetas (móvil); `aria-busy="true"` en la región |
| 5 s sin respuesta | Alerta info «El servidor se está despertando…» encima, el skeleton sigue |
| Vacío (primera vez, sin filtros) | Icono + «Todavía no hay productos» + «Crea el primero…» + [Nuevo producto] |
| Sin resultados | «No hay productos que coincidan con «arroz»» (o «…con estos filtros») + aviso de tildes + [Limpiar filtros] |
| Error 5xx | Icono rojo + «No se pudieron cargar los productos» + `detail` + «Código para soporte: …» pequeño + [Reintentar] |
| Error de red | Icono sin conexión + «No pudimos conectar con el servidor» + [Reintentar] |
| Sin conexión | Alerta ámbar persistente arriba del contenido |
| Página fuera de rango (enlace viejo) | Se redirige a la última página con datos (CA-20) |

Tras buscar o filtrar, una región `role="status"` oculta anuncia «N productos» sin mover el foco.

## 3. Formulario de alta / edición

**Ruta propia** (`/products/new`, `/products/:id/edit`, CA-25), no modal: el enlace se comparte, «atrás» funciona y en móvil
hay pantalla completa sin un segundo nivel de foco atrapado.

**Campos (orden)**: Nombre · SKU | Categoría · Unidad de medida | Stock mínimo · Precio de venta de referencia (importe + moneda).

| Decisión | Por qué |
|---|---|
| Se marcan «(obligatorio)» y «(opcional)» en todos | Mitad y mitad: marcar ambos evita dudas. |
| Ejemplo de nombre en la ayuda («Aceite de girasol 1 L») | El nombre no es único: incluir la presentación evita duplicados confusos. |
| SKU se pasa a mayúsculas al salir del campo | El usuario ve lo que guardará el backend (CA-2). |
| Categoría con `<datalist>` nativo | Autocompleta las existentes (CA-22) sin librerías y permite crear una nueva escribiendo. |
| Unidad con nombre largo en el selector («Kilogramo (kg)») y corto en cantidades («12,5 kg») | Claridad al elegir, compacidad al leer. |
| Stock mínimo con la unidad como sufijo, por defecto `0` | Se entiende «10 kg» vs «10 u»; 0 = sin aviso, explicado en la ayuda. |
| Precio + moneda en la misma fila, la moneda como select CUP/USD | Importe y moneda se leen juntos; el select siempre tiene valor, así que el error «moneda sin precio» no puede ocurrir desde la UI: si el importe está vacío se envía `salePriceCurrency: null`. |
| Moneda preseleccionada: la del producto; en alta, **siempre USD** (CA-25; decisión de la supervisión, 2026-11-05) | Predecible: no depende de qué hizo el último usuario en ese dispositivo. |
| `inputmode="decimal"` y se acepta coma o punto | Teclado numérico en móvil; en español se escribe coma. El cliente normaliza a número JSON. |
| Stock y costo en una tarjeta aparte, como `<dl>` (texto, no inputs deshabilitados) con candado + «Se actualiza con las compras y ventas» | Nadie intenta editarlo y se puede copiar; el candado explica el porqué (CA-25). En alta solo una línea: «El stock empieza en 0…». |
| Botones al final del formulario: [Cancelar] [Guardar producto] a la derecha (escritorio); en móvil a ancho completo, apilados con el primario arriba | Patrón del design system §7.1: el bloque queda abajo, cerca del pulgar, y el primario es lo primero que se ve. |
| Tarjeta **«Estado del producto»** separada, solo ADMIN, con [Desactivar producto] / [Activar producto] | Cambiar el estado no depende de «Guardar» ni se mezcla con los datos. |
| Desactivar = botón secundario + confirmación; **no rojo** | Es reversible; el rojo se reserva a lo irreversible (§3.1). Activar no pide confirmación. |
| Línea de auditoría pequeña al final («Creado por mario el … · Última modificación por …») | Trazabilidad sin ocupar sitio. |

### Validación y errores
- Se valida al salir de cada campo y al enviar; al enviar, foco al primer campo con error. Un error se borra en cuanto el valor es válido.
- Reglas en cliente = reglas de la API (nombre 1–120; SKU `[A-Za-z0-9._-]` ≤ 50; categoría ≤ 50; precio ≥ 0 con ≤ 2 decimales; mínimo ≥ 0 con ≤ 3 decimales; unidad obligatoria). La API manda: los `errors` del 400 se pintan en su campo.
- **409 `product.sku_conflict`** → error en el campo SKU, foco en él.
- **409 `resource.version_conflict`** (CA-9) → alerta roja arriba: «Otra persona cambió este producto mientras lo editabas · Tus cambios no se han guardado…» + [Recargar producto]. Al recargar se pierde lo escrito (aceptable en Sprint 1; mejora futura: mostrar ambas versiones).
- Red / servidor dormido: igual que en el listado, con [Reintentar] que reenvía el formulario.
- Guardando: botón con spinner «Guardando…», deshabilitado (no hay doble envío).
- Cancelar o «Volver» con cambios sin guardar → diálogo «¿Descartar los cambios?» [Seguir editando] [Descartar].
- Producto inexistente (404) → «Este producto no existe» + [Volver a productos].
- Éxito → vuelve al listado (con sus filtros) y toast «Producto «X» creado.» / «Cambios guardados.».

### Desactivar (ADMIN)
Diálogo: «¿Desactivar «Aceite de girasol 1 L»?» + qué implica + si tiene stock, aviso ámbar con físico y reservado (CA-14).
Botones [Cancelar] [Desactivar]. Tras desactivar: toast con **[Deshacer]** (reactiva). Si el filtro es «Activos», la fila desaparece
y el foco vuelve al inicio del contenido.

## 4. Accesibilidad (checklist aplicada en el prototipo)
- «Saltar al contenido», landmarks (`nav` con nombre, `main`, `aside`), un `h1` por vista.
- Tabla con `th scope="col"`, `caption` oculto con la página, `aria-sort` en la columna ordenable.
- Botones de fila con el nombre del producto en texto oculto; avatar con `aria-label` «Cuenta de Mario Bejerano».
- Diálogos con `<dialog>` + `showModal()`, retorno de foco al botón que los abrió.
- Toasts: éxito en `aria-live="polite"` (se cierran a los 5 s, se pausan con ratón/foco); errores con `role="alert"` y no se cierran solos.
- 360 px sin scroll horizontal; objetivos ≥ 44 px (los botones `sm` de la tabla solo existen en ≥ 768).

## 5. Etiquetas de stock: ocultas hasta HU-04 (decisión 2026-11-05)

En el Sprint 1 todo el stock es 0, así que todas las filas dirían «Sin stock». Por eso, en HU-02:
- Listado y tarjetas **no** muestran las etiquetas «Sin stock» ni «Stock bajo». Sí se muestran la cifra «Disponible» y la etiqueta «Inactivo».
- El formulario no cambia: la tarjeta «Stock y costo» (solo lectura) y el campo «Stock mínimo» se mantienen.
- La API sigue devolviendo `stock` y `lowStock` (CA-17); el frontend simplemente no pinta las etiquetas todavía.

**Cómo se activarán con HU-04** (Forja-Front):
1. Implementar en HU-02 la función `stockBadge(product)` completa (inactivo → nada de stock; `available <= 0` → «Sin stock» `danger`; `lowStock` → «Stock bajo» `warning`), detrás de una constante `SHOW_STOCK_BADGES = false` en un único sitio (p. ej. `features.ts`), con sus textos ya en los archivos de traducción (`products.badge_out_of_stock`, `products.badge_low_stock`, ver [`copy.md`](../copy.md)).
2. En HU-04, cuando haya entradas por compra, se pone `SHOW_STOCK_BADGES = true` (o se elimina la constante) en el mismo PR, y se añade a sus criterios de aceptación. No hace falta tocar la maquetación: la columna «Estado» y la zona de etiquetas de la tarjeta ya existen.
3. Vera: en HU-02 comprobar que no aparecen; en HU-04, que aparecen con los umbrales correctos.

En el prototipo, ⚙ → «Previsualizar etiquetas de stock» enseña cómo se verán.

## 6. Notas pendientes
Ya reflejado por Faro en las historias: filtro Estado (CA-19), etiquetas de stock desde HU-04 (CA-17), USD por defecto (CA-25), layout con barra inferior y sin «Usuarios» (HU-01 CA-24).
1. «Sin stock» lo deriva el frontend (`available <= 0`); `lowStock` viene de la API. Para HU-04: valorar que la API devuelva un `stockStatus`.
2. La búsqueda distingue tildes (CA-18): se avisa en el estado «sin resultados»; `unaccent` queda como mejora (fuera de alcance).
