# Rediseño del panel con Tailwind + shadcn/ui: propuestas A y B

> Lienzo · 2026-11-13 · **Estado: propuesta, pendiente de aprobación de la supervisión.** Prototipo: [`prototypes/redesign-proposals.html`](prototypes/redesign-proposals.html)
> (conmutadores de propuesta A/B, tema claro/oscuro, pantalla y ancho escritorio/360 px; funciona sin red). Textos: los de [`copy.md`](copy.md).

## 1. Qué cambia respecto al diseño actual (v0.1)
- **Tokens con nombres de shadcn** (`background`, `foreground`, `primary`, `muted`, `border`, `input`, `ring`, `--radius`…) en lugar de `--color-action-primary-bg`: el paso a Tailwind es copiar los valores a `globals.css`. Los badges de estado (success/neutral/warning…) se conservan como extensión.
- **Superficies**: tarjetas con radio 10–16 px, borde fino y sombra muy suave; las tablas viven dentro de una tarjeta. Menos peso visual que hoy.
- **Densidad en escritorio**: controles de 40 px y texto de 14 px (≥ 768 px), como shadcn. **En móvil se mantienen 44 px y 16 px** (objetivo táctil y sin zoom de iOS).
- **Filtro de estado** como grupo segmentado (Activos · Inactivos · Todos) en vez de select: un toque menos. **Acciones de fila** en un menú «⋯» (DropdownMenu).
- **Estado «Activo» visible** con badge (antes solo se marcaba «Inactivo»): ya figura en el design system §7.5.
- **Accesibilidad que shadcn no trae por defecto y mantenemos**: borde de input ≥ 3:1 (shadcn usa ~1,3:1), anillo de foco sólido ≥ 3:1 (shadcn usa `ring/50`), `<select>` nativo y `<dialog>` como hoja inferior en móvil.
- Sigue con fuentes del sistema y sin imágenes: el peso extra real es Radix + Tailwind compilado (estimado 25–40 KB gzip, a medir en el PR).

## 2. Tokens (claro / oscuro; contraste AA verificado, detalle en el `<style>` del prototipo)
| Token | A · claro | A · oscuro | B · claro | B · oscuro |
|---|---|---|---|---|
| `background` | `#ffffff` | `#09090b` | `#faf8f5` (arena) | `#171412` |
| `card` / `foreground` | `#fff` / `#09090b` 19.9 | `#111113` / `#fafafa` 18.1 | `#fff` / `#1c1917` 17.5 | `#221e1b` / `#f5f0e8` 14.6 |
| `primary` / `-foreground` | `#18181b` / `#fafafa` 17.0 | `#fafafa` / `#18181b` 17.0 | `#0f766e` / `#fff` 5.47 | `#2dd4bf` / `#042f2e` 7.77 |
| `muted` / `muted-foreground` | `#f4f4f5` / `#65656e` 5.21 | `#27272a` / `#a1a1aa` 5.81 | `#f3efe9` / `#57534e` 6.66 | `#2e2925` / `#b5ada3` 6.49 |
| `border` (decorativo) | `#e4e4e7` | `#27272a` | `#e7e1d8` | `#38322c` |
| `input` (borde de campo) | `#8e8e96` 3.25 | `#71717a` 3.90 | `#8f877d` 3.54 | `#7a7269` 3.50 |
| `ring` (foco) | `#0f766e` 5.47 | `#2dd4bf` 10.1 | `#b45309` ámbar 5.02 | `#fcd34d` 11.5 |
| `sidebar` / texto | `#fafafa` / `#09090b` | `#111113` / `#fafafa` | `#134e4a` teal / `#f0fdfa` 9.09 | `#102624` / `#f0fdfa` 15.2 |
| `destructive` | `#b91c1c` 6.47 | `#f87171` 5.84 | `#b91c1c` 6.47 | `#f87171` 5.84 |
| `--radius` · badges | 10 px · rectos (6 px) | igual | 12 px · píldora | igual |
| Sombras | neutras, `rgb(0 0 0 / .05–.1)` | | cálidas, `rgb(68 52 34 / .06–.16)` | |
Badges: Activo `#dcfce7`/`#166534` 6.49 (oscuro `#052e16`/`#86efac` 10.6); Inactivo A `#f4f4f5`/`#3f3f46` 9.5 · B `#efe9e1`/`#44403c` 8.5.
«N variantes»: A badge de contorno; B `#ccfbf1`/`#115e59` 6.73. Por qué el foco de B es ámbar: el botón principal es teal y un anillo teal no se distinguiría.

## 3. Componentes de shadcn/ui por pantalla
| Pantalla | Componentes |
|---|---|
| Login | `Card`, `Label`, `Input` (+ `Button` ghost «Mostrar»), `Button`, `Form` (react-hook-form + zod para «Escribe tu usuario.»), `<select>` nativo de idioma |
| Layout | `Sidebar` (escritorio, contraído a iconos 768–1023 px), barra inferior propia (shadcn no la trae), `Avatar`, `Sheet` para «Cuenta»/«Más» |
| Listado | `Table`, `Card` (tarjetas a < 768 px), `Input` con icono, `ToggleGroup` (estado), `<select>` nativo (tipo, categoría), `Badge`, `DropdownMenu` (Editar/Desactivar), `AlertDialog` (desactivar), `Sonner` (toasts), `Skeleton` (carga), `Pagination` |
| Formulario | `Form` + `FormField`/`FormMessage`, `Input`, `<select>` nativo, `Checkbox`, `Card` (secciones), `Badge` (Inactiva, Tipo), `Button`, `AlertDialog` (descartar, convertir), `Sonner`; generador con chips propios sobre `Badge` + `Button` |
Select de Radix solo si hace falta búsqueda (futuro `Combobox` = `Popover` + `Command`); en móvil, el nativo es mejor y no pesa.

## 4. Diferencias A / B en una frase
- **A · Sobria**: shadcn por defecto (zinc), botón principal casi negro, teal solo en el logo, los enlaces y el foco. Neutra, muy legible, «aspecto de herramienta».
- **B · Cuartico**: botón principal teal (el color de marca aprobado el 2026-11-05), barra lateral y barra superior móvil en teal oscuro con indicador ámbar, fondo arena cálido, badges en píldora, cifras de stock sobre fondos suaves. Reconocible y cálida sin perder sobriedad.

## 5. Recomendación: **B**
1. **Conserva la identidad aprobada** (teal `#0f766e`): A la reduce a un detalle y el panel pasa a parecerse a cualquier plantilla de shadcn.
2. **Se orienta mejor**: la barra teal fija «dónde estoy» y el botón principal teal es la única mancha de color de cada vista (principio 5 del design system: el color es para acción y estado).
3. **AA en todos los pares** (mínimo 3.34:1 en bordes de campo, 5.02:1 en texto/foco) y mismo coste en KB que A: solo cambian valores de tokens.
4. **Prepara Combazo**: el mismo esquema (`primary` + `sidebar` + `--radius`) se remapea para la tienda.
Riesgo de B: el fondo arena puede parecer «amarillento» en pantallas baratas; si pasa, se usa `#f8fafc` y se mantiene el resto.

## 6. Decisiones de la supervisión (2026-11-13)
1. **Propuesta B**, con fondo arena (si amarillea en pantallas baratas, se cambia por `#f8fafc`).
2. **Tema claro y oscuro** con un botón de icono **sol / luna**. La primera vez sigue el modo del dispositivo; al pulsar el botón,
   se recuerda la elección en ese navegador. Los textos accesibles del botón (es/en) se proponen y aprueban en TT-19.
3. Densidad de 40 px / 14 px solo en escritorio (en móvil no cambia): aprobada.
4. Badge «Activo» siempre visible en el listado y filtro de estado segmentado: aprobados.
5. Clave nueva `products.actions_for` aprobada (en `copy.md`).
6. Siguiente paso (TT-19, Sprint 3): actualizar `design-system.md` y `tokens.css` a v0.2 y migrar `cuartico-web` a
   Tailwind + shadcn/ui según [ADR-004](../analysis/adr/ADR-004-tailwind-shadcn.md).
