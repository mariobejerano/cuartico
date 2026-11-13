# Documentación de Cuartico

Índice de toda la documentación. Cada carpeta la mantiene un rol del equipo de agentes (ver [CLAUDE.md](../CLAUDE.md#documentación-cada-rol-en-su-carpeta)).

## Información general

| Documento | Contenido |
|---|---|
| [`../README.md`](../README.md) | Qué es Cuartico/Combazo, fases, stack, cómo arrancar backend y panel en local, entornos. |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Cambios por versión. |
| [`../CLAUDE.md`](../CLAUDE.md) | Reglas de negocio, convenciones, flujo Git, equipo de agentes. |

## Por carpeta

### `scrum/` (Timon)

| Documento | Contenido |
|---|---|
| [`scrum/product-backlog.md`](scrum/product-backlog.md) | Product backlog priorizado: historias de usuario, tareas técnicas y lo hecho. |
| [`scrum/sprints/00.md`](scrum/sprints/00.md) | Sprint 0 (Fundaciones): objetivo, entregas, notas de la review. Incluye la plantilla de sprint. |
| [`scrum/sprints/01.md`](scrum/sprints/01.md) | Sprint 1 (Acceso al panel y productos): objetivo, historias y tareas, entregas, notas de la review. *(terminado)* |
| [`scrum/sprints/02.md`](scrum/sprints/02.md) | Sprint 2 (Catálogo completo): categorías (HU-15), variantes (HU-16) y TT-14. *(en curso)* |

### `analysis/` (Faro)

| Documento | Contenido |
|---|---|
| [`analysis/README.md`](analysis/README.md) | Qué va en cada subcarpeta y tabla de historias, ADR y diagramas. |
| [`analysis/stories/HU-01-panel-access.md`](analysis/stories/HU-01-panel-access.md) | HU-01 Acceso al panel: criterios de aceptación CA-1 a CA-33 (login, sesión, roles, servidor dormido, ventana de gracia del refresh). |
| [`analysis/stories/HU-02-products.md`](analysis/stories/HU-02-products.md) | HU-02 Catálogo de productos (sprint 1). Partes revisadas por ADR-003: la categoría de texto la sustituye HU-15; SKU, umbral y stock pasan a la variante (HU-16). |
| [`analysis/stories/HU-14-user-management.md`](analysis/stories/HU-14-user-management.md) | HU-14 Gestión de usuarios: ficha breve, fuera del sprint 1. |
| [`analysis/stories/HU-15-categories-and-type-attributes.md`](analysis/stories/HU-15-categories-and-type-attributes.md) | HU-15 Categorías y atributos por tipo (sprint 2): CA-1 a CA-28, diseño técnico y migración V4. |
| [`analysis/stories/HU-16-product-variants.md`](analysis/stories/HU-16-product-variants.md) | HU-16 Variantes de producto (sprint 2, V5): talla × color, cada una con SKU, umbral y stock propio. Criterios CA-1 a CA-24 y diseño técnico. |
| [`analysis/use-cases/`](analysis/use-cases/) | Casos de uso. *(vacía: se añaden cuando aporten más que los CA)* |
| [`analysis/diagrams/er.md`](analysis/diagrams/er.md) | Diagrama Mermaid entidad-relación: modelo de HU-02 y modelo de ADR-003 (V4 de categorías, HU-15, y V5 de variantes, HU-16). |
| [`analysis/diagrams/auth-session.md`](analysis/diagrams/auth-session.md) | Diagrama de la sesión en `cuartico-web`: renovación del access token, bloqueo entre pestañas y estados. |
| [`analysis/adr/ADR-001-frontend-token-storage.md`](analysis/adr/ADR-001-frontend-token-storage.md) | ADR-001: dónde guarda los tokens el frontend (access en memoria, refresh en `localStorage`) y complemento de la ventana de gracia. |
| [`analysis/adr/ADR-002-product-stock-cache.md`](analysis/adr/ADR-002-product-stock-cache.md) | ADR-002: stock y costo del producto como caché en `product_stock` (addendum: pasa a la variante). |
| [`analysis/adr/ADR-003-categories-types-variants.md`](analysis/adr/ADR-003-categories-types-variants.md) | ADR-003: categorías en árbol, tipo de producto heredado de la raíz y variantes (aceptado el 2026-11-09). |

### `design/` (Lienzo)

| Documento | Contenido |
|---|---|
| [`design/README.md`](design/README.md) | Qué hay en cada archivo de diseño y reglas que aplican. |
| [`design/design-system.md`](design/design-system.md) | Design system: principios, paleta con contraste AA (claro y oscuro), tipografía, espaciado, estados y componentes base. |
| [`design/tokens.css`](design/tokens.css) | Tokens CSS (capa base y semántica). `cuartico-web` tiene una copia en `src/styles/tokens.css`. |
| [`design/copy.md`](design/copy.md) | Textos de interfaz en es/en por pantalla (claves para react-i18next) y mensajes de error nuevos de la API. |
| [`design/prototypes/design-system.html`](design/prototypes/design-system.html) | Muestrario navegable de los componentes. |
| [`design/prototypes/login.html`](design/prototypes/login.html) | Prototipo del login (HU-01). |
| [`design/prototypes/products.html`](design/prototypes/products.html) | Prototipo del layout del panel y del catálogo de productos (HU-01 y HU-02). Sustituido como referencia de productos por `products-v2.html`. |
| [`design/prototypes/categories.html`](design/prototypes/categories.html) | Prototipo de la página «Categorías» (HU-15, solo ADMIN). |
| [`design/prototypes/products-v2.html`](design/prototypes/products-v2.html) | Prototipo de productos con categoría, tipo, atributos (HU-15) y variantes (HU-16). |
| [`design/ux-notes/login.md`](design/ux-notes/login.md) | Notas de UX del login: flujo, decisiones, estados, accesibilidad. |
| [`design/ux-notes/products.md`](design/ux-notes/products.md) | Notas de UX del catálogo de productos (HU-02). |
| [`design/ux-notes/categories.md`](design/ux-notes/categories.md) | Notas de UX de la página de categorías (HU-15). |
| [`design/ux-notes/products-v2.md`](design/ux-notes/products-v2.md) | Notas de UX del producto con categoría, atributos y variantes (HU-15 y HU-16). |

### `development/` (Forja-Back y Forja-Front)

| Documento | Contenido |
|---|---|
| [`development/backend/README.md`](development/backend/README.md) | Arquitectura del backend: paquetes (`product` HU-02 y HU-16, `category` HU-15), capas, seguridad JWT y ventana de gracia del refresh, perfiles, Flyway (V1 a V5), auditoría, tests y decisiones de productos, categorías, variantes (HU-16) y TT-14. |
| [`development/backend/api.md`](development/backend/api.md) | Endpoints de `/api/v1` (usuarios, sesión, productos, categorías y variantes): método, ruta, rol y descripción. Cómo crear un usuario. Cuerpos y respuestas de productos, categorías y variantes ([sección «Variantes (HU-16)»](development/backend/api.md#variantes-hu-16)). |
| [`development/backend/errors.md`](development/backend/errors.md) | Formato ProblemDetail, propiedad `code`, tabla de códigos (HTTP, es/en, también los de productos, categorías y variantes) y cómo añadir uno. |
| [`development/frontend/README.md`](development/frontend/README.md) | Panel `cuartico-web`: cómo arrancarlo, variables de entorno, estructura, convenciones, sesión, catálogo de productos (HU-02), categorías y atributos por tipo (HU-15), variantes talla × color (HU-16) y despliegue como sitio estático. |
| [`development/frontend/learning/README.md`](development/frontend/learning/README.md) | Guía de aprendizaje de React para quien viene de Java/Spring, con referencias al código. Temas 1 a 13 (HU-01), 14 a 18 (HU-02), 19 a 23 (HU-15: árbol recursivo, selects dependientes, validación por contexto, diálogos y permisos en la interfaz) y 24 a 28 (HU-16: listas dinámicas en formularios, dos ritmos de guardado, componentes de presentación, foco tras pintar y «Deshacer»). |

### `devops/` (Timon)

| Documento | Contenido |
|---|---|
| [`devops/README.md`](devops/README.md) | Entornos, variables de entorno por entorno (solo nombres), CI de backend y frontend, protección de ramas, despliegue, Swagger. |
| [`devops/deploy.md`](devops/deploy.md) | Alta inicial en Render y Neon, y errores de arranque habituales. |

### `qa/` (Vera)

| Documento | Contenido |
|---|---|
| [`qa/strategy.md`](qa/strategy.md) | Tipos de prueba, verificación por historia, certificación en staging, reglas de credenciales de QA. |
| [`qa/stories/HU-01.md`](qa/stories/HU-01.md) | Matriz CA → tests de HU-01 (APTO), verificación manual en staging y defectos encontrados. |
| [`qa/stories/HU-02.md`](qa/stories/HU-02.md) | Matriz CA → tests de HU-02 (catálogo de productos, APTO) y pruebas manuales pendientes. Sustituida en parte por la de HU-15. |
| [`qa/stories/HU-15.md`](qa/stories/HU-15.md) | Matriz CA → tests de HU-15 y TT-14 (APTO), hallazgos y pruebas manuales pendientes (móvil 360 px, revisión visual). |
| [`qa/stories/HU-16.md`](qa/stories/HU-16.md) | Matriz CA → tests de HU-16 (APTO), hallazgos (ninguno bloqueante) y pruebas manuales pendientes: 360 px, V5 en PostgreSQL y certificación en staging. |
| [`qa/certifications.md`](qa/certifications.md) | Registro de certificaciones de staging por release. |

## Dónde mirar según la tarea

- **Arrancar el backend o el panel en local**: [`../README.md`](../README.md#arrancar-en-local).
- **Entender el panel si vienes de Java/Spring**: [`development/frontend/learning/README.md`](development/frontend/learning/README.md).
- **Usar la API desde un cliente**: [`development/backend/api.md`](development/backend/api.md) y Swagger de staging.
- **Entender el catálogo de productos**: [HU-02](analysis/stories/HU-02-products.md), [API de productos](development/backend/api.md), [ER](analysis/diagrams/er.md) y [ADR-002](analysis/adr/ADR-002-product-stock-cache.md) (stock en caché).
- **Entender las categorías, los tipos de producto y sus atributos**: [HU-15](analysis/stories/HU-15-categories-and-type-attributes.md), [ADR-003](analysis/adr/ADR-003-categories-types-variants.md), [API de categorías](development/backend/api.md) y [página de categorías](development/frontend/README.md).
- **Entender las variantes (talla × color) y el SKU o stock por variante**: [HU-16](analysis/stories/HU-16-product-variants.md), [ADR-003](analysis/adr/ADR-003-categories-types-variants.md), [sección de variantes de la API](development/backend/api.md#variantes-hu-16), [ER](analysis/diagrams/er.md) (modelo ADR-003) y [matriz de QA](qa/stories/HU-16.md).
- **Tratar un error en el frontend o en la API**: [`development/backend/errors.md`](development/backend/errors.md).
- **Entender la sesión y el refresh token**: [ADR-001](analysis/adr/ADR-001-frontend-token-storage.md), [diagrama de sesión](analysis/diagrams/auth-session.md) y [HU-01](analysis/stories/HU-01-panel-access.md).
- **Desplegar o cambiar configuración**: [`devops/README.md`](devops/README.md) y [`devops/deploy.md`](devops/deploy.md).
- **Saber qué se va a hacer y en qué sprint**: [`scrum/product-backlog.md`](scrum/product-backlog.md) y [`scrum/sprints/02.md`](scrum/sprints/02.md).
- **Certificar o revisar un release, o ver qué prueba cubre cada criterio**: [`qa/strategy.md`](qa/strategy.md), las matrices [HU-01](qa/stories/HU-01.md), [HU-02](qa/stories/HU-02.md), [HU-15](qa/stories/HU-15.md) y [HU-16](qa/stories/HU-16.md), y [`qa/certifications.md`](qa/certifications.md).
