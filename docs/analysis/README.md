# Análisis (Faro)

Responsable: Faro (analista y arquitecto).

| Subcarpeta | Qué va aquí | Formato |
|---|---|---|
| [`stories/`](stories/) | Historias de usuario con criterios de aceptación (CA-n) y diseño técnico. | `HU-<NN>-<slug>.md`, una por historia (el ID es el del backlog). |
| [`use-cases/`](use-cases/) | Casos de uso: actores, flujos principales y alternativos. | Markdown. Se añaden cuando aporten más que los CA de la historia. |
| [`diagrams/`](diagrams/) | Diagramas Mermaid: casos de uso, entidad-relación, estados (pedido, pago), secuencia. Se actualizan con cada historia. | Mermaid dentro de Markdown (se ven en GitHub). |
| [`adr/`](adr/) | Registro de decisiones de arquitectura (ADR) cuando hay alternativas reales. | `ADR-<NNN>-<slug>.md`: contexto, opciones, decisión, consecuencias. |

Las historias de Cuartico salen de las entradas del [product backlog](../scrum/product-backlog.md) (HU-01 a HU-10).
Las reglas de negocio de referencia están en [`CLAUDE.md`](../../CLAUDE.md#reglas-de-negocio-clave).

## Historias
| ID | Historia | Sprint | Estado |
|---|---|---|---|
| HU-01 | [Acceso al panel](stories/HU-01-panel-access.md) | 1 | Análisis listo |
| HU-02 | [Catálogo de productos](stories/HU-02-products.md) | 1 | Análisis listo |
| HU-14 | [Gestión de usuarios](stories/HU-14-user-management.md) | — | Ficha breve |

## ADR
| ID | Decisión | Estado |
|---|---|---|
| ADR-001 | [Almacenamiento de tokens en el frontend](adr/ADR-001-frontend-token-storage.md) | Aceptado (2026-10-30) |
| ADR-002 | [Stock y costo del producto: caché en `product_stock`](adr/ADR-002-product-stock-cache.md) | Aceptado (2026-10-30) |

## Diagramas
- [Modelo entidad-relación](diagrams/er.md)
- [Sesión en `cuartico-web`: renovación y estados](diagrams/auth-session.md)
