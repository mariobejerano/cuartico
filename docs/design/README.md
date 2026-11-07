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
| [`ux-notes/`](ux-notes/) | Notas de UX por pantalla: flujo, decisiones justificadas, estados, accesibilidad y puntos abiertos ([login](ux-notes/login.md), [productos](ux-notes/products.md)). | Sprint 1 |
| [`copy.md`](copy.md) | Textos de interfaz es/en por pantalla (claves para react-i18next) y redacción propuesta para los mensajes de error nuevos de la API. | Sprint 1 · **Aprobado (2026-11-07)** |

**Cómo ver los prototipos**: abre el `.html` en el navegador desde `docs/design/prototypes/` (necesita `../tokens.css`).
Cambia el ancho de la ventana para ver móvil (< 768 px), tablet y escritorio (≥ 1024 px). El botón **⚙ Prototipo**
(borde discontinuo magenta, no forma parte del diseño) permite elegir rol (ADMIN/OPERATOR), respuestas simuladas de la API, sin conexión, tema y previsualizar las etiquetas de stock de HU-04.
El login lleva a `products.html` con el rol elegido.

Reglas que ya aplican:

- Marca: **Cuartico** es la herramienta interna; **Combazo** es la marca de cara al cliente (ver [README](../../README.md)).
  Combazo reutilizará `tokens.css` remapeando solo los tokens de marca (`[data-brand="combazo"]`).
- Los componentes usan **solo tokens semánticos** (`--color-*`, `--space-*`…), nunca los `--base-*` ni colores sueltos.
- La web es bilingüe (es/en): los textos de interfaz se entregan en los dos idiomas (ver §9 del design system).
- Usuarios en Cuba con datos móviles caros e inestables: diseño ligero (fuentes del sistema, iconos SVG en línea, sin librerías de UI), pensado primero para el móvil.
- Las apps Android son la fase 4; no hay diseño de ellas todavía.
- Cada prototipo lo aprueba la supervisión antes de pasar a implementación (ver el flujo en [CLAUDE.md](../../CLAUDE.md#el-equipo)).
