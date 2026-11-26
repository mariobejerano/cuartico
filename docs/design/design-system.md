# Design system de Cuartico (v0.2)

> Responsable: Lienzo · Sprint 3 (TT-19) · **Estado: aprobado por la supervisión (2026-11-26).**
> Base aprobada: propuesta B, tema claro y oscuro, botón sol/luna, densidad, badge «Activo» y filtro segmentado
> ([redesign-proposals.md §6](redesign-proposals.md#6-decisiones-de-la-supervisión-2026-11-13), 2026-11-13).
> Técnica: [ADR-004](../analysis/adr/ADR-004-tailwind-shadcn.md) (Tailwind v4 + shadcn/ui sobre Base UI, CSP intacta, sin Sonner); si algo de aquí lo contradice, manda el ADR.
> Tokens: [`tokens.css`](tokens.css) v0.2 · Prototipo de referencia: [`prototypes/redesign-proposals.html`](prototypes/redesign-proposals.html) (propuesta B).
> v0.1 (aprobada 2026-11-05) queda sustituida por este documento. Cada sección indica **[Sustituye a v0.1]**, **[Nuevo]** o **[Sin cambios]**.

Este documento define la base visual del panel interno **`cuartico-web`**. La tienda **Combazo** (fase 2) reutilizará
la misma estructura de tokens con otra identidad (ver [§12](#12-preparado-para-combazo-sustituye-a-v01-nombres-nuevos)).

## Qué cambia respecto a v0.1 (resumen)

| Tema | v0.1 | v0.2 | Por qué |
|---|---|---|---|
| Implementación | CSS propio, 0 librerías | Tailwind v4 + shadcn/ui (Base UI), código copiado al repo | ADR-004: componentes accesibles (menú, toast, drawer) sin escribirlos a mano |
| Nombres de tokens | `--color-action-primary-bg`… con capa `--base-*` | Nombres de shadcn (`--primary`, `--muted`, `--ring`…) sin capa base | El paso a `@theme` es directo y los componentes de shadcn funcionan sin traducir nombres |
| Paleta | Pizarra fría, fondo `#f8fafc` | Arena cálida `#faf8f5`, barra lateral teal oscuro | Identidad reconocible (propuesta B) |
| Foco | Azul `#1d4ed8` | Ámbar `#b45309` (claro) / `#fcd34d` (oscuro) | Se distingue del botón teal y de los enlaces |
| Densidad | 44 px / 16 px en todo | 40 px / 14 px solo ≥ 768 px; 44 px / 16 px en móvil | Más filas visibles en escritorio sin perder objetivo táctil |
| Radios | 4 / 8 / 12 px | 8 / 10 / 12 / 16 px desde `--radius: 12px`; badges en píldora | Más cálido, como B |
| Estado de producto | Solo se marcaba «Inactivo» | Badge «Activo» **siempre** visible | Aprobado 2026-11-13 |
| Filtro de estado | `<select>` | Segmentado Activos · Inactivos · Todos | Un toque menos |
| Acciones de fila | Botón ghost «Editar» | Menú «⋯» (Base UI Menu) | Cabe en 360 px y escala a más acciones |
| Modales | `<dialog>` nativo | Base UI Dialog / AlertDialog / Drawer | El ADR retira el polyfill de `<dialog>` |
| Tema | Automático + conmutador sin especificar | Botón **sol / luna** especificado (§7.12) | Decisión de la supervisión |

---

## 1. Principios **[Sustituye a v0.1: cambian 3 y 5]**

| # | Principio | Qué significa en la práctica |
|---|---|---|
| 1 | **Rápido de operar** | Acción principal siempre visible, formularios cortos, confirmación solo en acciones destructivas o que bloquean uso (desactivar). |
| 2 | **Móvil primero** | Se diseña a 360 px y se amplía. Objetivos táctiles ≥ 44 px en < 768 px. Navegación al alcance del pulgar. |
| 3 | **Ligero en redes lentas** | 0 fuentes web, sin imágenes decorativas, iconos `lucide-react` (SVG, solo los importados). Tailwind genera **CSS estático** en el build (nada de CSS-in-JS): la CSP `style-src 'self'` sigue intacta. Peso extra estimado de Base UI + Tailwind: 25–40 KB gzip (se mide en el PR). |
| 4 | **Legible** | Cuerpo a 16 px en móvil y 14 px en escritorio, contraste AA (la mayoría AAA), cifras con dígitos tabulares. |
| 5 | **Sobrio con identidad** | Teal = acción y marca (botón principal, barra lateral). Ámbar = foco e indicador de «estás aquí». Los estados usan sus colores (badges). El resto es arena/neutro. |
| 6 | **Nunca solo color** | Todo estado lleva texto (y, si cabe, punto o icono). |
| 7 | **Bilingüe sin romperse** | Nada de anchos fijos en botones, badges o segmentados; utilidades lógicas (`ms-*`, `me-*`, `text-start`). |

---

## 2. Arquitectura de tokens **[Sustituye a v0.1]**

| Capa | Dónde | Ejemplo | Quién la usa |
|---|---|---|---|
| **Valores** | `tokens.css` §1–3 (`:root` y bloques oscuros) | `--primary: #0f766e` | Los bloques de tema. Mismo nombre en claro y oscuro. |
| **Puente Tailwind** | `tokens.css` §5 (`@theme inline`, `@custom-variant dark`) | `--color-primary: var(--primary)` | Genera utilidades: `bg-primary`, `text-muted-foreground`, `rounded-xl`, `h-control`. |
| **Alias v0.1** | `tokens.css` §6 | `--color-text: var(--foreground)` | Solo el CSS antiguo (`@layer legacy`) mientras dura la migración. **Se borran en la fase 6.** |

**Temas** (detalle de conmutación en §7.12):
- Claro por defecto. Sin elección guardada, sigue `prefers-color-scheme` (bloque `@media` de `tokens.css`).
- Con elección guardada: `<html data-theme="light">` o `<html data-theme="dark">`. El atributo va **solo en `<html>`**.
- El bloque oscuro está duplicado (media query + atributo): **al cambiar uno, cambiar el otro**.

**Uso en React (Forja-Front)**
```css
/* src/styles/index.css — único CSS importado en main.tsx (fase 0, PR #18) */
@layer theme, base, legacy, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "./tokens.css" layer(legacy);   /* copia de docs/design/tokens.css */
@import "./global.css" layer(legacy);   /* CSS v0.1 hasta la fase 6 */
@import "tailwindcss/utilities.css" layer(utilities);
/* Sin Preflight ni tw-animate-css hasta la fase 6 de ADR-004: las pantallas sin migrar no cambian. */
```
```tsx
<button className="h-control rounded-md bg-primary px-4 text-control font-medium text-primary-foreground hover:bg-primary-hover">
```
- Con tokens no hace falta `dark:` casi nunca: los colores cambian solos. Si hace falta, `dark:` cubre «oscuro elegido» y «oscuro automático».
- A confirmar en el spike (fase 0): que `@theme inline` acepte `var()` en `--shadow-*` y `--spacing-*`. Plan B: `shadow-(--elevation-sm)` y `h-(--control-height)`.
- Justificación: los nombres de shadcn hacen que un componente copiado con `npx shadcn add` funcione con nuestra paleta sin editar clases de color.

---

## 3. Color (propuesta B) **[Sustituye a v0.1]**

Contraste WCAG 2.x calculado con la luminancia relativa. AA: **4.5:1** texto normal, **3:1** texto grande, bordes de
controles e indicadores de foco (1.4.11). Valores contra `card` salvo «bg» (= sobre `background`).

### 3.1 Superficies y texto

| Token | Claro | Oscuro | Contraste | Por qué |
|---|---|---|---|---|
| `background` | `#faf8f5` arena | `#171412` | — | Fondo cálido: las tarjetas blancas se separan sin sombras fuertes. Si amarillea en pantallas baratas: `#f8fafc`. |
| `card` / `popover` | `#ffffff` | `#221e1b` | — | Superficie de trabajo: tarjetas, tablas, menús, diálogos, toasts. |
| `foreground` | `#1c1917` | `#f5f0e8` | 17.5 (16.5 bg) · 14.6 (16.2 bg) | Casi negro cálido / marfil: máximo contraste sin brillo agresivo. |
| `muted` | `#f3efe9` | `#2e2925` | foreground encima 15.3 · 12.7 | Cabecera de lista, stats, skeleton, pista del segmentado. |
| `muted-foreground` | `#57534e` | `#b5ada3` | 7.63 (6.66 sobre muted, 7.20 bg) · 7.46 (6.49 sobre muted) | Ayudas, metadatos, cabeceras de tabla. |
| `accent` | `#fdf3e1` | `#33291f` | muted-foreground encima 6.93 · 6.41 | Hover de botón outline/ghost e ítem de menú: cálido, distinto de la selección. |
| `secondary` / `-hover` | `#f3efe9` / `#ebe4da` | `#2e2925` / `#3a332d` | foreground 15.3 / 13.9 · 12.7 | Botón secundario relleno (poco uso). |
| `border` | `#e7e1d8` | `#38322c` | decorativo | Divisores y contorno de tarjetas: no transmiten información. |
| `input` | `#8f877d` | `#7a7269` | **3.54** (3.34 bg) · **3.50** (3.88 bg) | Borde de campos ≥ 3:1: se ve dónde escribir (shadcn trae ~1.3:1, no lo usamos). |

### 3.2 Marca, acción y foco

| Token | Claro | Oscuro | Contraste | Por qué |
|---|---|---|---|---|
| `primary` / `-foreground` | `#0f766e` / `#ffffff` | `#2dd4bf` / `#042f2e` | **5.47** · **7.77** | Teal de marca (aprobado 2026-11-05): la única mancha de color fuerte de cada vista = la acción principal. |
| `primary-hover` | `#115e59` | `#5eead4` | 7.58 · 9.78 | Oscurece en claro, aclara en oscuro: se nota sin depender del matiz. |
| `primary` como texto (enlaces) | — | — | 5.47 (5.16 bg) · 8.89 | Enlaces en `primary`, **siempre subrayados**. |
| `destructive` / `-foreground` | `#b91c1c` / `#ffffff` | `#f87171` / `#450a0a` | **6.47** · **5.84** | Rojo solo para borrar/anular. También es el color del texto de error: 6.47 (6.10 bg) · 5.98. |
| `destructive-hover` | `#991b1b` | `#fca5a5` | 8.31 · ≥ 7 | ídem hover. |
| `ring` | `#b45309` ámbar | `#fcd34d` | **5.02** (4.74 bg) · **11.5** | Foco de teclado: un anillo teal no se distinguiría del botón teal. |
| `brand-subtle` / `-foreground` | `#ccfbf1` / `#115e59` | `#042f2e` / `#5eead4` | 6.73 · 9.8 | Píldora activa de la barra inferior, badge «N variantes», chips del generador. |

### 3.3 Barra lateral y barra superior móvil

| Token | Claro | Oscuro | Contraste | Por qué |
|---|---|---|---|---|
| `sidebar` / `sidebar-foreground` | `#134e4a` / `#f0fdfa` | `#102624` / `#f0fdfa` | 9.09 · 15.2 | La barra teal fija «dónde estoy»; la barra superior móvil usa la misma superficie. |
| `sidebar-muted-foreground` | `#99f6e4` | `#99f6e4` | 7.5 · 12.6 | Iconos de navegación, rol del usuario, etiquetas de grupo. |
| `sidebar-accent` / `-foreground` | `#1f625d` / `#ffffff` | `#1b3b38` / `#ffffff` | 6.8 · 11.6 | Ítem activo y hover. |
| `sidebar-primary` | `#fbbf24` | `#fbbf24` | 5.68 · 9.5 | Indicador ámbar de 3 px del ítem activo y acento del logo. |
| `sidebar-ring` | `#fbbf24` | `#fcd34d` | 5.68 · 11.0 | Foco sobre teal oscuro (el `ring` ámbar oscuro no llegaría a 3:1 ahí). |
| `sidebar-border` | `#1f625d` | `#1b3b38` | decorativo | Separador del pie de la barra. |

### 3.4 Estados (badges, alertas, toasts)

Cada estado tiene `-bg` (fondo suave) y `-fg` (texto sobre ese fondo y sobre `card`). **[Sustituye a v0.1: `-text` y `-on-bg` se unen en `-fg`; `accent` pasa a `transit`]**

| Estado | Claro `-bg` + `-fg` | Oscuro `-bg` + `-fg` | Uso |
|---|---|---|---|
| `success` | `#dcfce7` + `#166534` **6.49** | `#052e16` + `#86efac` **10.6** | Activo, Pagado, Entregado, guardado |
| `warning` | `#fef3c7` + `#92400e` **6.37** | `#451a03` + `#fcd34d` **10.4** | Pendiente, Pago parcial, Stock bajo |
| `danger` | `#fee2e2` + `#991b1b` **6.80** | `#450a0a` + `#fca5a5` **8.5** | Sin pagar, Sin stock, alertas de error |
| `info` | `#dbeafe` + `#1e40af` **7.15** | `#172554` + `#93c5fd` **8.15** | Confirmado, avisos neutros |
| `transit` | `#ede9fe` + `#5b21b6` **7.57** | `#2e1065` + `#c4b5fd` **8.26** | En camino. Renombrado: `accent` en shadcn es el color de hover. |
| `neutral` | `#efe9e1` + `#44403c` **8.52** | `#2e2925` + `#e7e0d6` **11.0** | Inactivo, Cancelado, borrador |

---

## 4. Tipografía **[Sustituye a v0.1: tamaños por densidad y peso de títulos]**

- **Fuentes del sistema** (`--font-family-base`, en Tailwind `font-sans`): 0 KB y render inmediato.
- **Cifras**: `tabular-nums` en tablas, importes y stock. Importes siempre con moneda (`1 250,00 CUP`, `12.50 USD`) vía `Intl.NumberFormat`; a la derecha en tablas.

| Uso | Móvil (< 768) | Escritorio (≥ 768) | Peso | Clase orientativa |
|---|---|---|---|---|
| Título de página (`h1`) | 24 px | 24 px | 700 | `text-2xl font-bold` |
| Título de tarjeta (`h2`) | 17 px | 17 px | 700 | `text-[1.0625rem] font-bold` |
| Título de diálogo/hoja | 18 px | 18 px | 700 | `text-lg font-bold` |
| Cuerpo, inputs, botones, segmentado | **16 px** | **14 px** | 400 / 500 | `text-control` |
| Tabla, ayudas, errores, toasts | 14 px | 14 px | 400 / 500 | `text-sm` |
| Badges, subtítulo de celda (SKU) | 13 px | 13 px | 500 | `text-[0.8125rem]` |
| Metadatos no esenciales (auditoría) | 12 px | 12 px | 400 | `text-xs`. Nunca errores. |

Títulos en 700 (`--heading-weight`): en B dan presencia sin fuente propia. Interlineado 1.5 texto / 1.25 títulos.

---

## 5. Espaciado, densidad, radios, sombras, capas **[Sustituye a v0.1: densidad, radios y sombras]**

**Espaciado**: escala de Tailwind (base 4 px, `p-4` = 16 px), la misma que v0.1 (`--space-*` queda como alias).

| Contexto | Móvil | Escritorio |
|---|---|---|
| Margen de página | 16 px (`p-4`) | 32 px (`md:p-8`) |
| Separación entre bloques | 16 px | 16–20 px |
| Padding de tarjeta | 16 px | 20 × 24 px (`md:px-6 md:py-5`) |
| Separación entre campos | 16 px | 20 px |

**Densidad** (aprobada 2026-11-13). Un solo punto de corte, `md` = 768 px, en `tokens.css`:

| Token | < 768 px | ≥ 768 px | Utilidad |
|---|---|---|---|
| `--control-height` | 44 px | 40 px | `h-control`, `size-control` |
| `--control-height-sm` | 44 px | 32 px | `h-control-sm` (acciones de fila, cerrar toast) |
| `--control-font-size` | 16 px | 14 px | `text-control` |

Por qué: en móvil se mantiene el objetivo táctil y los 16 px que evitan el zoom de iOS; en escritorio caben más filas.
Riesgo: un iPad (≥ 768 px, táctil) recibe 40 px; sigue por encima del mínimo AA (24 px, WCAG 2.5.8).

**Radios** (`--radius` = 12 px): `rounded-sm` 8 px (tags, ítems de menú) · `rounded-md` 10 px (botones, inputs, menús) ·
`rounded-lg` 12 px (toasts, listas internas) · `rounded-xl` 16 px (tarjetas, diálogos, hoja inferior) · `rounded-full` (badges, avatares, chips).
Por qué: más redondo que v0.1 = más cálido; los badges en píldora se distinguen de los botones a simple vista.

**Sombras** (cálidas en claro, `rgb(68 52 34 / …)`; negras en oscuro): `shadow-xs` botones e inputs · `shadow-sm` tarjetas ·
`shadow-md` menús · `shadow-lg` diálogos, hoja inferior y toasts. Por qué: una sombra gris fría sobre arena se ve sucia.

**Capas** (sin cambios): sticky 10 · nav 20 · overlay 40 · modal 50 · toast 60. **Movimiento** (sin cambios): 120–200 ms, 0 con `prefers-reduced-motion`.
**Breakpoints** (sin cambios, = Tailwind): móvil < 768 (`md`) · tablet 768–1023 · escritorio ≥ 1024 (`lg`).

---

## 6. Estados de interacción **[Sustituye a v0.1: foco y deshabilitado]**

| Estado | Regla | Por qué |
|---|---|---|
| **Hover** | Botón principal `primary-hover`; outline/ghost/ítem de menú `accent`; fila de tabla `muted/50`. Solo con `@media (hover: hover)` (en Tailwind v4 `hover:` ya lo hace). | Feedback sin estados «pegados» en táctil. |
| **Foco (botones, enlaces)** | `focus-visible:outline-2 outline-offset-2 outline-ring`. Sobre la barra teal: `outline-sidebar-ring`. **Nunca** el `ring-ring/50` de shadcn (no llega a 3:1). | Visible con teclado y sobre cualquier superficie. |
| **Foco (input, select)** | Borde `ring` + anillo interior de 1 px `ring` (2 px sólidos) + halo `ring/20` de 3 px. | El halo suaviza; los 2 px sólidos cumplen 1.4.11. |
| **Activo / pulsado** | Mismo color que hover, sin desplazamiento. | Confirma el toque. |
| **Seleccionado** | Segmentado: fondo `card` + `shadow-xs` sobre la pista `muted`, texto `foreground` (no seleccionado: `muted-foreground`). | Se lee como «pestaña elegida» sin color de marca. |
| **Deshabilitado** | Botones `opacity-55`, `cursor-not-allowed`, sin sombra. Inputs: fondo `muted`, borde `border`. `disabled` o `aria-disabled="true"` si debe explicarse. | Exento de contraste, pero legible. |
| **Cargando** | El botón conserva el ancho, spinner + texto («Guardando…»), `aria-busy="true"`, deshabilitado. | Evita doble envío con red lenta. |
| **Error** | Borde `destructive` + anillo 1 px, mensaje `text-destructive` 14 px con icono, `aria-invalid` + `aria-describedby`. | Se ve, se lee y se anuncia. |

---

## 7. Componentes base

Componentes de shadcn/ui (base **Base UI**) copiados al repo. Al copiarlos: sustituir los textos fijos en inglés por `t()`
(ADR-004) y revisar foco y bordes (§6). Los nombres de props los fija Forja-Front.

### 7.1 Botón (`Button`) **[Sustituye a v0.1]**

| Variante | Uso | Estilo |
|---|---|---|
| `default` | **Una** acción principal por vista (Nuevo producto, Guardar producto) | `bg-primary text-primary-foreground shadow-xs`, hover `primary-hover` |
| `outline` | Alternativas (Cancelar, Editar en tarjeta, Añadir variantes). Sustituye al `secondary` de v0.1. | `bg-card border-border shadow-xs`, hover `accent` |
| `secondary` | Relleno suave, poco uso | `bg-secondary`, hover `secondary-hover` |
| `ghost` | Terciarias e iconos (⋯, Mostrar contraseña, sol/luna) | Sin fondo; hover `accent` (en la barra teal: `sidebar-accent`) |
| `destructive` | Eliminar/anular, solo dentro de una confirmación | `bg-destructive text-destructive-foreground` |
| `link` | Navegación en línea | `text-primary underline` |

- Tamaños: `default` = `h-control` (44/40 px) · `sm` = `h-control-sm` (44/32 px) · `icon` = `size-control` · `icon-sm` = `size-control-sm`.
- Radio `rounded-md`, padding 16 px (12 px en `sm`), peso 500, ancho automático (crece con el inglés), icono 16 px a la izquierda.
- Botón solo icono: `aria-label` traducido obligatorio.
- El borde del `outline` es decorativo (`border`): el texto identifica el botón (1.4.11 no lo exige) y un borde fuerte competiría con los inputs.
- Orden: escritorio [Secundario] [Principal] a la derecha; móvil a ancho completo, principal arriba.

### 7.2 Input, Label y Field **[Sustituye a v0.1: medidas y foco]**

- Etiqueta visible arriba (`Label`, 14 px, 500) → input → ayuda (`muted-foreground`, 14 px) o error. Nunca placeholder como etiqueta.
- `h-control`, `text-control`, `rounded-md`, borde `input`, fondo `card`, `shadow-xs`. Foco y error según §6.
- «(obligatorio)» / «(opcional)» en texto tras la etiqueta, en `muted-foreground` 400.
- Importes `inputmode="decimal"` con sufijo de moneda; cantidades `inputmode="numeric"`; sufijo de unidad (`kg`) visible.
- Validación con React Hook Form + Zod (sin cambios): al salir del campo y al enviar; al enviar, foco al primer error.

### 7.3 Select **[Sin cambios en el criterio]**

`<select>` nativo con el estilo del input (flecha SVG en `background-image`). El Select de Base UI solo si hace falta búsqueda
(futuro combobox). Por qué: en móvil abre el selector del sistema, es accesible y no pesa.

### 7.4 Tarjeta (`Card`) **[Nuevo]**

`bg-card border border-border rounded-xl shadow-sm`. Cabecera (título 17 px 700 + descripción `muted-foreground` 14 px),
contenido y pie. Padding 16 px en móvil, 20 × 24 px en escritorio. Los formularios se dividen en tarjetas por sección
(Datos del producto, Inventario, Tallas y colores, Estado). Por qué: agrupa sin líneas y deja respirar el fondo arena.

### 7.5 Tabla / listado **[Sustituye a v0.1]**

- **Escritorio (≥ 768 px)**: `<table>` semántica **dentro de una `Card`**. Cabecera 44 px, 14 px 500 `muted-foreground`, divisor `border`.
  Celdas 14 px, padding 12 × 16 px; hover `muted/50`. Números a la derecha con `tabular-nums`. Primera columna: nombre (enlace, 500) + subtítulo 13 px (SKU o badge «N variantes»).
  Última columna: menú «⋯» (§7.8). Pie de tabla: «Mostrando 1–20 de 134» + paginación.
- **Móvil (< 768 px)**: **lista de tarjetas** (`<ul>` + `<li class="card">`), no la tabla con `display: block`.
  Título arriba a la izquierda, badge de estado arriba a la derecha, `dl` de dos columnas (Precio de referencia, Disponible), pie con «Editar» (outline, ancho flexible) + «⋯».
  Por qué: v0.1 dejaba la elección abierta; la lista evita que Safari/VoiceOver pierda la semántica de tabla.
- Barra de filtros: búsqueda con icono (ancho completo en móvil), selects nativos (Tipo, Categoría) y filtro de estado segmentado (§7.7).
- Estados: skeleton de 5 filas/tarjetas (`bg-muted`), vacío (§7.13), error (§7.14), sin resultados («Limpiar filtros»).

### 7.6 Badge **[Sustituye a v0.1]**

Píldora (`rounded-full`), 13 px 500, padding 1 × 8 px, **punto de 6 px** en `currentColor` delante del texto en los de estado. Fondo `-bg`, texto `-fg`.
El texto siempre está: el color es refuerzo.

- **Producto: «Activo» siempre visible** (aprobado 2026-11-13) en la columna Estado de la tabla y arriba a la derecha de la tarjeta móvil:
  `Activo`/`Active` → `success`; `Inactivo`/`Inactive` → `neutral`. Por qué: ver «Activo» confirma el estado en lugar de deducirlo por ausencia.
- «N variantes» y «Tipo: Ropa»: `brand-subtle` sin punto (informativo, no es un estado).
- Variante inactiva dentro del formulario: `neutral` sin punto («Inactiva»).

**Estado del pedido** (mapeo de v0.1, sin cambios salvo `accent` → `transit`)

| Código (API) | Variante | es | en |
|---|---|---|---|
| `PENDING` | `warning` | Pendiente | Pending |
| `CONFIRMED` | `info` | Confirmado | Confirmed |
| `IN_TRANSIT` | `transit` | En camino | In transit |
| `DELIVERED` | `success` | Entregado | Delivered |
| `CANCELLED` | `neutral` | Cancelado | Cancelled |

**Estado del pago**: `UNPAID` `danger` Sin pagar / Unpaid · `PARTIALLY_PAID` `warning` Pago parcial / Partially paid · `PAID` `success` Pagado / Paid.
**Stock**: `Stock bajo`/`Low stock` `warning` · `Sin stock`/`Out of stock` `danger`.

### 7.7 Filtro de estado segmentado **[Nuevo]**

- Base UI **ToggleGroup** de selección única (shadcn `ToggleGroup`), etiqueta visible «Estado» asociada (`aria-labelledby`).
- Opciones: **Activos · Inactivos · Todos**; por defecto **Activos**. Siempre hay una elegida (no se puede deseleccionar).
- Pista `bg-muted rounded-md p-[3px]`; opciones de ancho igual (grid), texto `text-control` 500 `muted-foreground`; seleccionada `bg-card text-foreground shadow-xs` y `aria-pressed="true"`.
- Alto: móvil 44 px por opción y ancho completo; escritorio `h-control` en total (opciones de 34 px), ancho según texto.
- Teclado: flechas entre opciones (foco itinerante de Base UI), Espacio/Intro elige. Foco con `outline-ring`.
- Por qué: tres opciones a la vista = un toque menos que un select y el filtro activo se lee sin abrir nada.

### 7.8 Menú «⋯» de fila (`DropdownMenu` = Base UI Menu) **[Nuevo]**

- Disparador: botón `ghost` `icon-sm` (44 px móvil / 32 px escritorio; en la tarjeta móvil, `outline`), icono `Ellipsis`,
  `aria-label` = `products.actions_for` («Acciones de «{{name}}»», aprobada). `aria-haspopup="menu"` y `aria-expanded` los pone Base UI.
- Panel: `bg-popover border rounded-md shadow-md p-1`, mín. 176 px, alineado al borde final del botón; se voltea hacia arriba si no cabe.
- Ítems: icono 16 px + texto; alto 36 px en escritorio, **44 px y 16 px en móvil**; hover/foco `accent`. Separador `border` entre «Editar» y «Desactivar/Activar».
- «Desactivar» no va en rojo (es reversible); abre un `AlertDialog` de confirmación (§7.10). «Activar» actúa directo y avisa con toast.
- Teclado: Intro/Espacio/↓ abre con foco en el primer ítem, flechas recorren, Esc cierra y devuelve el foco al «⋯», Tab cierra.
- Regla: ≤ 3 acciones cortas → menú (también en móvil). Más acciones o acciones con explicación → hoja inferior (§7.11), como `ActionsSheet` en categorías.

### 7.9 Toast (componente propio, **sin Sonner**) **[Sustituye a v0.1]**

- Implementación: Toast de Base UI o el `toast.tsx` actual reestilado (lo decide el spike: el que no inyecte `<style>`). **Sonner prohibido** (ADR-004).
- Aspecto: `bg-popover border rounded-lg shadow-lg`, padding 8 × 8 × 8 × 16 px, icono 20 px de color de estado (`success-fg`, `destructive`, `info-fg`) + texto 14 px 500 + botón cerrar `ghost icon-sm` con `aria-label` «Cerrar». Sustituye al borde izquierdo de color de v0.1: el icono lleva el estado con menos ruido.
- Posición: escritorio abajo-derecha (16 px de margen, ancho máx. 352 px); móvil abajo-centro **por encima de la barra inferior** (64 px + 16 px), ancho máx. 340 px.
- Éxito/info: se cierran a los 5 s (pausa con hover o foco). Error: no se cierra solo. Máximo 3 apilados (el más nuevo arriba).
- Región `aria-live="polite"` (éxito/info) y `role="alert"` (error). Puede llevar acción («Deshacer»). Entrada 200 ms desde abajo; 0 con *reduced motion*.

### 7.10 Diálogo (`Dialog`, `AlertDialog` de Base UI) **[Sustituye a v0.1]**

- Escritorio: centrado, ancho máx. 30 rem, `rounded-xl`, `shadow-lg`, fondo `overlay`; título 18 px 700, cuerpo 15 px `muted-foreground`, acciones a la derecha [Cancelar] [Acción].
- Móvil: anclado abajo a ancho completo (esquinas superiores `rounded-xl`), acciones apiladas a ancho completo de 44 px, la principal arriba.
- Foco: al abrir, en «Cancelar» si la acción es destructiva o bloquea uso; en el primer campo si pide datos. Esc cierra; al cerrar, foco al botón que lo abrió.
- Texto concreto y verbo en el botón: «¿Desactivar «Arroz blanco»?» → [Desactivar], nunca «Aceptar».
- CSP: Base UI bloquea el scroll del fondo por CSSOM (permitido). `CSPProvider disableStyleElements` en `App.tsx`.

### 7.11 Hoja inferior móvil (`Drawer` de Base UI) **[Nuevo; sustituye a los `<dialog>` de hoja de v0.1]**

- Uso: «Cuenta» / «Más» (nombre, rol, idioma, cambiar contraseña, cerrar sesión, módulos ocasionales) y hojas de acciones largas (categorías). Solo en < 768 px; en escritorio esas opciones viven en la barra lateral.
- Aspecto: sale de abajo, ancho completo (máx. 32 rem centrado), `bg-popover rounded-t-xl shadow-lg`, asa decorativa de 32 × 4 px `bg-border` centrada arriba, alto máx. 85 svh con scroll interno, `padding-bottom: env(safe-area-inset-bottom)`.
- Cabecera: título visible 18 px 700 + botón cerrar `ghost icon` (44 px, `aria-label` «Cerrar»). Filas de 48 px con icono + texto, separadores `border`; «Cerrar sesión» al final, separada.
- Cierre: botón, Esc, toque en el fondo y deslizar hacia abajo. Foco atrapado; al cerrar vuelve al disparador (avatar o «Más»).
- Por qué Drawer: es el componente de Base UI para hojas (gesto de arrastre incluido) y permite retirar el polyfill de `<dialog>` (ADR-004).

### 7.12 Botón de tema sol / luna **[Nuevo, aprobado por la supervisión 2026-11-26]**

**Comportamiento**
- **Primera vez** (sin elección guardada): la app sigue el modo del dispositivo (`prefers-color-scheme`) y lo sigue en vivo si el dispositivo cambia (p. ej. modo noche automático al anochecer).
- **Al pulsar**: alterna claro ↔ oscuro **al instante** (sin transición de colores: en móviles baratos repintar todo con transición va a tirones) y guarda la elección **en ese navegador** (`localStorage`, clave `cuartico.theme` = `light` | `dark`). Desde entonces ya no sigue al dispositivo.
- No es del usuario sino del navegador: no se guarda en el servidor ni se borra al cerrar sesión. Por qué: es una preferencia del equipo físico (pantalla, luz del local), y así funciona también en el login.
- Sin `localStorage` (navegación privada, bloqueado): la elección vale para la sesión en memoria y no falla nada.
- Volver a «como el dispositivo»: no hay opción en v0.2 (fuera de alcance). Si se pidiera, iría en la hoja «Cuenta» como tercera opción.

**Icono**: muestra **el modo al que vas a cambiar**, igual que dice su etiqueta.

| Tema actual | Icono (`lucide-react`) | `aria-label` (y tooltip en ≥ 768 px) |
|---|---|---|
| Claro | **Luna** (`Moon`) | `theme.toggle_to_dark` «Cambiar a modo oscuro» |
| Oscuro | **Sol** (`Sun`) | `theme.toggle_to_light` «Cambiar a modo claro» |

Por qué: el botón es una acción (verbo) y el estado actual ya se ve en la pantalla entera; si icono y etiqueta dijeran cosas distintas, quien ve y quien usa lector de pantalla recibirían mensajes opuestos.

**Dónde va**

| Ancho | Posición | Tamaño | Colores |
|---|---|---|---|
| Móvil (< 768, probado a 360 px) | **Barra superior**, entre la marca y el avatar «Cuenta»: `[logo Cuartico ……… ☾ (DR)]`. A 360 px sobran ~150 px. | 44 × 44 px (`size-control`), icono 20 px | `text-sidebar-foreground` (9.09 / 15.2), hover `sidebar-accent`, foco `outline-sidebar-ring` |
| Tablet (768–1023, barra contraída a 64 px) | Pie de la barra lateral: avatar, debajo el botón de tema, debajo «Cerrar sesión», todos centrados. | 40 × 40 px, icono 20 px | ídem |
| Escritorio (≥ 1024) | Pie de la barra lateral, **a la derecha de la fila del usuario** (avatar · nombre y rol · ☾), encima de «Cerrar sesión». | 40 × 40 px, icono 20 px | ídem |
| Login (todas) | Pie de la tarjeta de acceso, en la misma fila que el selector «Idioma». | 44 × 44 px | `text-foreground`, hover `accent`, foco `outline-ring` |

Por qué ahí: en móvil queda a un toque y siempre visible (meterlo en «Cuenta» serían dos); en escritorio se agrupa con
las preferencias del usuario sin competir con la acción principal de la página; en el login porque la preferencia es del
navegador y quien entra de noche no tiene que deslumbrarse primero.

**Accesibilidad**
- `<button type="button">` con `aria-label` que cambia según §tabla; **sin** `aria-pressed` (un botón conmutador no debe cambiar de nombre, y aquí el nombre es la acción: patrón «botón de acción» de WAI-ARIA APG).
- El foco se queda en el botón tras pulsar. Un `role="status"` oculto anuncia el resultado (`theme.dark_on` / `theme.light_on`) porque no todos los lectores releen la etiqueta nueva del botón enfocado.
- Tooltip (Base UI `Tooltip`, 14 px, `bg-foreground text-background`, aparece con hover y con foco) solo en ≥ 768 px; en móvil no hay hover.
- Foco: `outline-2 outline-offset-2` en `sidebar-ring` (barra teal) o `ring` (login). El icono es `aria-hidden`.

**Sin parpadeo y con CSP** (para Forja-Front)
- Un archivo propio `public/theme-init.js` (≈ 200 bytes), cargado en `<head>` con `<script src="/theme-init.js"></script>` **sin `defer`, antes del CSS**,
  pone `data-theme` si hay elección guardada. Debe ser archivo y no script en línea: la CSP `script-src 'self'` prohíbe los en línea. Sin él, quien eligió el tema contrario al de su móvil vería un destello del otro tema en cada carga.
  ```js
  try { var t = localStorage.getItem("cuartico.theme");
        if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch (e) {}
  ```
- `<meta name="color-scheme" content="light dark">` y `<meta name="theme-color">` con los valores de `--theme-color` (`#134e4a` / `#102624`), uno por `media` de `prefers-color-scheme`; al elegir, el hook de tema actualiza su `content`. Por qué: la barra del navegador móvil (y de la PWA) se funde con la barra superior.

### 7.13 Layout de la aplicación **[Sustituye a v0.1: colores, contraído en tablet y botón de tema]**

```
Escritorio ≥1024px                       Móvil <768px (360 px)
┌───────────────┬────────────────────┐   ┌──────────────────────────┐
│▣ Cuartico     │ Productos  [+ Nuevo]│   │▣ Cuartico         ☾ (DR) │ ← barra superior teal 56px
│▌Inicio        │                    │   ├──────────────────────────┤
│ Productos     │  Contenido         │   │  Contenido               │
│ GESTIÓN       │  (máx. 1280px)     │   │                          │
│ Categorías    │                    │   ├──────────────────────────┤
│───────────────│                    │   │ Inicio  Productos  Más   │ ← barra inferior 64px (card)
│(DR) Daniel  ☾ │                    │   └──────────────────────────┘
│ ⏻ Cerrar sesión│                   │
└───────────────┴────────────────────┘
```
- **Escritorio**: barra lateral `sidebar` de 240 px. Ítem 40 px, 14 px 500, icono `sidebar-muted-foreground`; activo `sidebar-accent` + indicador ámbar de 3 px a la izquierda + `aria-current="page"`. Pie: usuario + botón de tema + «Cerrar sesión».
- **Tablet (768–1023)**: barra contraída a 64 px, solo iconos con tooltip; el pie apila avatar, tema y cerrar sesión.
- **Móvil**: barra superior `sidebar` de 56 px (logo, botón de tema, avatar → hoja «Cuenta») y barra inferior `card` con borde superior: ítems icono + texto 12 px, activo con píldora `brand-subtle` de 56 × 30 px detrás del icono, texto `foreground` 600.
- Navegación móvil (decisión de v0.1, sin cambios): barra inferior + «Más»; Sprint 1–3: Inicio · Productos · Cuenta/Más.
- «Saltar al contenido» como primer enfocable; área segura de iOS en la barra inferior.

### 7.14 Estado vacío, carga y error **[Sin cambios en el criterio; cambia el aspecto]**

- **Vacío**: dentro de una `Card`, centrado: icono lineal 40 px `muted-foreground`, título 16 px 600, frase 14 px y la acción para salir del vacío (botón `outline`).
- **Carga**: skeleton `bg-muted` con la forma de filas/tarjetas (pulso de opacidad, 0 con *reduced motion*). A los 10 s: «Está tardando más de lo normal. Revisa tu conexión.» En acciones: spinner en el botón.
- **Error al cargar**: icono + título + `detail` de la API + [Reintentar]. **Sin conexión / servidor despertando**: `Alert` (`warning-bg` / `info-bg`, `rounded-lg`, icono + título + texto), persistente arriba del contenido.
- **Errores de formulario de la API (400/409)**: al campo si se puede; si no, `Alert` `danger` arriba del formulario.

---

## 8. Accesibilidad (checklist) **[Sustituye a v0.1]**

- [ ] Todo con teclado; orden de tabulación = visual; foco visible con `ring` / `sidebar-ring` (nunca `ring/50`).
- [ ] Contraste AA según §3; ningún color fuera de los tokens. Borde de inputs con `input` (no `border`).
- [ ] Inputs con `<label>`; errores con `aria-invalid` + `aria-describedby`.
- [ ] Botones solo icono (⋯, sol/luna, cerrar) con `aria-label` traducido; textos fijos en inglés de shadcn sustituidos por `t()`.
- [ ] Estados con texto, no solo color («Activo» incluido).
- [ ] Toasts y alertas anunciados; cambio de tema anunciado por `role="status"`.
- [ ] Diálogos, menús y hojas: foco atrapado donde toque, Esc, retorno de foco.
- [ ] Objetivos táctiles ≥ 44 px en < 768 px (incluidos ítems de menú y cerrar toast).
- [ ] `lang` del `<html>` según idioma; `prefers-reduced-motion` respetado; tema inicial = `prefers-color-scheme`.
- [ ] Zoom al 200 % sin pérdida; sin `user-scalable=no`.
- [ ] Cero `<style>` inyectados (test guardarraíl de ADR-004) y cero violaciones CSP en staging.

---

## 9. Textos de interfaz comunes **[Sin cambios]**

La tabla de claves comunes de v0.1 sigue vigente (`common.*`, `nav.*`, `confirm.*`, `validation.*`); los textos por pantalla
están en [`copy.md`](copy.md). Nuevas de v0.2: botón de tema en [copy.md §11](copy.md#11-tema-claro--oscuro-tt-19--aprobado-2026-11-26) (aprobadas el 2026-11-26).

| Clave | es | en |
|---|---|---|
| `common.save` / `common.saving` | Guardar / Guardando… | Save / Saving… |
| `common.cancel` / `common.close` | Cancelar / Cerrar | Cancel / Close |
| `common.delete` / `common.edit` | Eliminar / Editar | Delete / Edit |
| `common.retry` / `common.undo` | Reintentar / Deshacer | Try again / Undo |
| `common.search` / `common.clear_search` | Buscar / Limpiar búsqueda | Search / Clear search |
| `common.more` | Más | More |
| `common.required` / `common.optional` | (obligatorio) / (opcional) | (required) / (optional) |
| `common.loading` | Cargando… | Loading… |
| `common.slow_network` | Está tardando más de lo normal. Revisa tu conexión. | This is taking longer than usual. Check your connection. |
| `common.offline` | Sin conexión. Los cambios no se guardarán hasta que vuelvas a tener internet. | You're offline. Changes won't be saved until you're back online. |
| `common.load_error` | No se pudo cargar la información. | We couldn't load the information. |
| `common.saved` | Cambios guardados | Changes saved |
| `common.skip_to_content` | Saltar al contenido | Skip to content |
| `common.pagination` | Mostrando {{from}}–{{to}} de {{total}} | Showing {{from}}–{{to}} of {{total}} |
| `nav.home` / `nav.orders` / `nav.products` / `nav.combos` | Inicio / Pedidos / Productos / Combos | Home / Orders / Products / Combos |
| `nav.logout` | Cerrar sesión | Log out |
| `confirm.delete_title` | ¿Eliminar «{{name}}»? | Delete "{{name}}"? |
| `confirm.irreversible` | Esta acción no se puede deshacer. | This action can't be undone. |
| `validation.required` | Este campo es obligatorio. | This field is required. |
| `validation.positive` | Debe ser mayor que 0. | Must be greater than 0. |

Tono: tuteo, frases cortas, verbos concretos.

---

## 10. Migración de cuartico-web (para Forja-Front) **[Nuevo]**

- Fase 1 (ADR-004): copiar `tokens.css` v0.2; el CSS antiguo pasa a `@layer legacy` y sigue funcionando gracias a los alias (§6 de `tokens.css`).
  Efecto visible desde el primer día: **las pantallas sin migrar ya toman la paleta B** (arena, teal, foco ámbar) y la densidad de escritorio, sin tocar su CSS.
- Cada pantalla migrada: sin clases `c-*`, sin `var(--color-*)` antiguos, revisión a 360 px y escritorio en claro y oscuro, visto bueno de Lienzo.
- Fase 6: borrar el bloque §6 de `tokens.css` y `global.css`.

## 11. Revisión de los alias v0.1 **[Nuevo]**

Pares de v0.1 que cambian de valor al apuntar a B (todos siguen en AA):

| Alias v0.1 | Ahora | Antes → ahora | Nota |
|---|---|---|---|
| `--color-border-strong` | `input` | 4.76 → **3.54** | ≥ 3:1 (1.4.11). |
| `--color-focus` | `ring` | azul 6.70 → ámbar **5.02** | |
| `--color-text-muted` sobre `--color-surface-muted` | `muted-foreground` sobre `muted` | prohibido en oscuro (4.04) → **6.66 / 6.49** | Deja de estar prohibido. |
| `--color-surface-hover` | `accent` | 7.26 → **6.93 / 6.41** con texto atenuado | |
| `--color-link` / `--color-brand` sobre `--color-brand-subtle` | `primary` sobre `brand-subtle` | 5.2 → **4.86 / 7.77** | Justo en claro: no bajar más. |
| `--color-danger-text` | `destructive` | 6.47 / 7.7 → **6.47 / 5.98** | |
| `--radius-sm/md/lg` | derivados de `--radius` | 4/8/12 → 8/10/12 px | Solo forma. |
| `--control-height(-sm)` | densidad | 44/32 → 44·40 / 44·32 px | Las pantallas antiguas también se compactan en escritorio. |

---

## 12. Preparado para Combazo **[Sustituye a v0.1: nombres nuevos]**

- `[data-brand="combazo"]` sobre el mismo `tokens.css` (bloque reservado §4).
- **Solo remapea**: `--primary*`, `--ring`, `--brand-subtle*`, `--sidebar*`, `--radius` y `--font-family-display`. Estados, neutros, densidad y accesibilidad se heredan: un «Pagado» se ve igual en ambas marcas.
- La identidad de Combazo se propondrá con opciones en la fase 2; cualquier color nuevo pasa la misma verificación AA. Navegadores mínimos de Tailwind v4 para Combazo: se decidirá con datos (ADR-004, decisión 4).

---

## 13. Aprobación de la supervisión (v0.2)

Los cinco puntos fueron aprobados el 2026-11-26.

1. Este documento y `tokens.css` v0.2 como sustitutos de v0.1 (valores = propuesta B aprobada; nombres y estructura nuevos).
2. **Botón sol/luna** (§7.12): icono = modo al que se cambia (luna en claro, sol en oscuro); posiciones (barra superior móvil, pie de la barra lateral, login); sin opción «como el dispositivo» tras elegir; la elección es del navegador, no del usuario, y no se borra al cerrar sesión.
3. Claves de copy del tema ([copy.md §11](copy.md#11-tema-claro--oscuro-tt-19--aprobado-2026-11-26)).
4. Que las pantallas sin migrar tomen ya la paleta B a través de los alias (§10–11), en vez de convivir dos estilos durante la migración.
5. Lista de tarjetas en móvil (no tabla transformada) y menú «⋯» también en móvil para ≤ 3 acciones.

## Historial
| Versión | Fecha | Cambio |
|---|---|---|
| 0.1 | 2026-10-30 | Primera propuesta (Sprint 1) |
| 0.1.1 | 2026-10-30 | Posición de los botones en móvil (§7.1); enlace a `copy.md` (§9) |
| 0.1.2 | 2026-11-05 | Barra inferior móvil del Sprint 1 y cómo crece hasta «Más» (§7.8) |
| 0.2 | 2026-11-25 | TT-19: propuesta B con nombres de shadcn/ui, claro y oscuro, densidad por ancho, badges, segmentado, menú «⋯», toasts propios, Drawer, botón sol/luna, alias v0.1 para la migración |
