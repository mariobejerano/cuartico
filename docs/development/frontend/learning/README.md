# Guía de aprendizaje del frontend (para quien viene de Java/Spring)

Responsable: Forja-Front. Cada tema explica **qué es**, **por qué lo usamos** y **dónde está en el código** de `cuartico-web/`.
Se amplía con cada historia. Orden recomendado de lectura: de arriba abajo.

| # | Tema | Sprint |
|---|---|---|
| 1 | [Cómo se sirve una web React](#1-cómo-se-sirve-una-web-react-spa) | 1 |
| 2 | [Componentes y JSX](#2-componentes-y-jsx) | 1 |
| 3 | [Props](#3-props) | 1 |
| 4 | [Estado (`useState`)](#4-estado-usestate) | 1 |
| 5 | [Efectos (`useEffect`)](#5-efectos-useeffect) | 1 |
| 6 | [Hooks personalizados y almacenes externos](#6-hooks-personalizados-y-almacenes-fuera-de-react) | 1 |
| 7 | [Rutas (React Router)](#7-rutas-react-router) | 1 |
| 8 | [Peticiones a la API y TanStack Query](#8-peticiones-a-la-api-y-tanstack-query) | 1 |
| 9 | [Formularios (React Hook Form + Zod)](#9-formularios-react-hook-form--zod) | 1 |
| 10 | [Traducciones (react-i18next)](#10-traducciones-react-i18next) | 1 |
| 11 | [La sesión: tokens, 401 y varias pestañas](#11-la-sesión-tokens-401-y-varias-pestañas) | 1 |
| 12 | [Tests (Vitest + Testing Library)](#12-tests-vitest--testing-library) | 1 |
| 13 | [Build y despliegue](#13-build-y-despliegue) | 1 |
| 14 | [Leer datos con caché (`useQuery`)](#14-leer-datos-con-caché-usequery) | 1 (HU-02) |
| 15 | [Mutaciones e invalidación de la caché](#15-mutaciones-e-invalidación-de-la-caché) | 1 (HU-02) |
| 16 | [Estado en la URL (búsqueda, filtros, página)](#16-estado-en-la-url-búsqueda-filtros-página) | 1 (HU-02) |
| 17 | [Formularios de verdad: validación, errores del servidor y «¿descartar?»](#17-formularios-de-verdad-validación-errores-del-servidor-y-descartar) | 1 (HU-02) |
| 18 | [Contexto: los avisos (toasts)](#18-contexto-los-avisos-toasts) | 1 (HU-02) |
| 19 | [Componentes recursivos: el árbol de categorías](#19-componentes-recursivos-el-árbol-de-categorías) | 2 (HU-15) |
| 20 | [Selects dependientes: un campo decide los demás](#20-selects-dependientes-un-campo-decide-los-demás) | 2 (HU-15) |
| 21 | [Validación que depende del contexto (esquemas "fábrica")](#21-validación-que-depende-del-contexto-esquemas-fábrica) | 2 (HU-15) |
| 22 | [Diálogos que se montan al abrirse](#22-diálogos-que-se-montan-al-abrirse) | 2 (HU-15) |
| 23 | [Permisos en la interfaz: «No tienes acceso»](#23-permisos-en-la-interfaz-no-tienes-acceso) | 2 (HU-15) |

---

## 1. Cómo se sirve una web React (SPA)
**Qué es.** Una *Single Page Application*: el servidor entrega **un solo** `index.html` casi vacío (`<div id="root">`) y
un archivo JavaScript. Ese JavaScript pinta toda la interfaz en el navegador y cambia de "pantalla" sin recargar.

**Analogía.** En Spring MVC con Thymeleaf el servidor genera el HTML de cada página. Aquí el servidor solo sirve archivos
estáticos (como servir `/static`), y el "controller" que decide qué mostrar vive en el navegador.

**Consecuencia práctica.** Si alguien recarga `/products`, el servidor no tiene ese archivo: hay que decirle "para
cualquier ruta, devuelve `index.html`" (el *rewrite* `/* → /index.html` de Render). Luego React lee la URL y pinta Productos.

**En el código.** `index.html` → `src/main.tsx` (el `main` de la app) → `src/app/App.tsx`.

## 2. Componentes y JSX
**Qué es.** Un componente es **una función que devuelve lo que hay que pintar**. Ese "lo que hay que pintar" se escribe en
JSX, una sintaxis parecida a HTML dentro de TypeScript.

```tsx
function Greeting() {
  return <h1>Hola</h1>
}
// se usa como una etiqueta: <Greeting />
```

**Analogía.** Una clase con un único método `render()`; React la llama cada vez que algo cambia y compara el resultado con
lo que ya hay en pantalla para tocar solo lo distinto.

**Diferencias con HTML:** `className` en vez de `class`, `htmlFor` en vez de `for`, y `{expresión}` para meter valores de
TypeScript: `<p>{user.fullName}</p>`. React **escapa** siempre lo que metes entre llaves (por eso no hay XSS por pintar
un nombre); la única puerta trasera es `dangerouslySetInnerHTML`, que tenemos prohibida por ESLint.

**En el código.** `src/components/Alert.tsx` es un componente pequeño; `src/features/login/LoginPage.tsx`, uno grande.

## 3. Props
**Qué es.** Los parámetros de un componente. Llegan como un objeto y **no se modifican** dentro.

```tsx
function Alert({ variant, children }: { variant: 'info' | 'danger'; children: ReactNode }) {
  return <div className={`c-alert c-alert--${variant}`}>{children}</div>
}
<Alert variant="danger">No pudimos conectar</Alert>
```

**Analogía.** Parámetros del constructor de un objeto inmutable (`record`). `children` es "lo que va entre las etiquetas".
Si un padre cambia una prop, React vuelve a llamar al hijo con la nueva: no se "setea" nada.

## 4. Estado (`useState`)
**Qué es.** Datos que un componente **recuerda entre pintadas** y que, al cambiar, provocan que se vuelva a pintar.

```tsx
const [showPassword, setShowPassword] = useState(false)
<button onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
```

**Analogía.** Un campo privado de la clase, pero que **solo** se cambia con su *setter*; el setter además avisa a React de
que hay que repintar. Nunca se asigna directamente (`showPassword = true` no haría nada visible).

**Regla.** Guardar el mínimo: lo que se puede calcular a partir de otra cosa se calcula al pintar (p. ej. `busy` en el login).

## 5. Efectos (`useEffect`)
**Qué es.** Código que se ejecuta **después** de pintar, para hablar con el "mundo exterior" (red, `document.title`, el DOM).

```tsx
useEffect(() => {
  wakeServer()               // al montar la pantalla de login: despertar Render (CA-7)
}, [])                       // [] = solo al montar. Con [x], cada vez que cambie x
```
Si devuelve una función, esa función es la limpieza (al desmontar o antes de repetir).

**Analogía.** Callbacks de ciclo de vida: `@PostConstruct` (al montar) y `@PreDestroy` (la limpieza). La lista de
dependencias dice "vuelve a ejecutarte si cambia alguno de estos valores".

**Ojo.** En desarrollo React (modo `StrictMode`) monta, desmonta y vuelve a montar a propósito, para destapar efectos sin
limpieza. Por eso la sesión arranca con `bootstrapOnce()`.

**En el código.** `AuthProvider.tsx` (arranque de la sesión), `AccountSheet.tsx` (abrir/cerrar el `<dialog>`),
`useDocumentTitle.ts` (título de la pestaña).

## 6. Hooks personalizados y almacenes fuera de React
**Qué es un hook.** Una función que empieza por `use` y que usa otros hooks. Sirve para **reutilizar lógica** entre
componentes. Regla: solo se llaman en el cuerpo del componente, nunca dentro de un `if` o un bucle.

```tsx
export function useDocumentTitle(key: string) {
  const { t } = useTranslation()
  useEffect(() => { document.title = t(key) }, [t, key])
}
// en cualquier página: useDocumentTitle('home.page_title')
```

**Analogía.** Un servicio reutilizable que cada componente "inyecta" llamándolo.

**Almacenes externos.** La sesión (`auth/session.ts`) y el aviso de servidor lento (`api/netStatus.ts`) son **TypeScript
puro**: un estado + una lista de suscriptores (patrón *Observer*). Los componentes se conectan con
`useSyncExternalStore(subscribe, getState)`, que repinta al recibir el aviso. Ventaja: la lógica no depende de React y
la podremos usar tal cual en React Native. Es como tener la lógica en un `@Service` y que el controller solo lo use.

**En el código.** `auth/useSession.ts`, `components/ServerWakingNotice.tsx`.

## 7. Rutas (React Router)
**Qué es.** Una tabla "URL → componente" que se resuelve en el navegador.

```tsx
export const routes = [
  { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
  { element: <RequireAuth />, children: [            // todo lo de dentro exige sesión
      { element: <AppLayout />, children: [            // esqueleto común (barra lateral, inferior…)
          { index: true, element: <HomePage /> },      // "/"
          { path: 'products', element: <ProductsListPage /> },
          { path: '*', element: <NotFoundPage /> },     // 404
      ] },
  ] },
]
```

**Analogías.**
- La tabla de rutas ≈ los `@GetMapping`.
- `RequireAuth` ≈ un filtro de Spring Security que exige estar autenticado; `RequireRole` ≈ `@PreAuthorize` (solo para
  ocultar cosas; la seguridad real es el 403 del backend).
- `<Outlet />` es el hueco donde se pinta la ruta hija (como un `layout:fragment` de Thymeleaf).
- `<Navigate to="/login" />` ≈ `return "redirect:/login"`.

**Carga diferida.** `lazy(() => import('../pages/HomePage'))` hace que el código de esa página se descargue solo al
visitarla: el primer arranque descarga menos (importante con datos móviles caros).

**Ruta de retorno segura (CA-6).** `/login?redirect=/products?q=arroz` vuelve a donde iba, pero `auth/redirect.ts`
**rechaza** cualquier cosa que no sea una ruta interna (`//evil.com`, `https://…`, `javascript:`…). Si no, alguien podría
mandar un enlace de nuestro login que, tras entrar, lleve a una web falsa (redirección abierta).

## 8. Peticiones a la API y TanStack Query
**El cliente (`api/client.ts`).** Envuelve `fetch` (el "RestTemplate" del navegador) y añade lo que toda petición necesita:
URL base, `Accept-Language`, `Authorization`, el aviso a los 5 s, el corte a los 90 s (`AbortController`), y convierte el
ProblemDetail del backend en un `ApiError` con `kind` (`http`, `network`, `session_ended`), `status`, `code` y `detail`.
Las pantallas deciden por `code`, nunca por el texto: igual que en el backend.

**TanStack Query.** Gestiona el **estado** de las llamadas: "cargando", "error", "datos", caché y cancelación. En el login
usamos `useMutation` (para operaciones que cambian algo):

```tsx
const login = useMutation({ mutationFn: (f) => session.login(f.username, f.password), onError: … })
login.mutate(form)        // lanza la llamada
login.isPending           // true mientras espera → botón deshabilitado y «Entrando…»
```
Para leer datos usamos `useQuery`: ver el [tema 14](#14-leer-datos-con-caché-usequery).

## 9. Formularios (React Hook Form + Zod)
**Zod** define las reglas, como un DTO con Bean Validation, y de ahí sale el tipo TypeScript:

```ts
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'login.username_required'),   // ≈ @NotBlank(message = "{…}")
  password: z.string().min(1, 'login.password_required'),
})
export type LoginForm = z.infer<typeof loginSchema>                  // el tipo se deduce: una sola fuente de verdad
```

**React Hook Form** conecta los `<input>` con ese esquema: `register('username')` engancha el campo, `handleSubmit(onSubmit)`
valida y **solo** llama a `onSubmit` si todo es válido (por eso con campos vacíos no se llama a la API, CA-3), y
`formState.errors` trae los errores para pintarlos. El mensaje de Zod es una **clave** de traducción, no un texto.

## 10. Traducciones (react-i18next)
Igual que `messages_es.properties`: los textos viven en `src/i18n/locales/es.json` y `en.json`, y el componente pide
`t('login.submit')`. Con variables: `t('nav.account', { name })` y en el JSON `"Cuenta de {{name}}"`.
Cambiar de idioma (`changeLanguage('en')`) repinta todo lo que usa `t` sin recargar; la elección se guarda en
`localStorage` (`cuartico.lang`). El cliente HTTP manda el idioma en `Accept-Language` para que el backend traduzca su `detail`.

**Regla de oro.** En el estado se guardan claves (o el `detail` de la API), no textos traducidos: así un error ya visible
cambia de idioma al cambiar el selector.

## 11. La sesión: tokens, 401 y varias pestañas
**Dónde vive cada token (ADR-001).** El *access token* (15 min) solo en una variable en memoria: si alguien recarga, se
pierde y no pasa nada. El *refresh token* (7 días) en `localStorage`, para que recargar o abrir otra pestaña no pida la
contraseña: al arrancar se canjea por un access nuevo (`/auth/refresh`).

**401 → renovar y repetir.** Si una petición recibe 401 (access caducado), el cliente pide un par nuevo y la repite
**una sola vez**. Si llegan varias 401 a la vez, todas esperan a **la misma** renovación (*single-flight*: una promesa
compartida, como un `CompletableFuture` que reutilizan varios hilos).

**Varias pestañas.** El backend rota el refresh en cada uso y, si recibe uno ya usado, cierra **todas** las sesiones
(sospecha de robo). Dos pestañas renovando a la vez con el mismo refresh lo dispararían. Solución: la **Web Locks API**,
`navigator.locks.request('cuartico-refresh', tarea)`, que es un `synchronized` compartido por todas las pestañas del sitio.
Dentro del bloqueo se lee el refresh **de `localStorage`** (nunca de una copia), así la segunda pestaña usa el que la
primera acaba de recibir.

**Logout en otra pestaña.** El navegador lanza el evento `storage` en las demás pestañas cuando una cambia `localStorage`;
si el refresh desaparece, esas pestañas pasan a anónimas y van al login.

**Red mala.** Si `/auth/refresh` falla por red, **no** se borra nada (puede que el servidor sí rotara el token): se
reintenta una vez enseguida y, si sigue fallando, se ofrece «Reintentar». Solo un **401** de `/auth/refresh` termina la sesión.

**En el código.** `auth/tokens.ts`, `auth/lock.ts`, `auth/session.ts`, `api/client.ts` (ver la tabla del
[README](../README.md#sesión-y-tokens-hu-01-adr-001)).

## 12. Tests (Vitest + Testing Library)
**Vitest** ≈ JUnit (`describe`/`it`/`expect`). **Testing Library** monta componentes en un navegador simulado (jsdom) y los
usa **como un usuario**: busca por rol y texto visible, escribe y hace clic.

```tsx
renderApp('/login')                                            // monta la app en esa URL
await userEvent.type(screen.getByLabelText('Usuario'), 'mario')
await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos')
```
La API se simula con `src/test/fakeApi.ts`: es MockMvc al revés (falseamos el servidor, no el cliente) y guarda las
peticiones para comprobarlas (p. ej. que con campos vacíos **no** hubo ninguna). `getBy…` falla si no está; `findBy…`
espera a que aparezca (las cosas asíncronas); `queryBy…` devuelve `null` si no está.

## 13. Build y despliegue
`npm run build` comprueba tipos (`tsc -b`, como compilar con `javac`) y **Vite** junta y minimiza todo en `dist/`:
un `index.html`, JS y CSS con un *hash* en el nombre (caché eterna segura: si cambia el contenido, cambia el nombre).
Las variables `VITE_*` se **incrustan** en el JavaScript al compilar: son públicas, nunca secretos. `dist/` se publica
como sitio estático en Render con el *rewrite* del SPA.

## 14. Leer datos con caché (`useQuery`)
**Qué es.** `useQuery` pide datos a la API y te da su estado: `isPending` (aún no hay datos), `isError`/`error`, `data`
y `refetch()` («Reintentar»). Guarda la respuesta en una **caché** con una **clave**.

```tsx
const list = useQuery({
  queryKey: ['products', 'list', params],               // clave: una entrada de caché por combinación de filtros
  queryFn: ({ signal }) => productsApi.list(params, signal),
})
if (list.isPending) return <Skeleton />
if (list.isError) return <Error onRetry={() => list.refetch()} />
return <Table rows={list.data.content} />
```

**Analogía.** Un método con `@Cacheable(key = "#params")`, pero que además te dice si está cargando o falló, y que
**vuelve a pintar** el componente cuando llega la respuesta. Si vuelves a una página ya vista, sale al instante de la caché.

**Por qué no un `useEffect` + `fetch` a mano.** Habría que gestionar a mano carga, error, cancelación (si cambias de
filtro antes de que llegue la respuesta anterior, esa respuesta vieja **no** debe pintarse) y caché. TanStack Query lo
hace por nosotros: cuando la clave cambia, cancela la petición vieja con el `signal`.

**Las claves son jerárquicas**, como rutas: `['products']` agrupa `['products','list',…]`, `['products','detail',7]` y
`['products','categories']`. En el código, todas salen de `productKeys` (`features/products/queries.ts`): un único sitio.

**Dónde se separa la lógica (pensando en React Native).** `api/products.ts` no sabe nada de React (≈ un cliente Feign);
`queries.ts` lo envuelve en hooks; los componentes solo llaman a los hooks y pintan.

## 15. Mutaciones e invalidación de la caché
**Qué es.** Una *mutación* cambia algo en el servidor (crear, guardar, desactivar). `useMutation` da `mutate()` y
`isPending` (para deshabilitar el botón y evitar el doble clic).

```tsx
const save = useMutation({
  mutationFn: (body) => productsApi.create(body),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),   // ≈ @CacheEvict(allEntries = true)
})
save.mutate(body, { onSuccess: () => navigate('/products'), onError: showError })
```

**Invalidar** marca esas entradas como obsoletas: las que se están viendo se vuelven a pedir y las demás, cuando se
vuelvan a usar. Así, al volver al listado tras crear un producto, aparece sin recargar la página.

**Matiz que hemos cuidado.** Al desactivar desde el formulario, **no** invalidamos el detalle (se repintaría el formulario
y perderías lo escrito): escribimos en la caché la respuesta (`setQueryData`) y guardamos la nueva `version` para el
próximo «Guardar». Si no, nuestro propio cambio provocaría un 409 de bloqueo optimista (el `@Version` de JPA).

## 16. Estado en la URL (búsqueda, filtros, página)
**Qué es.** En vez de guardar la búsqueda y la página en `useState`, las guardamos en la URL:
`/products?q=arroz&cat=Granos&status=all&page=2`. La URL es la **fuente de verdad**; el componente la lee y la escribe.

```tsx
const [params, setParams] = useSearchParams()          // ≈ los @RequestParam del GET, pero en el navegador
const query = parseListQuery(params)                    // texto de la URL → objeto tipado (valores raros → por defecto)
setParams(toSearchParams({ ...query, page: 2 }))        // cambia la URL → React Router repinta → nueva petición
```

**Por qué.** Recargar, compartir el enlace o volver con «atrás» reproduce exactamente la misma vista (CA-26). Con
`useState` se perdería todo al recargar.

**Detalles.**
- La `page` de la URL empieza en **1** (para personas) y la de la API en **0**: la conversión vive en un solo sitio (`toApiParams`).
- Solo se escriben los valores que no son por defecto: `/products` a secas = activos, página 1, por nombre.
- **Debounce (espera de 300 ms)** en la búsqueda: un `useEffect` arranca un temporizador en cada tecla y su función de
  limpieza lo cancela si llega otra tecla antes. Solo cuando dejas de escribir se cambia la URL, y con `replace` (no llena
  el historial: «atrás» no recorre letra a letra). Analogía: un `ScheduledFuture` que se cancela y se reprograma.
- «Volver a productos» desde el formulario: el listado pasa su `?…` actual en el `state` del enlace y el formulario vuelve a él.

## 17. Formularios de verdad: validación, errores del servidor y «¿descartar?»
Sobre lo visto en el [tema 9](#9-formularios-react-hook-form--zod), el formulario de producto añade:

- **Cuándo validar.** `useForm({ mode: 'onTouched' })`: valida al **salir** de un campo y, desde ese momento, a cada
  cambio (el error desaparece en cuanto el valor es válido). Al guardar valida todo y pone el foco en el primer error.
- **Valores = texto.** Los `<input>` siempre dan texto («12,5»). El esquema Zod valida ese texto con las **mismas reglas que
  la API** (≈ los `@Size`/`@Pattern`/`@Digits` del DTO) y `toRequest()` lo convierte al cuerpo JSON (número `12.5`,
  vacío → `null`, SKU en mayúsculas). Es nuestro "mapper" DTO ⇄ formulario.
- **Errores del servidor en su campo.** La API manda: si responde 409 `product.sku_conflict`, hacemos
  `setError('sku', { type: 'server', message: detail })` y el error aparece bajo el SKU. Con `validation.failed`, cada
  `errors.<campo>` va a su campo. Decidimos por `code`, nunca por el texto (igual que en el backend).
- **Bloqueo optimista (409 `resource.version_conflict`).** El `PUT` lleva la `version` que editaste; si otro guardó antes,
  avisamos y ofrecemos «Recargar producto». Nunca se pisa un cambio en silencio.
- **«¿Descartar los cambios?»** `formState.isDirty` dice si hay cambios sin guardar. `useBlocker` (React Router)
  intercepta **cualquier** navegación dentro de la app (Cancelar, el menú, el botón atrás) y nos deja preguntar con un
  `<dialog>`: `blocker.proceed()` sale, `blocker.reset()` se queda. Analogía: un `HandlerInterceptor.preHandle` que puede
  devolver `false`. Para cerrar o recargar la pestaña se usa el evento nativo `beforeunload`.

## 18. Contexto: los avisos (toasts)
**Qué es.** `createContext` + `useContext` comparten un valor con **todos** los componentes de debajo de un *Provider*,
sin pasarlo por props nivel a nivel.

```tsx
<ToastProvider>          {/* en AppLayout: envuelve todas las páginas del panel */}
  <Outlet />
</ToastProvider>

const toast = useToast()                       // en cualquier página: "inyectar el bean"
toast({ text: t('products.saved') })
toast({ text: t('products.deactivated', { name }), action: { label: t('common.undo'), run: reactivar } })
```

**Analogía.** Un bean singleton del `ApplicationContext`: quien lo necesita lo pide y recibe siempre el mismo. Como el
proveedor vive en el layout (no en la página), el aviso «Cambios guardados.» lanzado desde el formulario sigue visible
después de volver al listado.

**Cuándo NO usar contexto.** Para datos de la API (eso es TanStack Query) ni para estado que solo usa un componente
(`useState`). El contexto es para cosas transversales: sesión, idioma, avisos.

## 19. Componentes recursivos: el árbol de categorías
**Qué es.** Un componente que, para pintar a sus hijos, **se usa a sí mismo**. Es lo mismo que un método recursivo en Java
que recorre un árbol.

Ejemplo mínimo (fuera del proyecto):
```tsx
type Node = { name: string; children: Node[] }
function Tree({ node }: { node: Node }) {
  return (
    <li>
      {node.name}
      {node.children.length > 0 && (
        <ul>{node.children.map((c) => <Tree key={c.name} node={c} />)}</ul>   {/* ← se llama a sí mismo */}
      )}
    </li>
  )
}
```
Equivalente Java: `void print(Node n) { System.out.println(n.name); n.children.forEach(this::print); }`.
**¿Cuándo para?** Cuando un nodo no tiene hijos: no se pinta la `<ul>` y no hay más llamadas (como el caso base).

**Por qué aquí.** La API devuelve las categorías como **lista plana** (cada una con su `parentId`), igual que una tabla
SQL con clave foreign a sí misma. En `features/categories/tree.ts`, `indexCategories` construye una vez un índice
«hijas de X» (un `Map<parentId, List<Category>>`, como harías en un Service) y `CategoryNode.tsx` lo recorre
recursivamente. Las props se pasan tal cual al hijo con `{...props}` cambiando solo `category`.

**Detalles que importan.**
- La `key` de cada hijo es su `id`: React la usa para saber qué fila es cuál al repintar (como el `equals` de una entidad).
- Encabezados `h2` (raíz) y `h3` (resto) dentro de listas `<ul>` anidadas: el lector de pantalla anuncia «lista, nivel 2»
  sin necesidad de `role="tree"` (que obligaría a navegar con flechas; decisión de Lienzo).

**En el código.** `features/categories/CategoryNode.tsx`, `tree.ts` (lógica pura con tests en `tree.test.ts`).

## 20. Selects dependientes: un campo decide los demás
**Qué es.** Formularios donde el valor de un campo cambia qué otros campos hay o qué opciones ofrecen. En Cuartico:
- **Producto**: la *categoría* decide el *tipo*; el tipo decide si se ven «Modelo» y «Garantía» y si la unidad queda fija.
- **Listado**: el filtro *Tipo* limita las opciones de *Categoría*; si la elegida no es del tipo nuevo, se quita.
- **Diálogo de categoría**: el *padre* decide si se pide el tipo (raíz) o se muestra heredado (hija).

**Cómo se hace en React.** No hay "listeners" que enseñen u oculten cosas a mano (como en jQuery). Se **lee** el valor y
se **deriva** lo demás en cada pintada:
```tsx
const categoryId = useWatch({ control, name: 'categoryId' })   // se repinta cuando cambia
const type = typeOf(categoryId)                                 // valor DERIVADO: no es estado
{type === 'APPLIANCE' && <ModelAndWarrantyFields />}            // se ve o no según el tipo
<select disabled={isUnitLocked(type)} …>
```
Regla de oro: **no guardes en estado lo que puedes calcular** (como no guardarías en la BD una columna que es la suma de
otras). Solo es estado lo que el usuario hace (el valor de la categoría) o lo que pasó (el aviso «este tipo no usa
modelo…», que guardamos como *qué ocurrió*, no como texto, para que cambie con el idioma).

**Truco del "valor anterior".** En `onCategoryChange` (`ProductFormPage.tsx`), la variable `type` aún es la de la
pintada anterior: la función se creó antes del cambio. Así comparamos «antes» y «después» sin guardar nada extra.

**Los datos ocultos no se pierden pero tampoco se envían.** Si cambias un electrodoméstico a alimento, el modelo sigue en
el formulario (si vuelves, reaparece), pero `toRequest(values, type)` lo manda como `null`: el servidor nunca borra
atributos por su cuenta (ADR-003), así que lo hace el frontend.

## 21. Validación que depende del contexto (esquemas "fábrica")
**Problema.** Algunas reglas no se pueden decidir mirando un campo solo: «la garantía es obligatoria de 0 a 120 *si* el
tipo es electrodoméstico», «el nombre no puede repetirse *entre las hermanas del padre elegido*».

**Solución.** En vez de un esquema fijo, una **función que construye el esquema** con lo que necesita saber:
```ts
export function buildCategorySchema(ctx: { index, lang, editing }) {
  return z.object({ name: z.string().trim().min(1, …), … })
    .superRefine((values, issues) => {               // validación "a nivel de clase"
      if (findNameConflict(siblingsOf(ctx.index, parentId), values.name))
        issues.addIssue({ code: 'custom', path: ['name'], message: msg('api.category.name_conflict', …) })
    })
}
```
**Analogía.** Un `ConstraintValidator` a nivel de clase en Bean Validation (`@ScriptAssert`, o uno propio) al que le
inyectas un repositorio. `useMemo` evita reconstruirlo en cada pintada: solo cuando cambia el contexto.

**Por qué comprobar el duplicado en el navegador.** El árbol ya está cargado: el error sale al salir del campo, sin esperar
al servidor. Pero **la garantía sigue siendo la BD** (restricción única → 409): si dos personas crean «Granos» a la vez,
el 409 se pinta en el mismo campo con el mismo texto.

**Aviso no bloqueante.** «Lacteos» y «Lácteos» no chocan en la BD (`LOWER` no quita tildes). Lo detectamos con
`normalize('NFD')` (separa «á» en «a» + tilde) y quitando las marcas, y mostramos un aviso ámbar que **no** impide guardar.

## 22. Diálogos que se montan al abrirse
**Dos maneras de tener un diálogo.**
1. Siempre montado y con una prop `open` (`ConfirmDialog`): sirve para diálogos sin formulario.
2. **Montado solo mientras está abierto** (`CategoryDialog`, `ActionsSheet`): `{form && <CategoryDialog … />}`.
   Al montarse llama a `showModal()`; al cerrarse, el evento `close` avisa al padre, que pone el estado a `null` y
   React lo desmonta. Ventaja: **cada apertura empieza limpia** (el formulario se crea de nuevo con sus valores iniciales),
   sin tener que "resetear" nada. Analogía: un bean con *scope prototype* frente a uno *singleton*.

**Encadenar diálogos (móvil).** En la hoja «⋯» se elige «Renombrar»: guardamos la acción en un `useRef`, cerramos la
hoja y, en su evento `close`, lanzamos la acción. Así el diálogo nuevo no se abre encima del anterior y, al terminar, el
navegador devuelve el foco al botón «⋯».

**Una regla del linter que aparece aquí.** `react-hooks/refs` prohíbe leer `ref.current` en lo que se prepara durante
el render (p. ej. dentro de `handleSubmit(onSubmit)`). Por eso, tras guardar, ponemos `saved = true` y un **efecto**
cierra el diálogo: los refs se tocan en efectos y en manejadores de eventos, nunca al pintar.

## 23. Permisos en la interfaz: «No tienes acceso»
`RequireRole` (en `auth/guards.tsx`) es el `@PreAuthorize` de la interfaz. Con la prop `fallback` muestra algo en lugar
de la página:
```tsx
<RequireRole roles={['ADMIN']} fallback={<ForbiddenPage />}>
  <CategoriesPage />
</RequireRole>
```
Como `CategoriesPage` se carga con `lazy()`, un OPERATOR **ni siquiera descarga su código**. Pero recuerda: esto solo
**esconde**; la seguridad real es el 403 del backend. El menú también depende del rol (`layout/navItems.ts`): el ADMIN ve
«Categorías» en la barra lateral y la pestaña «Cuenta» del móvil pasa a «Más» con una sección «Gestión».

---

## Mini-ejercicios opcionales
1. En `src/i18n/locales/es.json` cambia `login.subtitle`, arranca `npm run dev` y mira cómo cambia sin tocar componentes.
2. En `LoginPage.test.tsx` duplica el test de CA-2 y cambia el mensaje esperado: comprueba que falla y lee el error.
3. Abre dos pestañas del panel con sesión, cierra sesión en una y mira cómo la otra va sola al login (evento `storage`).
4. En `src/features/products/features.ts` pon `SHOW_STOCK_BADGES = true`, abre Productos y mira aparecer «Sin stock» (todo
   el stock es 0 hasta HU-04). Vuelve a ponerlo a `false`.
5. Busca algo en Productos, pasa a la página 2, entra a editar un producto y pulsa «Volver a productos»: fíjate en la URL.
   Después recarga la página: la vista se conserva (tema 16).
6. Abre el mismo producto en dos pestañas, guarda en una y luego en la otra: verás el aviso de conflicto de versión (tema 17).
7. (HU-15) En `CategoryNode.tsx` añade `console.count(c.name)` temporalmente, abre Categorías y mira cuántas veces se pinta
   cada nodo (y bórralo: `console.log` está prohibido en el código). Es la recursión en directo.
8. (HU-15) En un producto nuevo elige «Electrodomésticos › Cocina», escribe un modelo y cambia a «Alimentos › Granos»: lee el
   aviso ámbar; vuelve a Cocina y comprueba que el modelo sigue ahí (tema 20).
9. (HU-15) En la página de categorías, intenta crear «lacteos» dentro de Alimentos (aviso) y «LÁCTEOS» (error) (tema 21).
