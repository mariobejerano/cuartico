# Frontend: desarrollo

Responsable: Forja-Front. **Estado:** `cuartico-web/` creado (TT-08) con el login, la sesión y el layout del panel (HU-01).
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

> **TypeScript 6, no 7:** la plantilla de Vite trae TypeScript 7, pero `typescript-eslint` todavía solo admite
> `< 6.1`. Como se pidió ESLint, fijamos `typescript ~6.0.3`. Cuando `typescript-eslint` admita la 7, se sube.

Sin librerías de componentes (MUI, etc.): los estilos salen de los tokens de Lienzo. Bundle actual: ~170 KB gzip en total.

## Cómo arrancar

Requisitos: Node 24 y npm 12. El backend en local escucha en `http://localhost:8080` y su CORS ya admite `http://localhost:5173`.

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
| `npm run preview` | Sirve `dist/` en local para probar el build |

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
├── public/                 Se copia tal cual a dist/ (favicon, manifest, iconos)
├── vite.config.ts          Build y configuración de Vitest
├── eslint.config.js
└── src/
    ├── main.tsx            Punto de entrada (como el main de Spring Boot)
    ├── app/                App (providers), tabla de rutas y "wiring" (conexión entre piezas)
    ├── config/env.ts       Lectura de VITE_* (un único sitio)
    ├── api/                SIN React: cliente HTTP, errores, tipos de la API, endpoints
    ├── auth/               Sesión (sin React) + hooks y guardas de rutas (con React)
    ├── i18n/               i18next y locales/es.json, en.json
    ├── components/         Piezas de UI reutilizables (Alert, Icon, LanguageSwitch…)
    ├── layout/             Esqueleto del panel: barra lateral, barra inferior, hoja de cuenta
    ├── features/login/     La pantalla de login y su esquema de validación
    ├── pages/              Páginas simples (Inicio, Productos-placeholder, 404)
    ├── styles/             tokens.css (copia de docs/design) y global.css
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
- **Estilos**: solo variables de `tokens.css`; clases del design system (`c-btn`, `c-input`, `c-alert`…) en `global.css`.
  `src/styles/tokens.css` es una **copia** de `docs/design/tokens.css`: si Lienzo lo cambia, se vuelve a copiar.
- **Componentes**: funciones en PascalCase, un componente principal por archivo. Las páginas cargadas con `lazy()` se
  exportan con `export default`.
- **Accesibilidad**: `label` en cada campo, `aria-invalid` + `aria-describedby` en errores, `role="alert"`/`"status"`
  en avisos, objetivos táctiles ≥ 44 px.
- **Prohibido** `dangerouslySetInnerHTML` (regla de ESLint, ADR-001) y `console.log` (tokens jamás en consola).
- **Tests**: junto al código (`*.test.ts(x)`). Se usa la API falsa de `src/test/fakeApi.ts` (equivale a MockMvc al revés:
  simula al servidor). Se busca por rol y texto visible, como lo haría el usuario.

## Sesión y tokens (HU-01, ADR-001)

| Pieza | Responsabilidad |
|---|---|
| `api/client.ts` | `fetch` con base URL, `Accept-Language`, `Authorization`; aviso a los 5 s y corte a los 90 s; 502/503/504 = error de red; ProblemDetail → `ApiError`; ante 401 renueva **una vez** y repite **una vez** |
| `auth/tokens.ts` | Access en memoria; refresh en `localStorage` (`cuartico.refreshToken`) |
| `auth/lock.ts` | `navigator.locks.request('cuartico-refresh')`; si no existe, cola en memoria (solo misma pestaña) |
| `auth/session.ts` | Estado (`loading`/`unreachable`/`authenticated`/`anonymous`), arranque, login, renovación *single-flight*, logout, evento `storage` |
| `auth/guards.tsx` | `RequireAuth`, `GuestOnly`, `RequireRole` |
| `auth/redirect.ts` | Validación de la ruta de retorno (`?redirect=`) |

