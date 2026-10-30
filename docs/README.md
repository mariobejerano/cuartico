# Documentación de Cuartico

Índice de toda la documentación. Cada carpeta la mantiene un rol del equipo de agentes (ver [CLAUDE.md](../CLAUDE.md#documentación-cada-rol-en-su-carpeta)).

## Información general

| Documento | Contenido |
|---|---|
| [`../README.md`](../README.md) | Qué es Cuartico/Combazo, fases, stack, cómo arrancar en local, entornos. |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Cambios por versión. |
| [`../CLAUDE.md`](../CLAUDE.md) | Reglas de negocio, convenciones, flujo Git, equipo de agentes. |

## Por carpeta

### `scrum/` (Timon)

| Documento | Contenido |
|---|---|
| [`scrum/product-backlog.md`](scrum/product-backlog.md) | Product backlog priorizado: historias de usuario, tareas técnicas y lo hecho. |
| [`scrum/sprints/00.md`](scrum/sprints/00.md) | Sprint 0 (Fundaciones): objetivo, entregas, notas de la review. Incluye la plantilla de sprint. |

### `analysis/` (Faro)

| Documento | Contenido |
|---|---|
| [`analysis/README.md`](analysis/README.md) | Qué va en cada subcarpeta. |
| `analysis/stories/` | Historias de usuario con criterios de aceptación. *(vacía)* |
| `analysis/use-cases/` | Casos de uso. *(vacía)* |
| `analysis/diagrams/` | Diagramas Mermaid (casos de uso, entidad-relación, estados, secuencia). *(vacía)* |
| `analysis/adr/` | Registro de decisiones de arquitectura. *(vacía)* |

### `design/` (Lienzo)

| Documento | Contenido |
|---|---|
| [`design/README.md`](design/README.md) | Qué va en cada subcarpeta. |
| `design/prototypes/` | Prototipos HTML de pantallas. *(vacía)* |

### `development/` (Forja-Back y Forja-Front)

| Documento | Contenido |
|---|---|
| [`development/backend/README.md`](development/backend/README.md) | Arquitectura del backend: paquetes, capas, seguridad JWT, perfiles, Flyway, auditoría, tests. |
| [`development/backend/api.md`](development/backend/api.md) | Endpoints de `/api/v1`: método, ruta, rol y descripción. Cómo crear un usuario. |
| [`development/backend/errors.md`](development/backend/errors.md) | Formato ProblemDetail, propiedad `code`, tabla de códigos (HTTP, es/en) y cómo añadir uno. |
| [`development/frontend/README.md`](development/frontend/README.md) | Frontend: pendiente. Acuerdos de i18n y design system. |

### `devops/` (Timon)

| Documento | Contenido |
|---|---|
| [`devops/README.md`](devops/README.md) | Entornos, variables de entorno por entorno (solo nombres), CI, protección de ramas, despliegue, Swagger. |
| [`devops/deploy.md`](devops/deploy.md) | Alta inicial en Render y Neon, y errores de arranque habituales. |

### `qa/` (Vera)

| Documento | Contenido |
|---|---|
| [`qa/strategy.md`](qa/strategy.md) | Tipos de prueba, verificación por historia, certificación en staging, reglas de credenciales de QA. |
| [`qa/certifications.md`](qa/certifications.md) | Registro de certificaciones de staging por release. |

## Dónde mirar según la tarea

- **Arrancar en local**: [`../README.md`](../README.md#arrancar-el-backend-en-local).
- **Usar la API desde un cliente**: [`development/backend/api.md`](development/backend/api.md) y Swagger de staging.
- **Tratar un error en el frontend**: [`development/backend/errors.md`](development/backend/errors.md).
- **Desplegar o cambiar configuración**: [`devops/README.md`](devops/README.md) y [`devops/deploy.md`](devops/deploy.md).
- **Saber qué falta**: [`scrum/product-backlog.md`](scrum/product-backlog.md).
- **Certificar o revisar un release**: [`qa/strategy.md`](qa/strategy.md) y [`qa/certifications.md`](qa/certifications.md).
