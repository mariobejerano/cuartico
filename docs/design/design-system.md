# Design system de Cuartico (v0.1)

> Responsable: Lienzo · Sprint 1 · **Estado: Aprobado por la supervisión (2026-11-05).**
> Tokens: [`tokens.css`](tokens.css) · Muestrario navegable: [`prototypes/design-system.html`](prototypes/design-system.html)

Este documento define la base visual del panel interno **`cuartico-web`**. La tienda **Combazo** (fase 2) reutilizará
la misma estructura de tokens con otra identidad de marca (ver [§10](#10-preparado-para-combazo)).

---

## 1. Principios

| # | Principio | Qué significa en la práctica |
|---|---|---|
| 1 | **Rápido de operar** | Registrar una operación en pocos toques: acción principal siempre visible, formularios cortos, sin pasos de confirmación innecesarios (solo en acciones destructivas). |
| 2 | **Móvil primero** | Se diseña a 360 px y se amplía. Objetivos táctiles ≥ 44 px. Navegación al alcance del pulgar. |
| 3 | **Ligero en redes lentas** | 0 fuentes web, 0 librerías de UI, iconos SVG en línea (pocos), sin imágenes decorativas. Todo el CSS base cabe en pocos KB. |
| 4 | **Legible** | Cuerpo a 16 px, contraste AA (la mayoría AAA), cifras con dígitos tabulares para comparar importes en columna. |
| 5 | **Sobrio** | El color se reserva para **acción** (teal) y **estado** (badges, alertas). El resto es neutro: así lo importante destaca. |
| 6 | **Nunca solo color** | Todo estado lleva texto (y, si cabe, icono). Funciona para daltónicos y en pantallas de mala calidad bajo el sol. |
| 7 | **Bilingüe sin romperse** | Los componentes crecen con el texto (el inglés y el español varían ±30 %); nada de anchos fijos en botones o badges ni texto dentro de imágenes. |

---

## 2. Arquitectura de tokens

Dos capas, para poder cambiar de tema (claro/oscuro) o de marca (Cuartico/Combazo) sin tocar componentes:

| Capa | Prefijo | Ejemplo | Quién la usa |
|---|---|---|---|
| **Base** | `--base-*` | `--base-teal-700: #0f766e` | Solo `tokens.css`. **Nunca** desde un componente. |
| **Semántica** | `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--text-*`, `--font-*`, `--control-*`, `--layout-*`, `--z-*`, `--duration-*` | `--color-action-primary-bg` | Componentes React (CSS Modules o CSS plano). |

**Temas**
- Claro por defecto. Oscuro automático según `prefers-color-scheme`.
- Forzar desde la app (preferencia del usuario guardada en `localStorage`): `<html data-theme="dark">` o `data-theme="light"`.
- El bloque oscuro está duplicado en `tokens.css` (media query + atributo) porque CSS no permite compartirlo: **al cambiar uno, cambiar el otro**.

**Uso en React (para Forja-Front)**
```ts
// main.tsx
import "./styles/tokens.css"; // copia de docs/design/tokens.css
```
```css
/* Button.module.css */
.primary { background: var(--color-action-primary-bg); color: var(--color-action-primary-text); }
```
Justificación: CSS custom properties nativas → 0 dependencias, funcionan con cualquier forma de estilar y permiten cambiar tema en caliente.

---

## 3. Color

Contrastes calculados con la fórmula de luminancia relativa de WCAG 2.x. AA exige **4.5:1** para texto normal,
**3:1** para texto grande (≥ 24 px, o ≥ 18.66 px en negrita) y para bordes de controles e indicadores de foco (WCAG 1.4.11).

### 3.1 Marca y acción

| Token | Claro | Oscuro | Contraste | Por qué |
|---|---|---|---|---|
| `--color-brand` / `--color-action-primary-bg` | `#0f766e` teal-700 | `#2dd4bf` teal-400 | blanco sobre teal-700: **5.47** · teal-950 sobre teal-400: **7.77** | Verde azulado: transmite "dinero en orden" y calma sin parecerse al azul genérico de enlaces ni al verde de "pagado". |
| `--color-action-primary-bg-hover` | `#115e59` | `#5eead4` | **7.58** · **9.78** | El hover oscurece (claro) o aclara (oscuro): el cambio se percibe sin depender del matiz. |
| `--color-action-danger-bg` | `#b91c1c` red-700 | `#f87171` red-400 | **6.47** · **5.84** | Rojo reservado a borrar/anular: si aparece, algo es irreversible. |
| `--color-focus` | `#1d4ed8` blue-700 | `#93c5fd` blue-300 | **6.70** sobre blanco · **9.9** sobre fondo oscuro | Azul distinto de la marca: el foco de teclado se ve incluso sobre un botón teal. |
| `--color-link` | `#0f766e` | `#2dd4bf` | **5.47** · **7.87** | Mismo color que la marca, **siempre subrayado** para no depender del color. |

### 3.2 Neutros (texto, fondos, bordes)

| Token | Claro | Oscuro | Contraste | Por qué |
|---|---|---|---|---|
| `--color-bg` | `#f8fafc` | `#0f172a` | — | Fondo de página apenas gris: las tarjetas blancas se separan sin necesitar sombras fuertes. |
| `--color-surface` | `#ffffff` | `#1e293b` | — | Superficie de trabajo (tarjetas, tablas, modales). |
| `--color-surface-muted` | `#f1f5f9` | `#334155` | encima **solo** `--color-text`: 16.3 · 9.45 | Cabecera de tabla, skeletons. En oscuro, el texto atenuado encima daría 4.04 (no AA): prohibido. |
| `--color-surface-hover` | `#f8fafc` | `#243041` | `--color-text-muted` encima: 7.26 · 5.20 | Hover de fila sin perder contraste del texto secundario. |
| `--color-text` | `#0f172a` | `#f1f5f9` | **17.85** · **13.37** | Casi negro / casi blanco: máximo contraste sin el brillo agresivo del puro. |
| `--color-text-muted` | `#475569` | `#94a3b8` | **7.58** · **5.71** | Texto secundario (ayudas, metadatos). Se eligió slate-600 y no slate-500 (4.56 sobre `--color-bg`, demasiado justo). |
| `--color-border` | `#e2e8f0` | `#334155` | decorativo | Divisores entre filas y tarjetas: no transmiten información. |
| `--color-border-strong` | `#64748b` | `#94a3b8` | **4.76** · **5.71** | Borde de inputs y botón secundario: ≥ 3:1 para que se vea dónde escribir (WCAG 1.4.11). |
| `--color-action-disabled-*` | bg `#e2e8f0` / texto `#64748b` | bg `#334155` / texto `#94a3b8` | 3.86 · 4.04 (exento) | Deshabilitado es exento de contraste, pero se mantiene legible para que se entienda qué falta. |

### 3.3 Feedback

Cada estado tiene tres tokens: `-text` (texto sobre superficie), `-bg` (fondo suave) y `-on-bg` (texto sobre ese fondo).

| Estado | `-text` claro / oscuro | `-bg` + `-on-bg` claro | `-bg` + `-on-bg` oscuro | Uso |
|---|---|---|---|---|
| `success` | `#15803d` **5.01** / `#86efac` **10.4** | `#dcfce7` + `#166534` **6.49** | `#052e16` + `#86efac` **10.6** | Guardado, pagado, entregado |
| `warning` | `#92400e` **7.09** / `#fcd34d` **10.2** | `#fef3c7` + `#92400e` **6.37** | `#451a03` + `#fcd34d` **10.4** | Pendiente, pago parcial, stock bajo |
| `danger` | `#b91c1c` **6.47** / `#fca5a5` **7.7** | `#fee2e2` + `#991b1b` **6.80** | `#450a0a` + `#fca5a5` **8.5** | Errores, sin pagar, sin stock |
| `info` | `#1d4ed8` **6.70** / `#93c5fd` **8.12** | `#dbeafe` + `#1e40af` **7.15** | `#172554` + `#93c5fd` **8.15** | Confirmado, avisos neutros |
| `accent` | — | `#ede9fe` + `#5b21b6` **7.57** | `#2e1065` + `#c4b5fd` **8.26** | En camino (estado "en movimiento", distinto de los demás) |
| `neutral` | — | `#f1f5f9` + `#334155` **9.45** | `#334155` + `#e2e8f0` **8.4** | Cancelado, inactivo, borrador |

> Los badges con fondo suave van de 6.4:1 a 10.6:1: margen suficiente para pantallas baratas con brillo bajo.

---

## 4. Tipografía

- **Familia: fuentes del sistema** (`system-ui, -apple-system, "Segoe UI", Roboto, …`).
  Por qué: 0 KB descargados, render inmediato (sin parpadeo de fuente) y aspecto nativo en cada móvil.
- **Cifras**: `font-variant-numeric: tabular-nums` en tablas, importes y stock. Por qué: los dígitos ocupan lo mismo y las columnas se alinean.
- **Importes**: siempre con su moneda (`1 250,00 CUP`, `12.50 USD`), formateados con `Intl.NumberFormat` según el idioma. Alineados a la derecha en tablas.

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| `--text-3xl` | 30 px | 700 | Cifras destacadas (resúmenes) |
| `--text-2xl` | 24 px | 700 | Título de página (`h1`) |
| `--text-xl` | 20 px | 600 | Título de sección / tarjeta (`h2`) |
| `--text-lg` | 18 px | 600 | Subtítulo (`h3`), título de modal |
| `--text-md` | 16 px | 400 | **Cuerpo, inputs, botones**. 16 px evita que iOS haga zoom al enfocar un input. |
| `--text-sm` | 14 px | 400/500 | Tablas en escritorio, ayudas, etiquetas de badge |
| `--text-xs` | 12 px | 500 | Solo metadatos no esenciales (fecha de auditoría). Nunca para errores. |

Interlineado: `--line-height-base` 1.5 para texto, `--line-height-tight` 1.25 para títulos.
Pesos: 400, 500, 600, 700 (los que trae cualquier fuente del sistema).

---

## 5. Espaciado, radios, sombras, capas

**Espaciado** (base 4 px): `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-8` 32 · `-10` 40 · `-12` 48 · `-16` 64.
Por qué base 4: múltiplos simples, coherentes con los 44 px de control y fáciles de recordar.

| Contexto | Móvil | Escritorio |
|---|---|---|
| Margen de página | `--space-4` | `--space-8` |
| Separación entre secciones | `--space-6` | `--space-8` |
| Padding de tarjeta | `--space-4` | `--space-6` |
| Separación entre campos de formulario | `--space-4` | `--space-5` |
| Separación entre botones | `--space-3` | `--space-3` |

**Radios**: `--radius-sm` 4 px (badges) · `--radius-md` 8 px (botones, inputs) · `--radius-lg` 12 px (tarjetas, modales) · `--radius-full` (avatares, pills).
Por qué: redondeo moderado = moderno pero serio; Combazo podrá subirlo para sentirse más cercano.

**Sombras**: `--shadow-sm` (tarjetas), `--shadow-md` (menús desplegables, barra inferior), `--shadow-lg` (modales, toasts).
Por qué: sombras suaves y pocas; la jerarquía la marcan el fondo y los bordes, no los efectos.

**Capas (z-index)**: sticky 10 · nav 20 · overlay 40 · modal 50 · toast 60. Siempre por token, nunca números sueltos.

**Movimiento**: 120–200 ms con `--easing-standard`; con `prefers-reduced-motion` las duraciones pasan a 0.

**Breakpoints**: móvil `< 768px` · tablet `768–1023px` · escritorio `≥ 1024px` (en media queries se escriben a mano: no aceptan `var()`).

---

## 6. Estados de interacción (comunes a todos los controles)

| Estado | Regla | Por qué |
|---|---|---|
| **Hover** | Cambia el fondo un paso (`-bg-hover`). Solo con `@media (hover: hover)` para no dejar estados "pegados" en táctil. | Feedback sin parpadeos en móvil. |
| **Foco** | `outline: var(--focus-ring-width) solid var(--color-focus); outline-offset: var(--focus-ring-offset);` solo con `:focus-visible`. **Nunca** `outline: none` sin sustituto. | Uso con teclado (escritorio) y lectores de pantalla. |
| **Activo / pulsado** | `-bg-active` y sin desplazamiento. | Confirma el toque. |
| **Deshabilitado** | `--color-action-disabled-*`, `cursor: not-allowed`, atributo `disabled` (o `aria-disabled="true"` si debe seguir siendo enfocable para explicar por qué). | Se ve qué no se puede hacer, sin desaparecer. |
| **Cargando** | El botón conserva su ancho, muestra spinner + texto ("Guardando…"), `aria-busy="true"` y queda deshabilitado. | Evita doble envío (crítico con red lenta: el usuario tiende a volver a pulsar). |
| **Error** | Borde `--color-danger-text` (2 px), mensaje debajo con icono, `aria-invalid="true"` + `aria-describedby`. | El error se ve, se lee y lo anuncia el lector de pantalla. |

---

## 7. Componentes base

Clases de ejemplo con prefijo `c-` en el muestrario HTML; en React serán componentes (`<Button variant="primary">`). Los nombres de props son orientativos: los fija Forja-Front.

### 7.1 Botón

| Variante | Uso | Estilo |
|---|---|---|
| `primary` | **Una** acción principal por vista (Guardar, Nuevo producto) | Fondo `--color-action-primary-bg`, texto `-text` |
| `secondary` | Acciones alternativas (Cancelar, Exportar) | Fondo superficie, borde `--color-action-secondary-border` |
| `danger` | Destructivas (Eliminar, Anular pedido). Siempre con confirmación | Fondo `--color-action-danger-bg` |
| `ghost` | Acciones terciarias en tablas (Editar) | Sin fondo ni borde, texto `--color-link`; hover con `--color-surface-hover` |

- Alto `--control-height` (44 px); `sm` (32 px) **solo en escritorio** dentro de tablas.
- Padding horizontal `--space-4`; ancho automático (crece con el texto en inglés). En móvil, los botones de un formulario ocupan el 100 % y el bloque de botones va **al final** del formulario, cerca del pulgar.
- Icono opcional a la izquierda (16–20 px). Botón solo-icono: obligatorio `aria-label`.
- Orden: en escritorio [Secundario] [Primario] alineados a la derecha; en móvil primario arriba de la pila y secundario debajo.

### 7.2 Campo de texto (input)

- Estructura: **etiqueta visible** (`<label for>`) arriba → input → ayuda o error debajo. Nunca placeholder como etiqueta (desaparece al escribir).
- Alto 44 px, texto 16 px, borde 1 px `--color-border-strong`, radio `--radius-md`, fondo `--color-surface`.
- Obligatorio: marca "(obligatorio)" en texto tras la etiqueta, no solo un asterisco rojo. Si casi todos son obligatorios, marcar los "(opcional)".
- Error: borde 2 px `--color-danger-text`, icono + mensaje en `--color-danger-text` 14 px, `aria-invalid="true"`, `aria-describedby="<id>-error"`.
  Se valida al salir del campo (`blur`) y al enviar; al enviar, foco al primer campo con error.
- Importes: `inputmode="decimal"`, moneda como sufijo visible (`CUP`). Cantidades: `inputmode="numeric"`.
- Deshabilitado: fondo `--color-action-disabled-bg`. Solo lectura: sin borde, texto normal (se puede copiar).

### 7.3 Select

- Se usa el **`<select>` nativo** con estilo mínimo (borde, alto, flecha SVG en `background-image` inline).
  Por qué: en móvil abre el selector del sistema (mejor que cualquier desplegable propio), es accesible de serie y no pesa nada.
- Mismos estados que el input. Para listas largas (> 15 opciones, p. ej. productos) se diseñará un combobox con búsqueda cuando haga falta.

### 7.4 Tabla / listado

- **Escritorio (≥ 768 px)**: `<table>` semántica. Cabecera `--color-surface-muted` con `--color-text` en 14 px semibold; filas con divisor `--color-border`; hover `--color-surface-hover`.
  Números e importes alineados a la derecha con `tabular-nums`. Acciones de fila a la derecha (botón `ghost` `sm`).
  Cabecera *sticky* si la tabla es larga. Paginación debajo ("Mostrando 1–20 de 134").
- **Móvil (< 768 px)**: **cada fila pasa a ser una tarjeta**. Misma marcación `<table>` con CSS (`display: block`) y `data-label` en cada celda para mostrar el nombre de la columna. Primera celda = título de la tarjeta; estado (badge) arriba a la derecha; acciones al pie.
  Por qué: las tablas horizontales con scroll en móvil esconden columnas; la tarjeta muestra todo sin desplazamiento lateral.
  Ojo (accesibilidad): cambiar `display` de una tabla hace que algunos navegadores (Safari/VoiceOver) pierdan su semántica.
  En React, o se añaden los roles explícitos (`role="table"`, `"row"`, `"cell"`…) o se renderiza una lista de tarjetas (`<ul>`) en móvil; Forja-Front elige y lo documenta.
- Barra superior del listado: búsqueda (input con icono) + filtros (select) + botón primario "Nuevo…". En móvil, el botón primario se convierte en **botón flotante** (FAB) sobre la barra inferior o queda arriba a ancho completo (decidir por pantalla).
- Estados de la tabla: carga (skeleton de 5 filas), vacío (§7.9), error (§7.10), sin resultados de búsqueda (vacío con "Limpiar filtros").

### 7.5 Badge de estado

Pill con punto de color + texto, radio `--radius-full`, 14 px medium, fondo `-bg` y texto `-on-bg`. El texto siempre está: el color es refuerzo.

**Estado del pedido**

| Código (API) | Variante | es | en |
|---|---|---|---|
| `PENDING` | `warning` | Pendiente | Pending |
| `CONFIRMED` | `info` | Confirmado | Confirmed |
| `IN_TRANSIT` | `accent` | En camino | In transit |
| `DELIVERED` | `success` | Entregado | Delivered |
| `CANCELLED` | `neutral` | Cancelado | Cancelled |

**Estado del pago**

| Código (API) | Variante | es | en |
|---|---|---|---|
| `UNPAID` | `danger` | Sin pagar | Unpaid |
| `PARTIALLY_PAID` | `warning` | Pago parcial | Partially paid |
| `PAID` | `success` | Pagado | Paid |

**Otros**: producto/usuario `Activo`/`Active` (`success`), `Inactivo`/`Inactive` (`neutral`); stock `Stock bajo`/`Low stock` (`warning`), `Sin stock`/`Out of stock` (`danger`).

### 7.6 Alerta (en página) y toast

**Alerta en página** (`role="alert"` si es error tras una acción; `role="status"` si es informativa):
fondo `-bg`, borde izquierdo 4 px del color `-on-bg`, icono + título opcional + texto + acción opcional. Para mensajes que deben quedarse (p. ej. "Sin conexión").

**Toast** (confirmación efímera de una acción):
- Posición: **abajo-centro en móvil** (encima de la barra inferior), **abajo-derecha en escritorio**. Por qué: cerca de donde se pulsó y lejos del título.
- Superficie `--color-surface`, sombra `--shadow-lg`, borde izquierdo de color por estado, icono + texto + botón cerrar (44 px).
- Éxito: se cierra solo a los **5 s** (se pausa al pasar el ratón o enfocar). **Errores no se cierran solos.**
- Contenedor con `aria-live="polite"` (éxito/info) o `role="alert"` (error). Máximo 3 a la vez.
- Puede llevar acción: "Producto eliminado · **Deshacer**".

### 7.7 Modal (diálogo)

- `<dialog>` nativo con `showModal()`: foco atrapado, `Esc` para cerrar y fondo inerte sin librerías.
- Ancho máx. 32 rem, radio `--radius-lg`, sombra `--shadow-lg`, fondo `--overlay-bg`. En móvil, **hoja inferior** (anclado abajo, ancho completo).
- Título (`--text-lg`), contenido, acciones a la derecha. Al cerrar, el foco vuelve al botón que lo abrió.
- Uso principal: confirmar acciones destructivas. Texto concreto: "¿Eliminar «Pollo troceado 1 kg»? Esta acción no se puede deshacer." Botón con verbo: "Eliminar", no "Aceptar".

### 7.8 Layout de la aplicación

```
Escritorio ≥1024px                    Móvil <768px
┌──────────┬──────────────────────┐   ┌───────────────────────┐
│ CUARTICO │ Título      [Acción] │   │ ☰? Título   [Usuario] │ ← barra superior 56px
│          │                      │   ├───────────────────────┤
│ Inicio   │  Contenido           │   │  Contenido            │
│ Pedidos  │  (máx. 1280px)       │   │                       │
│ Productos│                      │   │                       │
│ Combos   │                      │   ├───────────────────────┤
│ …        │                      │   │ Ini Ped Prod Comb Más │ ← barra inferior 64px
│ Usuario  │                      │   └───────────────────────┘
└──────────┴──────────────────────┘
```
- **Escritorio**: barra lateral fija de 240 px (marca arriba, navegación, usuario y "Cerrar sesión" abajo). Elemento activo: fondo `--color-brand-subtle`, texto `--color-brand`, barra de 3 px a la izquierda y `aria-current="page"`.
- **Tablet**: barra lateral contraída a iconos (64 px) con `aria-label`/tooltip.
- **Móvil**: barra superior con título de la página + menú de usuario, y **barra inferior** con 4 secciones + "Más".

**Decisión: navegación en móvil**

| Opción | Pros | Contras |
|---|---|---|
| A. Barra inferior (4 + "Más") | Al alcance del pulgar; secciones siempre visibles; 1 toque para cambiar | Ocupa 64 px; máx. 5 destinos |
| B. Menú hamburguesa | Cabe todo; ocupa 0 px | Navegación oculta (se usa menos), 2 toques, arriba lejos del pulgar |
| C. Híbrido: barra inferior + "Más" abre una hoja con el resto | A + escalable a todos los módulos | Hay que elegir bien los 4 principales |

**Recomendación: C.** Operar pedidos y productos es diario y debe estar a un toque; los módulos ocasionales (gastos, usuarios, reportes) viven en "Más".
Propuesta inicial: **Inicio · Pedidos · Productos · Combos · Más**. En el Sprint 1 solo existe "Productos": el resto se mostrará cuando exista (no se ponen enlaces muertos).
Los elementos de la barra inferior llevan icono **y** texto (12–14 px): los iconos solos son ambiguos.

Otras reglas de layout: área segura de iOS (`env(safe-area-inset-bottom)`) en la barra inferior; el contenido reserva su altura para que nada quede tapado; enlace "Saltar al contenido" como primer elemento enfocable.

### 7.9 Estado vacío

Centrado en el área del listado: icono SVG lineal pequeño (48 px, `--color-text-muted`), título, una frase de ayuda y **la acción para salir del vacío**.
- Primera vez: "Todavía no hay productos" · "Crea el primero para poder armar combos." · [Nuevo producto]
- Sin resultados de búsqueda: "No hay productos que coincidan con «arroz»" · [Limpiar búsqueda]
Por qué: un vacío sin acción deja al usuario sin saber qué hacer; sin ilustraciones pesadas para no gastar datos.

### 7.10 Carga y error

- **Carga de listados**: *skeleton* (bloques `--color-surface-muted` con la forma de las filas/tarjetas), animación de opacidad suave (desactivada con *reduced motion*). Si tarda > 10 s, mensaje "Está tardando más de lo normal. Revisa tu conexión." sin cancelar la petición.
  Por qué: el skeleton anticipa la forma del contenido y se percibe más rápido que un spinner en redes lentas.
- **Carga de acciones**: en el propio botón (§6). Spinner solo dentro de botones o en cargas puntuales pequeñas.
- **Error al cargar**: en el área del contenido, icono + "No se pudieron cargar los productos" + detalle de la API (`detail` traducido del ProblemDetail) + [Reintentar]. El `code` no se muestra al usuario, pero se puede incluir en texto pequeño para soporte.
- **Sin conexión**: alerta persistente `warning` arriba del contenido: "Sin conexión. Los cambios no se guardarán hasta que vuelvas a tener internet."
- **Errores de formulario de la API (400/409)**: se mapean a los campos cuando se pueda; si no, alerta `danger` arriba del formulario.

---

## 8. Accesibilidad (checklist para implementar y revisar)

- [ ] Todo se puede hacer con teclado; orden de tabulación = orden visual; foco visible (`--color-focus`).
- [ ] Contraste AA según las tablas de §3; no introducir colores fuera de los tokens.
- [ ] Inputs con `<label>` asociado; errores con `aria-invalid` y `aria-describedby`.
- [ ] Botones solo-icono con `aria-label` traducido.
- [ ] Estados con texto, no solo color.
- [ ] Toasts y alertas anunciados (`aria-live` / `role="alert"`).
- [ ] Modales con `<dialog>` y retorno de foco.
- [ ] Objetivos táctiles ≥ 44 × 44 px en móvil.
- [ ] `lang` del `<html>` actualizado al cambiar de idioma (`es` / `en`).
- [ ] Respeta `prefers-reduced-motion` y `prefers-color-scheme`.
- [ ] Zoom al 200 % sin pérdida de contenido; nada de `user-scalable=no`.

---

## 9. Textos de interfaz comunes (es / en)

Claves orientativas para `react-i18next` (las define Forja-Front; aquí se fija el texto).
Los textos de cada pantalla (login, layout, productos, unidades) están en [`copy.md`](copy.md).

| Clave sugerida | es | en |
|---|---|---|
| `common.save` | Guardar | Save |
| `common.saving` | Guardando… | Saving… |
| `common.cancel` | Cancelar | Cancel |
| `common.delete` | Eliminar | Delete |
| `common.edit` | Editar | Edit |
| `common.close` | Cerrar | Close |
| `common.retry` | Reintentar | Try again |
| `common.undo` | Deshacer | Undo |
| `common.search` | Buscar | Search |
| `common.clear_search` | Limpiar búsqueda | Clear search |
| `common.more` | Más | More |
| `common.required` | (obligatorio) | (required) |
| `common.optional` | (opcional) | (optional) |
| `common.loading` | Cargando… | Loading… |
| `common.slow_network` | Está tardando más de lo normal. Revisa tu conexión. | This is taking longer than usual. Check your connection. |
| `common.offline` | Sin conexión. Los cambios no se guardarán hasta que vuelvas a tener internet. | You're offline. Changes won't be saved until you're back online. |
| `common.load_error` | No se pudo cargar la información. | We couldn't load the information. |
| `common.saved` | Cambios guardados | Changes saved |
| `common.skip_to_content` | Saltar al contenido | Skip to content |
| `common.pagination` | Mostrando {{from}}–{{to}} de {{total}} | Showing {{from}}–{{to}} of {{total}} |
| `nav.home` | Inicio | Home |
| `nav.orders` | Pedidos | Orders |
| `nav.products` | Productos | Products |
| `nav.combos` | Combos | Combos |
| `nav.logout` | Cerrar sesión | Log out |
| `confirm.delete_title` | ¿Eliminar «{{name}}»? | Delete "{{name}}"? |
| `confirm.irreversible` | Esta acción no se puede deshacer. | This action can't be undone. |
| `validation.required` | Este campo es obligatorio. | This field is required. |
| `validation.positive` | Debe ser mayor que 0. | Must be greater than 0. |

Estados de pedido y pago: ver §7.5. Tono: tuteo, frases cortas, verbos concretos ("Guardar producto", no "Aceptar").

---

## 10. Preparado para Combazo

- Combazo será `[data-brand="combazo"]` sobre el mismo `tokens.css` (bloque reservado al final del archivo).
- **Solo remapea**: `--color-brand*`, `--color-link`, `--color-action-primary-*`, `--font-family-display` y, si se quiere, radios.
  Estados, neutros, espaciado y accesibilidad se heredan: un "Pagado" se ve igual en ambas marcas.
- La identidad de Combazo (cercana, alegre, con sabor cubano) se propondrá con opciones en la fase 2; cualquier color nuevo deberá pasar la misma verificación AA de §3.
- Si Combazo necesita una fuente propia para titulares, se valorará su peso (objetivo < 30 KB, `woff2`, subset latino, `font-display: swap`) frente a la alternativa del sistema.

---

## 11. Pendiente de aprobación de la supervisión

1. Color de marca de Cuartico: **teal `#0f766e`** (alternativas valoradas: azul `#1d4ed8`, más genérico y choca con el foco; índigo, más "tecnológico" y menos sobrio).
2. Navegación móvil: **barra inferior + "Más"** (opción C).
3. Modo oscuro desde el inicio (automático + conmutador manual).
4. Mapeo de colores de los estados de pedido y pago (§7.5).

## Historial
| Versión | Fecha | Cambio |
|---|---|---|
| 0.1 | 2026-10-30 | Primera propuesta (Sprint 1) |
| 0.1.1 | 2026-10-30 | Aclarada la posición de los botones en móvil (§7.1); enlace a `copy.md` (§9) |
