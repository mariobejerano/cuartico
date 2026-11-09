# Diseño (Lienzo)

Responsable: Lienzo (diseñador web y de marca).

| Archivo / carpeta | Qué es | Estado |
|---|---|---|
| [`design-system.md`](design-system.md) | Design system de Cuartico: principios, paleta con contraste AA verificado (claro y oscuro), tipografía, espaciado, radios, sombras, estados y componentes base. | v0.1.2 · **Aprobado (2026-11-05)** |
| [`tokens.css`](tokens.css) | Tokens como CSS custom properties (capa base + capa semántica, temas claro/oscuro, hueco reservado para la marca Combazo). Forja-Front lo copia a `cuartico-web` y lo importa en `main.tsx`. | v0.1 · **Aprobado (2026-11-05)** |
| [`prototypes/`](prototypes/) | Prototipos HTML, aprobados por la supervisión antes de implementarlos. | — |
| [`prototypes/design-system.html`](prototypes/design-system.html) | Muestrario navegable de todos los componentes (usa `../tokens.css`; ábrelo en el navegador y cambia el ancho de la ventana para ver móvil/tablet/escritorio). | v0.1 |
| [`prototypes/login.html`](prototypes/login.html) | Login (HU-01): es/en, validación, credenciales inválidas, «servidor despertando» a los 5 s, error de red, comprobación de sesión. | Sprint 1 · **Aprobado (2026-11-05)** |
| [`prototypes/products.html`](prototypes/products.html) | Layout del panel (HU-01) + productos (HU-02): listado con búsqueda, filtros, paginación, tabla/tarjetas, estados vacío/carga/error; formulario de alta/edición; desactivar solo ADMIN. Moneda por defecto USD; etiquetas de stock ocultas hasta HU-04. | Sprint 1 · **Aprobado (2026-11-05)** |
| [`prototypes/categories.html`](prototypes/categories.html) | Categorías (HU-15, solo ADMIN): árbol con las 4 raíces y su tipo, crear (raíz o subcategoría, máx. 3 niveles), renombrar es/en, activar/desactivar con bloqueos explicados, duplicados en el campo, pantalla «Sin acceso» para OPERATOR, móvil con hoja de acciones. | Sprint 2 · **Aprobado (2026-11-09)** |
| [`prototypes/products-v2.html`](prototypes/products-v2.html) | Productos con categoría jerárquica, tipo derivado y atributos (marca, modelo, garantía, unidad fija) (HU-15) y variantes (HU-16): generador talla × color, lista de variantes con edición por fila, stock agregado, conversión simple ↔ con variantes. Sustituye a `products.html` como referencia de productos. | Sprint 2 · **Aprobado (2026-11-09)** |
| [`ux-notes/`](ux-notes/) | Notas de UX por pantalla: flujo, decisiones justificadas, estados, accesibilidad y puntos abiertos ([login](ux-notes/login.md), [productos](ux-notes/products.md), [categorías](ux-notes/categories.md), [productos v2](ux-notes/products-v2.md)). Las de Sprint 2 incluyen notas para Faro. | Sprints 1 y 2 · categorías y productos v2 **Aprobado (2026-11-09)** |
| [`copy.md`](copy.md) | Textos de interfaz es/en por pantalla (claves para react-i18next) y redacción propuesta para los mensajes de error nuevos de la API. | §1–7 **Aprobado (2026-11-07)** · §8–10 (Sprint 2) **Aprobado (2026-11-09)** |

**Cómo ver los prototipos**: abre el `.html` en el navegador desde `docs/design/prototypes/` (necesita `../tokens.css`).
Cambia el ancho de la ventana para ver móvil (< 768 px), tablet y escritorio (≥ 1024 px). El botón **⚙ Prototipo**
(borde discontinuo magenta, no forma parte del diseño) permite elegir rol (ADMIN/OPERATOR), respuestas simuladas de la API, sin conexión, tema y previsualizar las etiquetas de stock de HU-04.
El login lleva a `products.html` con el rol elegido. `categories.html` y `products-v2.html` se enlazan entre sí (menú lateral y hoja «Más»)
y comparten el rol elegido en ⚙.

Reglas que ya aplican:

- Marca: **Cuartico** es la herramienta interna; **Combazo** es la marca de cara al cliente (ver [README](../../README.md)).
  Combazo reutilizará `tokens.css` remapeando solo los tokens de marca (`[data-brand="combazo"]`).
- Los componentes usan **solo tokens semánticos** (`--color-*`, `--space-*`…), nunca los `--base-*` ni colores sueltos.
- La web es bilingüe (es/en): los textos de interfaz se entregan en los dos idiomas (ver §9 del design system).
- Usuarios en Cuba con datos móviles caros e inestables: diseño ligero (fuentes del sistema, iconos SVG en línea, sin librerías de UI), pensado primero para el móvil.
- Las apps Android son la fase 4; no hay diseño de ellas todavía.
- Cada prototipo lo aprueba la supervisión antes de pasar a implementación (ver el flujo en [CLAUDE.md](../../CLAUDE.md#el-equipo)).
