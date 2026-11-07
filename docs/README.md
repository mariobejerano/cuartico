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
| [`scrum/sprints/01.md`](scrum/sprints/01.md) | Sprint 1 (Acceso al panel y productos): objetivo, historias y tareas comprometidas, plan. *(en curso)* |

### `analysis/` (Faro)

| Documento | Contenido |
|---|---|
| [`analysis/README.md`](analysis/README.md) | Qué va en cada subcarpeta y tabla de historias, ADR y diagramas. |
| [`analysis/stories/HU-01-panel-access.md`](analysis/stories/HU-01-panel-access.md) | HU-01 Acceso al panel: criterios de aceptación CA-1 a CA-33 (login, sesión, roles, servidor dormido, ventana de gracia del refresh). |
| [`analysis/stories/HU-02-products.md`](analysis/stories/HU-02-products.md) | HU-02 Catálogo de productos (sprint 1). |
| [`analysis/stories/HU-14-user-management.md`](analysis/stories/HU-14-user-management.md) | HU-14 Gestión de usuarios: ficha breve, fuera del sprint 1. |
| [`analysis/use-cases/`](analysis/use-cases/) | Casos de uso. *(vacía: se añaden cuando aporten más que los CA)* |
| [`analysis/diagrams/er.md`](analysis/diagrams/er.md) | Diagrama Mermaid entidad-relación (estado propuesto al cerrar el sprint 1). |
| [`analysis/diagrams/auth-session.md`](analysis/diagrams/auth-session.md) | Diagrama de la sesión en `cuartico-web`: renovación del access token, bloqueo entre pestañas y estados. |
| [`analysis/adr/ADR-001-frontend-token-storage.md`](analysis/adr/ADR-001-frontend-token-storage.md) | ADR-001: dónde guarda los tokens el frontend (access en memoria, refresh en `localStorage`) y complemento de la ventana de gracia. |
| [`analysis/adr/ADR-002-product-stock-cache.md`](analysis/adr/ADR-002-product-stock-cache.md) | ADR-002: stock y costo del producto como caché en `product_stock`. |

### `design/` (Lienzo)

| Documento | Contenido |
|---|---|
| [`design/README.md`](design/README.md) | Qué hay en cada archivo de diseño y reglas que aplican. |
| [`design/design-system.md`](design/design-system.md) | Design system: principios, paleta con contraste AA (claro y oscuro), tipografía, espaciado, estados y componentes base. |
| [`design/tokens.css`](design/tokens.css) | Tokens CSS (capa base y semántica). `cuartico-web` tiene una copia en `src/styles/tokens.css`. |
| [`design/copy.md`](design/copy.md) | Textos de interfaz en es/en por pantalla (claves para react-i18next) y mensajes de error nuevos de la API. |
| [`design/prototypes/design-system.html`](design/prototypes/design-system.html) | Muestrario navegable de los componentes. |
| [`design/prototypes/login.html`](design/prototypes/login.html) | Prototipo del login (HU-01). |
| [`design/prototypes/products.html`](design/prototypes/products.html) | Prototipo del layout del panel y del catálogo de productos (HU-01 y HU-02). |
| [`design/ux-notes/login.md`](design/ux-notes/login.md) | Notas de UX del login: flujo, decisiones, estados, accesibilidad. |
| [`design/ux-notes/products.md`](design/ux-notes/products.md) | Notas de UX del catálogo de productos. |

### `development/` (Forja-Back y Forja-Front)

| Documento | Contenido |
|---|---|
| [`development/backend/README.md`](development/backend/README.md) | Arquitectura del backend: paquetes, capas, seguridad JWT y ventana de gracia del refresh, perfiles, Flyway, auditoría, tests. |
| [`development/backend/api.md`](development/backend/api.md) | Endpoints de `/api/v1`: método, ruta, rol y descripción. Cómo crear un usuario. |
| [`development/backend/errors.md`](development/backend/errors.md) | Formato ProblemDetail, propiedad `code`, tabla de códigos (HTTP, es/en) y cómo añadir uno. |
| [`development/frontend/README.md`](development/frontend/README.md) | Panel `cuartico-web`: cómo arrancarlo, variables de entorno, estructura, convenciones, sesión y despliegue como sitio estático. |
| [`development/frontend/learning/README.md`](development/frontend/learning/README.md) | Guía de aprendizaje de React para quien viene de Java/Spring, con referencias al código. |

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
| [`qa/certifications.md`](qa/certifications.md) | Registro de certificaciones de staging por release. |

## Dónde mirar según la tarea

- **Arrancar el backend o el panel en local**: [`../README.md`](../README.md#arrancar-en-local).
- **Entender el panel si vienes de Java/Spring**: [`development/frontend/learning/README.md`](development/frontend/learning/README.md).
- **Usar la API desde un cliente**: [`development/backend/api.md`](development/backend/api.md) y Swagger de staging.
- **Tratar un error en el frontend o en la API**: [`development/backend/errors.md`](development/backend/errors.md).
- **Entender la sesión y el refresh token**: [ADR-001](analysis/adr/ADR-001-frontend-token-storage.md), [diagrama de sesión](analysis/diagrams/auth-session.md) y [HU-01](analysis/stories/HU-01-panel-access.md).
- **Desplegar o cambiar configuración**: [`devops/README.md`](devops/README.md) y [`devops/deploy.md`](devops/deploy.md).
- **Saber qué se va a hacer y en qué sprint**: [`scrum/product-backlog.md`](scrum/product-backlog.md) y [`scrum/sprints/01.md`](scrum/sprints/01.md).
- **Certificar o revisar un release, o ver qué prueba cubre cada criterio**: [`qa/strategy.md`](qa/strategy.md), [`qa/stories/HU-01.md`](qa/stories/HU-01.md) y [`qa/certifications.md`](qa/certifications.md).
