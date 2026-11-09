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
| HU-01 | [Acceso al panel](stories/HU-01-panel-access.md) | 1 | Implementada, QA APTO, en revisión |
| HU-02 | [Catálogo de productos](stories/HU-02-products.md) | 1 | Implementada, QA APTO, en revisión |
| HU-14 | [Gestión de usuarios](stories/HU-14-user-management.md) | — | Ficha breve |
| HU-15 | [Categorías y atributos por tipo](stories/HU-15-categories-and-type-attributes.md) (V4) | 2 | Analizada; prototipos y D-1, D-4 aprobados (2026-11-09) |
| HU-16 | [Variantes de producto](stories/HU-16-product-variants.md) (V5) | 2 | Analizada; prototipo y D-2, D-3 aprobados (2026-11-09) |

## ADR
| ID | Decisión | Estado |
|---|---|---|
| ADR-001 | [Almacenamiento de tokens en el frontend](adr/ADR-001-frontend-token-storage.md) | Aceptado (2026-10-30); addendum 2026-11-07 (Render) |
| ADR-002 | [Stock y costo del producto: caché en `product_stock`](adr/ADR-002-product-stock-cache.md) | Aceptado (2026-10-30); addendum 2026-11-09 (la caché pasa a la variante) |
| ADR-003 | [Categorías con jerarquía, tipos de producto y variantes](adr/ADR-003-categories-types-variants.md) | Aceptado (2026-11-09) |

## Diagramas
- [Modelo entidad-relación](diagrams/er.md) (incluye el modelo de ADR-003, aceptado y pendiente de implementar en HU-15/HU-16)
- [Sesión en `cuartico-web`: renovación y estados](diagrams/auth-session.md)
