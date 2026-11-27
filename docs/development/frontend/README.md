# Frontend: desarrollo

Responsable: Forja-Front. **Estado:** `cuartico-web/` creado (TT-08) con el login, la sesión y el layout del panel (HU-01), el catálogo de productos (HU-02) y las categorías con atributos por tipo (HU-15, Sprint 2).
`combazo-web/` llegará en la fase 2.

| Documento | Para qué |
|---|---|
| Este README | Cómo arrancar, estructura y convenciones |
| [Guía de aprendizaje](learning/README.md) | Los conceptos de React que usa el proyecto, explicados desde Java/Spring |

## Stack

| Pieza | Para qué | Equivalente en el backend |
|---|---|---|
| React 19 + TypeScript 6 | Componentes de interfaz con tipos | Clases Java con tipos |
| Vite 8 | Servidor de desarrollo y build | Maven + `spring-boot:run` |
| React Router 8 | Qué pantalla se ve en cada URL | `@GetMapping` |
| TanStack Query 5 | Llamadas a la API con estado (cargando, error) y caché | — (cliente + caché) |
| React Hook Form + Zod 4 | Formularios y validación | DTO + Bean Validation |
| react-i18next | Textos en es/en | `MessageSource` + `messages_*.properties` |
| Vitest + Testing Library | Tests de componentes y flujos | JUnit + MockMvc |
| ESLint (typescript-eslint, react-hooks) | Reglas de estilo y de errores | Checkstyle / SpotBugs |
| Tailwind CSS 4.3 (`@tailwindcss/vite`) | Clases de estilo generadas en el build a un `.css` estático | — (procesador en compilación) |
| shadcn/ui (estilo `base-nova`) sobre Base UI 1.9 | Componentes accesibles copiados en `src/components/ui/` | Código generado (Initializr) que es nuestro |
| `class-variance-authority` + `cn` | Variantes de componentes y unión de clases sin conflictos | — |
| `lucide-react` 1.72 (versión fija) | Iconos SVG de los componentes migrados (solo se empaquetan los importados) | — |

> **TypeScript 6, no 7:** la plantilla de Vite trae TypeScript 7, pero `typescript-eslint` todavía solo admite
> `< 6.1`. Como se pidió ESLint, fijamos `typescript ~6.0.3`. Cuando `typescript-eslint` admita la 7, se sube.

Sin kits de componentes con CSS-in-JS (MUI, etc.: chocan con la CSP, ADR-004). Los estilos salen de los tokens de Lienzo.
Migración en curso a Tailwind + shadcn/ui (TT-19, ver «Estilos: Tailwind y shadcn/ui» más abajo).

Bundle (gzip, `vite build`, fase 1 de TT-19): entrada (`index-*.js`) ~123 KB (fase 0: ~120 KB; +3 KB por el tema, los
iconos y el botón), CSS ~11 KB (fase 0: ~9 KB; tokens claro/oscuro). Floating UI va en `LabelTooltip` (~18 KB), que solo se
descarga en ≥ 768 px; el `Dialog` de Base UI en el trozo de `ConfirmDialog` (~12 KB). Antes de TT-19: JS ~211 KB + CSS ~7 KB.
Cada pantalla es un trozo aparte que solo se descarga al visitarla.

## Cómo arrancar

Requisitos: Node 24 y npm 12. El backend en local escucha en `http://localhost:8080` y su CORS admite `http://localhost:5173` (`npm run dev`) y `http://localhost:4173` (`npm run preview`).

```bash
cd backend && ./mvnw spring-boot:run        # en otra terminal: la API (perfil dev, admin en application-dev.yml)
cd cuartico-web
npm install                                  # la primera vez
npm run dev                                  # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm test` | Tests en modo vigilancia; `npm test -- --run` una sola pasada (lo que debe ir al CI) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Comprobación de tipos (`tsc -b`) |
| `npm run build` | Comprueba tipos y genera `dist/` (exige `VITE_API_BASE_URL`) |
| `npm run preview` | Sirve `dist/` en `http://localhost:4173` **con las cabeceras de `render/staging.yaml`** (CSP incluida); `connect-src` apunta al origen de `VITE_API_BASE_URL` (ver abajo) |

**Probar el build con la CSP real y con sesión** (pantallas detrás del login):
```bash
cd backend && ./mvnw spring-boot:run                     # su CORS admite :5173 y :4173 por defecto
cd cuartico-web
VITE_API_BASE_URL=http://localhost:8080 npm run build
VITE_API_BASE_URL=http://localhost:8080 npm run preview  # misma variable: la CSP permite connect-src hacia ella
```
Abre `http://localhost:4173` con la consola abierta: cero violaciones de CSP. El resto de la CSP es idéntica a la de staging.
Contra la API de staging también vale (su `APP_CORS_ORIGINS` admite `http://localhost:4173`). Si el 4173 está ocupado y usas
otro puerto, el CORS no lo admitirá: arranca el backend local con `APP_CORS_ORIGINS=http://localhost:<puerto>`.

### Variables de entorno

| Variable | Ejemplo | Notas |
|---|---|---|
| `VITE_API_BASE_URL` | `https://cuartico-api-staging.onrender.com` | URL de la API **sin** barra final. En `npm run dev` vale `http://localhost:8080` si no se define. **El build falla si falta** (mejor que publicar una web que no habla con nadie). |

Se pone en `.env.local` (no se sube; hay un `.env.example`) o como variable del entorno en Render.
Es pública: acaba dentro del JavaScript. **Nunca** pongas secretos en una variable `VITE_*`.

### Despliegue como sitio estático (Render)

- Build: `npm ci && npm run build` en `cuartico-web/`; publicar `dist/`.
- **Rewrite del SPA**: `/*` → `/index.html` (tipo *rewrite*, no *redirect*). Sin esto, recargar `/products` daría 404:
  las rutas las resuelve React en el navegador, no el servidor. Todos los recursos usan rutas absolutas (`/assets/…`), así
  que funcionan desde cualquier URL.
- Cabeceras recomendadas (ADR-001 §6), para que las configure Timon:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
    connect-src 'self' <VITE_API_BASE_URL>; manifest-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  ```
  `img-src data:` hace falta por la flecha SVG del `<select>`. El ping a `/actuator/health` (`no-cors`) también es `connect-src`.
- CORS del backend: `APP_CORS_ORIGINS` del entorno debe incluir la URL del sitio estático.

### PWA
Solo `manifest.webmanifest` e iconos (`public/icons/`, generados a partir del monograma de Lienzo). **Pendiente:** service
worker (caché offline del *shell*), en una tarea posterior.

## Estructura

```
cuartico-web/
├── index.html              Página única: React se monta en <div id="root">
├── public/                 Se copia tal cual a dist/ (favicon, manifest, iconos, theme-init.js)
├── vite.config.ts          Build y configuración de Vitest
├── eslint.config.js
└── src/
    ├── main.tsx            Punto de entrada (como el main de Spring Boot)
    ├── app/                App, AppProviders (providers comunes a la app y a los tests), tabla de rutas y "wiring"
    ├── config/             env.ts (lectura de VITE_*) y currencies.ts (monedas admitidas, un único sitio)
    ├── api/                SIN React: cliente HTTP, errores, tipos de la API, endpoints
    ├── auth/               Sesión (sin React) + hooks y guardas de rutas (con React)
    ├── i18n/               i18next y locales/es.json, en.json
    ├── components/         Piezas de UI reutilizables (Alert, Icon, ConfirmDialog, toast, OfflineNotice, useMediaQuery…)
    ├── components/ui/      Componentes de shadcn/ui, adaptados: button, dialog, input, label, field, card, badge, alert, tooltip
    ├── theme/              Tema claro/oscuro: theme.ts (SIN React) y useTheme.ts (hook); el botón es components/ThemeToggle.tsx
    ├── lib/utils.ts        `cn()` para unir clases de Tailwind (lo importan los componentes de shadcn)
    ├── layout/             Esqueleto del panel: barra lateral, barra inferior, hoja «Cuenta»/«Más», navItems.ts (menú por rol)
    ├── features/login/     La pantalla de login y su esquema de validación
    ├── features/products/  Catálogo de productos (HU-02, HU-15, HU-16): ver «Productos» y «Variantes» más abajo
    ├── features/categories/ Categorías (HU-15): ver «Categorías» más abajo
    ├── pages/              Páginas simples (Inicio, 404, «No tienes acceso»)
    ├── styles/             index.css (entrada: capas de Tailwind), tokens.css (copia de docs/design) y global.css
    └── test/               Utilidades de test (API falsa, renderApp)
```

**Regla de capas** (pensando en React Native): `api/` y `auth/session.ts`, `auth/tokens.ts`, `auth/lock.ts` no importan
nada de React ni del DOM salvo `localStorage`/`navigator.locks`. Toda la lógica de sesión y de red vive ahí; los
componentes solo pintan y llaman. En React Native se cambiará el almacenamiento y el bloqueo, no la lógica.

## Convenciones

- **Textos**: nunca escritos en un componente. Siempre `t('clave')`; claves en `src/i18n/locales/{es,en}.json`, con los
  textos de [`docs/design/copy.md`](../../design/copy.md). En el estado se guardan **claves** (o el `detail` de la API), no
  textos traducidos, para que cambien al cambiar de idioma.
- **Errores de la API**: se decide por `code`/`kind` de `ApiError`, nunca por el texto. `detail` ya llega traducido.
  `components/errorMessage.ts` convierte un error en el mensaje a mostrar.
- **Tipos de la API**: a mano en `src/api/types.ts` (único sitio) hasta generarlos desde `/v3/api-docs`.
- **Estilos**: solo tokens de `tokens.css` v0.2. Código nuevo o migrado: utilidades de Tailwind con los nombres de
  shadcn (`bg-primary`, `text-muted-foreground`, `border-input`, `h-control`, `rounded-xl`…) y componentes de
  `src/components/ui/`; nunca colores sueltos ni `var(--color-*)` de v0.1. El resto aún usa las clases `c-*` de `global.css`,
  que leen los alias v0.1 (`tokens.css` §6, se borran en la fase 6). Casi nunca hace falta `dark:`: los tokens cambian solos.
  `src/styles/tokens.css` es una **copia** de `docs/design/tokens.css`: si Lienzo lo cambia, se vuelve a copiar.
- **`localStorage`**: cada acceso en `try/catch` (navegación privada o bloqueado) y con un plan B en memoria.
- **Imports**: `@/` es `src/` (alias en `vite.config.ts` y `tsconfig.app.json`); lo usan los componentes de shadcn/ui.
- **Componentes**: funciones en PascalCase, un componente principal por archivo. Las páginas cargadas con `lazy()` se
  exportan con `export default`.
- **Accesibilidad**: `label` en cada campo, `aria-invalid` + `aria-describedby` en errores, `role="alert"`/`"status"`
  en avisos, objetivos táctiles ≥ 44 px.
- **Prohibido** `dangerouslySetInnerHTML` (regla de ESLint, ADR-001) y `console.log` (tokens jamás en consola).
- **Tests**: junto al código (`*.test.ts(x)`). Se usa la API falsa de `src/test/fakeApi.ts` (equivale a MockMvc al revés:
  simula al servidor). Se busca por rol y texto visible, como lo haría el usuario.

## Estilos: Tailwind y shadcn/ui (TT-19, ADR-004)

Migración por fases (plan en ADR-004). Estado:
- **Fase 0 (spike) hecha**: infraestructura + `Button` y `Dialog` migrados, usados por `ConfirmDialog` (los 7 diálogos de
  confirmación de productos, variantes y categorías).
- **Fase 1 (base) hecha**: `tokens.css` v0.2 (propuesta B, claro y oscuro) → `@theme`; toda la app toma ya la paleta nueva
  vía los alias v0.1. Primitivas en `components/ui/`: `Button` (variantes de v0.2: `default`, `outline`, `secondary`, `ghost`,
  `destructive`, `link`; tamaños `default`, `sm`, `icon`, `icon-sm`), `Input`, `Label`, `Field` (+ `FieldDescription`,
  `FieldError`), `Card`, `Badge`, `Alert`, `Tooltip`. **Botón sol/luna** (`components/ThemeToggle.tsx`) en la barra superior
  móvil, el pie de la barra lateral y el login. Las pantallas siguen con `global.css`: se migran en las fases 2–5.

| Pieza | Dónde | Notas |
|---|---|---|
| Plugin de Vite y alias `@/` | `vite.config.ts`, `tsconfig.app.json` | `tailwindcss()` genera un `.css` estático en el build |
| Capas CSS | `src/styles/index.css` | `theme → base → legacy → components → utilities`. `global.css` en `legacy`; `tokens.css` **sin capa** (`@custom-variant` no admite `@layer`; solo declara variables). **Sin Preflight** hasta la fase 6 |
| Tokens → utilidades | `src/styles/tokens.css` §5 | `@theme inline` (`--color-primary: var(--primary)` → `bg-primary`) y `@custom-variant dark` (tema elegido o del dispositivo). `@theme inline` acepta `var()` en `--shadow-*` y `--spacing-*` (confirmado: `shadow-sm`, `h-control`) |
| Configuración de shadcn | `components.json` | Estilo `base-nova` (base Base UI), CSS en `src/styles/index.css`, alias `@/components/ui`, `@/lib/utils` |
| CSP | `app/AppProviders.tsx` (lo usan `App.tsx` y `test/renderApp.tsx`) | `<CSPProvider disableStyleElements>` de `@base-ui/react/csp-provider`: Base UI no crea `<style>`. `AppProviders.test.tsx` falla si se quita |
| Guardarraíl | `test/setup.ts` | Todo test falla si deja un `<style>` en el DOM. Control y casos en `components/ConfirmDialog.test.tsx` |
| Zod sin `eval` | `config/zod.ts` (primer import de `main.tsx` y de `test/setup.ts`) | `z.config({ jitless: true })`: sin esto, Zod prueba `new Function` y Chrome registra una violación `script-src` |
| Tema claro/oscuro | `public/theme-init.js`, `theme/theme.ts`, `theme/useTheme.ts`, `components/ThemeToggle.tsx` | Ver «Tema claro/oscuro» abajo |

### Tema claro/oscuro (design system §7.12)
- **Sin elección**: sigue a `prefers-color-scheme`, también en vivo (los colores los cambia el `@media` de `tokens.css`).
- **Al pulsar**: `<html data-theme="light|dark">` al instante y `localStorage['cuartico.theme']`. Es del navegador: no se borra
  al cerrar sesión. Si `localStorage` falla, vale en memoria. Otra pestaña que elige tema se sigue (evento `storage`).
- **Sin destello**: `public/theme-init.js` (archivo, no en línea: CSP) se carga en `<head>` sin `defer` y pone `data-theme`
  antes de pintar. Las `<meta name="theme-color">` (una por `media`) toman el color del tema elegido (`theme.ts`).
- **Botón**: icono y `aria-label` = modo al que se cambia (luna → «Cambiar a modo oscuro»), sin `aria-pressed`; un
  `role="status"` oculto anuncia «Modo oscuro activado». Tooltip solo en ≥ 768 px, cargado con `lazy()` (`LabelTooltip.tsx`)
  para no meter Floating UI en la primera carga. Posiciones (fase 1, sobre el layout aún v0.1): barra superior móvil entre el
  título y el avatar; ≥ 1024 px a la derecha del nombre en el pie de la barra lateral; 768–1023 px bajo el avatar; login en
  la fila del idioma (la fase 3 lo lleva al pie de la tarjeta). Colores de barra teal (`sidebar-*`): fase 2.

**Cómo se añade un componente de shadcn/ui** (siempre a propósito y revisando lo que llega):
1. `cd cuartico-web && npx shadcn@4.23.0 add <componente> --dry-run` para ver qué archivos y dependencias traería;
   luego sin `--dry-run`. Con `components.json` ya configurado llega a `src/components/ui/<componente>.tsx` sobre Base UI.
   Si pide instalar `lucide-react`, `tw-animate-css` o importar `shadcn/tailwind.css`, decide si hace falta (hoy no los usamos).
2. Adáptalo antes de usarlo:
   - `import { cn } from "cn"` → `import { cn } from '@/lib/utils'`.
   - **Textos fijos en inglés** (`sr-only` «Close», «Previous/Next»…) → `t()` con claves en `es.json`/`en.json`, o quítalos.
   - Colores y tamaños de shadcn (`bg-primary`, `rounded-xl`…) ya son nuestros tokens (fase 1). Revisa lo que v0.2 cambia:
     foco `focus-visible:outline-ring` (nunca `ring-ring/50`), borde de campos `border-input`, alturas `h-control`, iconos
     de `lucide-react` con `aria-hidden`.
   - Utilidades lógicas (`ms-*`, `me-*`, `start-*`) y sin anchos fijos (es/en tienen longitudes distintas).
   - Revisa que no cree `<style>` (el guardarraíl lo detecta) ni use `dangerouslySetInnerHTML`.
3. Tests por rol y nombre accesible; `npm test -- --run`, `npm run lint`, build.
4. Comprueba la CSP en local (ver «Probar el build con la CSP real y con sesión» arriba) y abre el componente con la
   consola abierta: cero violaciones.

Diferencias con el ADR-004 detectadas en la fase 0:
- `cn` ya es un paquete propio (`cn`, de shadcn) que sustituye a `clsx` + `tailwind-merge`: instalamos solo `cn`.
- shadcn trae `tw-animate-css` y `@import "shadcn/tailwind.css"` (este exige el paquete `shadcn`, el CLI, como dependencia):
  no los instalamos; las animaciones usan los atributos de Base UI (`data-starting-style:`) y utilidades de Tailwind.
- `lucide-react` llegó en la fase 1 (sol/luna, icono de error de campo), con versión fija; `Icon.tsx` convive hasta migrar
  las pantallas.
- `Input` usa `<input>` nativo y no el de Base UI: `register()` de React Hook Form funciona sin más y Zod ya valida.
- `cn` no sabe que `size-control` y `size-11` chocan (no conoce nuestros tokens): para cambiar el tamaño de un botón,
  usa otro breakpoint (`md:size-11`) o una variante, no dos clases de `size-*` al mismo nivel.
- El `Dialog` de Base UI solo tiene animación de **entrada**: al cerrar desaparece al momento, como el `<dialog>` nativo.
- En jsdom no hizo falta ningún polyfill nuevo para el Dialog de Base UI.

## Sesión y tokens (HU-01, ADR-001)

| Pieza | Responsabilidad |
|---|---|
| `api/client.ts` | `fetch` con base URL, `Accept-Language`, `Authorization`; aviso a los 5 s y corte a los 90 s; 502/503/504 = error de red; ProblemDetail → `ApiError`; ante 401 renueva **una vez** y repite **una vez** |
| `auth/tokens.ts` | Access en memoria; refresh en `localStorage` (`cuartico.refreshToken`) |
| `auth/lock.ts` | `navigator.locks.request('cuartico-refresh')`; si no existe, cola en memoria (solo misma pestaña) |
| `auth/session.ts` | Estado (`loading`/`unreachable`/`authenticated`/`anonymous`), arranque, login, renovación *single-flight*, logout, evento `storage` |
| `auth/guards.tsx` | `RequireAuth`, `GuestOnly`, `RequireRole` |
| `auth/redirect.ts` | Validación de la ruta de retorno (`?redirect=`) |

## Productos (HU-02)

Rutas: `/products` (listado), `/products/new` y `/products/:id/edit` (formulario único, CA-25). Las dos pantallas se cargan con `lazy()`.

| Archivo (`src/`) | Responsabilidad |
|---|---|
| `api/types.ts` | Tipos del contrato: `ProductResponse`, `StockSummary`, `Create/UpdateProductRequest`, `ProductListParams`, `PageResponse<T>`, `UNITS` |
| `api/products.ts` | Endpoints (`list`, `get`, `create`, `update`, `activate`, `deactivate`). Sin React. `GET /products/categories` ya no existe (HU-15) |
| `features/products/queries.ts` | TanStack Query: claves de caché (`productKeys`), `useProductList`, `useProduct`, `useSaveProduct`, `useSetProductActive` |
| `features/products/listQuery.ts` | Estado del listado en la URL (`?q=&type=&cat=<id>&status=&page=&sort=`) ⇄ parámetros de la API (`type`, `categoryId`). `page` > 1 000 000 → 1 (TT-14). Puro |
| `features/products/productSchema.ts` | Esquema Zod del formulario como **fábrica** (`buildProductFormSchema(typeOf)`: reglas según el tipo), valores iniciales y `toRequest(values, type)` (normaliza como el backend; modelo/garantía `null` fuera de electrodomésticos, unidad `UNIT` en ropa y electrodomésticos) |
| `features/products/typeRules.ts` | Reglas por tipo (CA-16, CA-17) y avisos al cambiar de tipo. Puro |
| `features/products/format.ts` | `Intl`: importes («3,50 USD»), cantidades («12,5 kg»), fechas, coma/punto decimal. Puro |
| `features/products/stockBadge.ts` + `features.ts` | Etiquetas «Sin stock»/«Stock bajo» completas pero **apagadas** con `SHOW_STOCK_BADGES = false` hasta HU-04 |
| `features/products/navigation.ts` | «Volver al listado» con la misma búsqueda, filtros y página (`state.listSearch` en el historial) |
| `features/products/useToggleActive.tsx` | Activar (directo) / desactivar (confirmación con stock + «Deshacer»), compartido por listado y formulario |
| `features/products/ProductsListPage.tsx` | Listado: búsqueda (300 ms), filtros, orden, paginación, tabla (≥ 768 px) o tarjetas, skeleton, vacío, sin resultados, errores |
| `features/products/ProductFormPage.tsx` | Alta/edición: validación, errores del servidor en su campo, conflicto de versión, «¿Descartar los cambios?» (`useBlocker`) |

Decisiones de implementación:
- **Contrato**: HU-02 verificado contra el real de Forja-Back (2026-11-07) y HU-15 (2026-11-10): sin diferencias.
- **Una sola vista por tamaño**: `useMediaQuery('(min-width: 768px)')` pinta la tabla **o** las tarjetas (no ambas ocultando una con CSS): menos DOM y sin duplicados para lectores de pantalla.
- **Caché**: tras guardar se invalida `['products']` (listados, detalle, categorías). Tras activar/desactivar se escribe el detalle con la respuesta y se invalidan solo listados y categorías, para no repintar un formulario abierto.
- **Versión en la edición**: el formulario edita contra la versión que cargó; activar/desactivar desde el formulario actualiza esa versión con la respuesta (no se pierde lo escrito ni se provoca un 409 propio). Un 409 `resource.version_conflict` ofrece «Recargar producto» (se pierde lo escrito, aceptado en Sprint 1).
- **Errores de la API en el formulario**: `product.sku_conflict` → campo SKU; `product.price_currency_mismatch` / `product.currency_unsupported` → campo precio; `validation.failed` → cada `errors.<campo>` en su campo; el resto, alerta arriba (con «Reintentar» si es de red o 5xx).
- **Avisos (toasts)**: `components/toast.tsx`, proveedor en `AppLayout` para que el aviso del formulario siga visible en el listado. Éxito: 5 s, en pausa con ratón o foco; error: no se cierra solo.
- **Sin conexión**: `OfflineNotice` (eventos `online`/`offline`) en la zona de alertas del layout.
- **Claves i18n**: las de `copy.md`, con dos ajustes técnicos: el plural es `products.results_one` / `products.results_other` (formato de plurales de i18next) y se añadieron `products.no_price` («—») y `products.sku` («SKU»). Los mensajes de Zod se guardan como `clave|{"max":120}` y se traducen al pintar.
- **Tests**: `features/products/logic.test.ts` (funciones puras), `ProductsListPage.test.tsx` y `ProductFormPage.test.tsx` (flujos con la API falsa; datos en `test/productFixtures.ts`). Para ver la tabla en un test se simula `matchMedia`.

Pendiente / mejoras futuras: `SHOW_STOCK_BADGES = true` con HU-04; mostrar ambas versiones en un conflicto de edición; tipos generados desde `/v3/api-docs`; monedas desde la API cuando exista `GET /api/v1/config` (hoy `config/currencies.ts` es la única lista del frontend, debe coincidir con `app.currencies.supported`).

### Cambios de HU-15 en productos
- **Formulario**: selector de categoría obligatorio con la ruta completa (activas + la actual si está inactiva, marcada
  «(inactiva)»); debajo «Tipo: …». Marca siempre; Modelo y Garantía (meses, 0–120) solo en electrodomésticos; unidad fija y
  deshabilitada en ropa y electrodomésticos. Al cambiar a otro tipo, aviso ámbar (`role="status"`) si se pierden modelo/garantía
  o cambia la unidad; los valores ocultos se conservan en pantalla pero no se envían. SKU y Stock mínimo pasan a la tarjeta
  «Inventario» (donde HU-16 pondrá «Tiene tallas o colores»).
- **Errores**: `product.category_not_found` / `category.inactive` → campo Categoría («Esta categoría se ha desactivado…») y
  se recargan las categorías; `product.attribute_not_allowed` / `unit_not_allowed` → alerta genérica (la UI no los provoca).
- **Listado**: filtros Tipo y Categoría (todas, inactivas marcadas; con tipo, solo las suyas; si la elegida no es del tipo, se
  quita). Un `cat` de texto (enlaces viejos) o un id inexistente se ignora. Columna «Categoría» desde 1024 px; por debajo la ruta va
  en la línea secundaria (CSS `.col-cat` / `.cat-inline`).
- **TT-14**: `page` absurda → página 1; el formulario de edición no se desmonta si falla un refetch en segundo plano (se
  comprueba `product.data` antes que `isError`); monedas en `config/currencies.ts`.
- **Textos**: `products.sale_price_help` y `api.product.sku_conflict` ya están en su versión de `copy.md` §9 (HU-16).

## Variantes (HU-16)

Talla × color, cada variante con su SKU, umbral y stock; sin precio por variante. Contrato: `docs/development/backend/api.md`
§ «Variantes (HU-16)» (verificado contra el de Forja-Back el 2026-11-11: sin diferencias salvo que el listado **omite**
`variants`, por eso es opcional en `ProductResponse`).

| Archivo (`src/`) | Responsabilidad |
|---|---|
| `api/types.ts`, `api/products.ts` | `VariantResponse`, `VariantRequest`, `UpdateVariantRequest`, `AddVariantsRequest`, `EnableVariantsRequest`; `ProductResponse` con `hasVariants`, `variantCount`, `variants?`; endpoints `addVariants`, `updateVariant`, `activateVariant`/`deactivateVariant`, `enableVariants`/`disableVariants` |
| `features/products/variants.ts` | Lógica pura: normalización (talla en mayúsculas, color recortado), clave de opciones (`Rojo` = `rojo`), aviso de tildes, orden de CA-14, generador (combinaciones, omitir existentes), SKU sugerido `PREFIJO-TALLA-COLOR` (D-2), errores de la API → fila, `mergeVariantData` |
| `features/products/productSchema.ts` | Esquema-fábrica con `mode` (`create`/`edit`): SKU/mínimo del producto solo si es simple; filas del alta (`checkDraftRows`); esquemas de «Añadir variantes» y de la fila en edición; `toRequest` (alta) y `toUpdateRequest` (PUT sin `hasVariants`/`variants`) |
| `features/products/queries.ts` | `useAddVariants`, `useUpdateVariant`, `useSetVariantActive`, `useConvertVariants`: guardan el detalle con la respuesta e invalidan solo los listados |
| `features/products/VariantGenerator.tsx` | Generador: tallas (con habituales XS–XXL) y colores como etiquetas, prefijo de SKU, mínimo común, resumen vivo; Intro nunca envía el formulario |
| `features/products/DraftVariantList.tsx` | Filas por guardar (alta y «Añadir variantes»): una sola marcación, tarjetas en móvil y filas alineadas desde 768 px |
| `features/products/VariantsCard.tsx` | Edición con variantes: total agregado, lista, edición en línea, activar/desactivar con «Deshacer» (solo ADMIN), «Añadir variantes», «Convertir en producto simple» |
| `features/products/VariantEditRow.tsx`, `AddVariantsPanel.tsx`, `ConvertToVariantsCard.tsx` | Fila en edición (su propio `<form>`, Esc cancela, conflicto de versión con «Recargar variante»), panel de alta de variantes (otro `useForm`) y conversión simple → variantes |
| `components/useFocusAfterRender.ts` | Llevar el foco a un elemento tras la siguiente pintada |

Decisiones:
- **Alta**: casilla «Tiene tallas o colores» (marcada sola al elegir Ropa mientras el usuario no la toque). Las filas son un
  `useFieldArray` del formulario del producto; si se desmarca, se conservan pero no se envían.
- **Edición**: las operaciones de variantes se guardan al momento y **no cambian la versión del formulario**
  (`mergeVariantData`, CA-13b). Las conversiones sí: piden guardar antes si hay cambios y recargan el formulario.
- **Errores**: `validation.failed` con `variants[i].campo`, `product.sku_conflict` (fila cuyo SKU aparece en el `detail`) y
  `variant.options_conflict` (fila cuyas opciones aparecen en el `detail`) van a su fila; si no se puede saber, alerta arriba.
  `product.no_variants`/`has_variants`/`has_multiple_variants` y `variant.not_found` (carreras): aviso rojo y recarga.
- **Duplicados por tildes** («Marron»/«Marrón»): aviso no bloqueante en el generador (`variant.similar_color`).
- **Etiquetas de stock** por variante: ocultas con `SHOW_STOCK_BADGES` hasta HU-04, como las del producto.
- **Claves i18n**: las de `copy.md` §9; ajustes técnicos: `gen.preview_one`/`gen.preview_other` (plural de i18next) y la nueva
  `variant.similar_color` (propuesta a Lienzo). `products.sale_price_help` y `api.product.sku_conflict` pasan a su versión nueva.
- **Tests**: `variants.test.ts` (lógica, esquemas, paridad de claves es/en) y `ProductVariants.test.tsx` (flujos).

## Categorías (HU-15)

Ruta `/categories`, solo ADMIN (`RequireRole` con `fallback` → `pages/ForbiddenPage.tsx` para un OPERATOR que llega por
URL). Entrada en la barra lateral debajo de Productos (solo ADMIN) y, en móvil, en la hoja «Más» (sección «Gestión»); para
OPERATOR la pestaña sigue siendo «Cuenta» (D-4).

| Archivo (`src/`) | Responsabilidad |
|---|---|
| `api/categories.ts` | Endpoints (`list`, `get`, `create`, `update`, `activate`, `deactivate`). Sin React |
| `features/categories/tree.ts` | Lógica pura: índice por padre, nombre/ruta por idioma (`nameEn ?? name`), normalización (`nameKey` = `LOWER(TRIM)`, `looseKey` sin tildes para el aviso), duplicados, opciones de padre/filtro/selector, acciones por fila |
| `features/categories/queries.ts` | `categoryKeys`, `useCategories` (una sola lista, todas, 5 min en caché; la comparten árbol, filtro y formulario), mutaciones que actualizan la caché con la respuesta e invalidan categorías **y productos** (las rutas cambian al renombrar) |
| `features/categories/categorySchema.ts` | Esquema-fábrica del diálogo (tipo obligatorio en raíz, duplicado local con el mismo texto que el 409) y cuerpos `POST`/`PUT` (`productType` solo en raíz) |
| `features/categories/CategoriesPage.tsx` | Página: carga/error, «Mostrar inactivas (n)», raíces como tarjetas, «Nueva categoría» (botón o FAB), fila nueva iluminada |
| `features/categories/CategoryNode.tsx` | Nodo **recursivo** del árbol; acciones en la fila (≥ 768 px) o botón «⋯» (móvil) |
| `features/categories/ActionsSheet.tsx` | Hoja de acciones del móvil con notas «Último nivel…» / «Inactiva…» |
| `features/categories/CategoryDialog.tsx` | Crear/renombrar: padre (activas de nivel 1–2), tipo o tipo heredado con candado, nombres es/en, errores en su campo, aviso de tildes, conflicto de versión con «Recargar categoría», aviso de servidor dormido dentro del diálogo |
| `features/categories/useCategoryToggle.tsx` | Desactivar (bloqueo si hay hijas activas, confirmación con «N productos conservan esta categoría» si `productCount` > 0, «Deshacer») y activar (bloqueo si la superior está inactiva) |
| `features/categories/keys.ts` | Claves de caché de categorías (archivo aparte para que `products/queries.ts` las invalide sin import circular): alta, cambio de categoría y activar/desactivar un producto invalidan las categorías y así `productCount` no queda desfasado (test en `features/products/queries.test.tsx`) |

Decisiones: los bloqueos (hijas activas, superior inactiva, padre inválido, duplicado) se detectan en el navegador con el
árbol cargado, pero los 409/400 por carrera se tratan igual (campo o aviso de error) y recargan el árbol. Tests:
`tree.test.ts` (lógica y esquema) y `CategoriesPage.test.tsx` (flujos); navegación y «Sin acceso» en `layout/AppLayout.test.tsx`.

