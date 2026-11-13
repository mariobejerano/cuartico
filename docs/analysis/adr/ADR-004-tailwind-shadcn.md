# ADR-004: Estilos de cuartico-web: Tailwind CSS + shadcn/ui

- **Estado:** Aceptado (2026-11-13). Decisiones de la supervisión al final.
- **Fecha:** 2026-11-13
- **Relacionado:** [ADR-001](ADR-001-frontend-token-storage.md) (condición 6: CSP estricta), design system de Lienzo (`docs/design/`)

## Contexto
- cuartico-web: Vite 8, React 19, TypeScript 6, React Hook Form + Zod, react-i18next, Vitest + Testing Library (219 tests).
  Unos 40 `.tsx`, ~800 líneas de CSS propio (`styles/tokens.css` + `styles/global.css`), sin librería de UI. Los modales
  usan `<dialog>` nativo (`ConfirmDialog`, `CategoryDialog`, `ActionsSheet`, `AccountSheet`) y hay un `toast.tsx` propio.
- Sitio estático en Render con **CSP** `style-src 'self'; script-src 'self'` sin `'unsafe-inline'`. Un sitio estático
  **no puede generar un nonce por petición**: solo valen archivos propios, hashes fijos o relajar la política.
- Requisitos: aprendizaje de la supervisión, planes gratuitos, bilingüe es/en, móvil a 360 px, y reutilizar el sistema
  visual en combazo-web y en la PWA.

## Opciones
| | Pros | Contras |
|---|---|---|
| **(a)** CSS propio + design system mejorado | Cero dependencias; CSP intacta; se aprende CSS "de verdad" | Accesibilidad de menús, selects y popovers a mano; el CSS crece sin convención; lento de escalar a Combazo |
| **(b)** Tailwind solo | CSS estático generado en build (CSP intacta); tokens en `@theme` compartibles con Combazo; habilidad muy demandada | Sin componentes accesibles: seguimos escribiendo a mano select, menú, combobox; JSX con muchas clases |
| **(c)** Tailwind + shadcn/ui | Componentes accesibles **copiados al repo** (el código es nuestro, se lee y se aprende); sin coste; base Base UI o Radix | Más dependencias; algunos primitivos inyectan `<style>` (ver CSP); el proyecto shadcn cambia cada mes |
| **(d)** Kit completo (MUI, Ant) | Todo hecho (tablas, fechas) | CSS-in-JS en tiempo de ejecución (Emotion, cssinjs) **inyecta `<style>`** y exige nonce o `'unsafe-inline'`: choca de frente con la CSP. Aspecto genérico, difícil de personalizar, bundle pesado. Se descarta |

## Compatibilidad con el stack (verificado 2026-11-13)
- **Tailwind v4** (4.3.x): plugin oficial `@tailwindcss/vite`; **soporte de Vite 8 desde 4.2.2**. Configuración en CSS
  (`@import "tailwindcss"`, `@theme`), sin `tailwind.config.js`. Navegadores mínimos: **Chrome 111, Safari 16.4, Firefox 128**.
- **shadcn/ui** (CLI v4): componentes actualizados a Tailwind v4 y React 19. Desde **julio de 2026 la base por defecto es
  Base UI** (`@base-ui/react`, 1.x estable); Radix sigue soportado (paquete unificado `radix-ui` desde feb-2026).
  Hay Toast propio para Base UI (jul-2026), distinto de Sonner. En sep-2026 `cn` pasó a un paquete aparte (a confirmar en el spike).
- **Dependencias nuevas**: `tailwindcss`, `@tailwindcss/vite`, `@base-ui/react` (o `radix-ui`), `class-variance-authority`,
  `clsx`, `tailwind-merge`, `lucide-react` (sustituiría a `Icon.tsx`), `tw-animate-css`. Alias `@/` → `src/` en `tsconfig` y
  `vite.config.ts` (`@types/node` ya está). React Hook Form + Zod siguen igual (los controles no nativos van con `Controller`).

## CSP: qué rompe y qué no (punto crítico)
`style-src 'self'` bloquea **atributos `style="…"`** (en HTML, `setAttribute('style')`, `style.cssText`) y **elementos
`<style>`** sin nonce/hash. **No** bloquea asignar propiedades vía CSSOM (`el.style.top = …`, `style.setProperty`).
- **Seguro**: React `style={{…}}` en una SPA (React usa CSSOM; sin SSR no hay atributos en el HTML). Tailwind (CSS
  estático en un `.css` del build, `'self'`). El posicionamiento de popovers (Floating UI) y las variables `--x` por
  `style` prop. El *scroll lock* de **Base UI**: escribe en `html.style`/`body.style` por CSSOM.
- **Rompe con Radix**: `Dialog`, `AlertDialog`, `Sheet`/`Drawer`, `DropdownMenu`/`ContextMenu`/`Menubar` modales,
  `Popover` modal y `Select` usan `react-remove-scroll`, que crea un `<style>` con el ancho de la barra en px (**dinámico,
  no se puede fijar por hash**). Efecto: violación de CSP en consola y el fondo **no** se bloquea al abrir el modal (lo
  demás funciona). `SelectViewport` y `ScrollArea` inyectan además un `<style>` fijo (admite hash o prop `nonce`).
- **Rompe con Base UI (evitable)**: `ScrollArea.Viewport` y `Select.Popup/List` con `alignItemWithTrigger` inyectan un
  `<style>` para ocultar la barra. `CSPProvider disableStyleElements` lo apaga y esas reglas se copian a nuestro CSS.
  Los `<script>` en línea de Base UI son *opt-in* (prehidratación SSR): no aplican a esta SPA.
- **Rompe siempre: Sonner** (2.0.x). Su build ejecuta `__insertCSS` al importarse y crea un `<style>`; importar
  `sonner/dist/styles.css` arregla el aspecto pero no la violación. **No usar Sonner.**
- **Nonce fijo** en la CSP (o `get-nonce`/`setNonce` de Radix con un valor constante) es un nonce público: no protege.
  Relajar a `style-src 'unsafe-inline'` (o `style-src-elem`) abre inyección de CSS (exfiltración por selectores). Ninguna se recomienda.

**Mitigación recomendada (sin tocar la CSP)**: base **Base UI** + `CSPProvider disableStyleElements` en `main.tsx` + reglas de
scrollbar en nuestro CSS; toasts con el Toast de Base UI o el `toast.tsx` actual reestilado (nunca Sonner); prohibir
`dangerouslySetInnerHTML` con `<style>`. Guardarraíles: un test global en `src/test/setup.ts` que falle si tras un render
aparece un `<style>` en el DOM (con `css: false`, cualquiera es inyectado por un componente), y la verificación de Vera en
staging con la consola abierta (cero violaciones CSP) al migrar cada pantalla. Si se eligiera Radix: mantener `<dialog>`
nativo para modales y usar Radix solo para piezas no modales; aun así, peor opción.

## Impacto en tests e i18n
- **Tests**: las consultas por rol y nombre accesible siguen valiendo (Base UI/Radix ponen `role`, `aria-*`); si una
  aserción cambia de rol (p. ej. `<select>` nativo → `combobox` + `option`), se ajusta el test, no el criterio. Los
  portales se montan en `document.body`, que `screen` ya cubre. jsdom carece de `ResizeObserver`, `scrollIntoView`,
  *pointer capture* y `getAnimations`: polyfills en `setup.ts` (se confirman en el spike). `css: false` se mantiene. El
  polyfill de `<dialog>` se retira cuando no quede ningún `<dialog>` nativo. Objetivo: los 219 tests pasan en cada fase.
- **i18n**: shadcn trae textos fijos en inglés (`sr-only` "Close", "Previous/Next", "Toggle Sidebar"…). Al copiar cada
  componente se sustituyen por `t()` y claves en los JSON es/en. Usar utilidades lógicas (`ms-*`, `me-*`, `text-start`)
  y no fijar anchos: el inglés y el español difieren en longitud.

## Plan de migración incremental
Rama `feature/` por fase, cada una con PR propio y la app siempre desplegable.

| Fase | Contenido | Esfuerzo |
|---|---|---|
| 0. Spike | Tailwind + alias + `components.json` (Base UI) + `CSPProvider`; migrar Button y un Dialog; build y **prueba en staging con la CSP real**; test guardarraíl de `<style>` | S |
| 1. Base | `tokens.css` → `@theme` (mismos nombres de variable, Lienzo valida); CSS actual en `@layer legacy`; primitivas: Button, Input, Label, Field, Card, Badge, Alert | M |
| 2. Shell | `AppLayout`, `AccountPanel`, `AccountSheet` (→ Drawer), avisos (`ServerWaking`, `Offline`), toasts | M |
| 3. Acceso | Login, `SessionScreens`, páginas 403/404 | S |
| 4. Productos | Listado, formulario, variantes (la pantalla más grande) | L |
| 5. Categorías | Árbol, `CategoryDialog`, `ActionsSheet` | M |
| 6. Limpieza | Borrar `global.css` y el `@layer legacy`, activar Preflight completo, retirar polyfill de `<dialog>` | S |

- **Convivencia**: Tailwind v4 usa *cascade layers*; el CSS sin capa gana a cualquier utilidad. Por eso el CSS actual se
  importa como `@import "./global.css" layer(legacy)` antes de `utilities`, y Preflight (el reset) se activa al final
  (o se revisa pantalla a pantalla) para no alterar las pantallas aún no migradas.
- **Terminado por pantalla**: sin clases del CSS antiguo; tests verdes; revisión a 360 px y escritorio; es/en sin
  textos fijos; cero violaciones CSP en staging; visto bueno de Lienzo. Fases 2–5 pueden ir dentro de historias de negocio
  o como tarea técnica; recomiendo tarea técnica propia (TT) para no mezclar diffs.
- **Esfuerzo total**: del orden de un sprint (S ≈ 1 día, M ≈ 2–3, L ≈ 4–5). La fase 0 decide si se continúa.

## Riesgos
- **Navegadores antiguos**: Tailwind v4 no funciona bien por debajo de Chrome 111 / Safari 16.4. En el back-office (pocos
  operadores) es controlable; en Combazo público (Android viejos en Cuba) habrá que medirlo antes de la fase 2 de Combazo.
- **Ritmo de shadcn**: cambia cada mes. Mitigación: el código está copiado en el repo, solo se actualiza a propósito.
- **CSP por actualizaciones**: una versión nueva de Base UI puede añadir un `<style>`; lo detecta el test guardarraíl.
- **Curva de aprendizaje**: Tailwind cambia la forma de escribir estilos; Forja-Front lo explica en modo mentor.

## Recomendación
**Opción (c) con base Base UI**, sin tocar la CSP, empezando por el **spike de la fase 0** como tarea técnica. (b) es la
alternativa si la supervisión prefiere menos dependencias; (a) y (d) se descartan.

## Decisiones de la supervisión (2026-11-13)
1. Se aprueba la opción (c): **Tailwind CSS + shadcn/ui**.
2. Base **Base UI** (no Radix).
3. La **CSP no se relaja** (sin `'unsafe-inline'`, sin nonce fijo). Se descarta Sonner: los avisos van con un componente propio.
4. Se aceptan los navegadores mínimos de Tailwind v4 (Chrome 111 / Safari 16.4) **para Cuartico**. Para Combazo se decidirá con datos.
5. La migración es una **tarea técnica propia** (TT-19) en el Sprint 3, antes de añadir más pantallas.
6. Aspecto: **propuesta B** de Lienzo ([redesign-proposals.md](../../design/redesign-proposals.md)), con tema claro y oscuro.

## Fuentes
[Tailwind: Vite 8 en 4.2.2](https://github.com/tailwindlabs/tailwindcss/discussions/19624) ·
[Tailwind: compatibilidad](https://tailwindcss.com/docs/compatibility) ·
[shadcn: changelog](https://ui.shadcn.com/docs/changelog) · [shadcn: Base UI por defecto](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) ·
[shadcn: Vite](https://ui.shadcn.com/docs/installation/vite) · [Base UI: CSPProvider](https://base-ui.com/react/utils/csp-provider) ·
[MDN: style-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src) ·
[react-style-singleton](https://github.com/theKashey/react-style-singleton) · [Radix Select (código)](https://github.com/radix-ui/primitives/blob/main/packages/react/select/src/select.tsx) ·
[Sonner #394](https://github.com/emilkowalski/sonner/issues/394)
