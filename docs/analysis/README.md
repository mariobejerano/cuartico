# Análisis (Faro)

Responsable: Faro (analista y arquitecto). **Estado: carpetas vacías**; se llenan con la primera historia de Cuartico.

| Subcarpeta | Qué va aquí | Formato |
|---|---|---|
| [`stories/`](stories/) | Historias de usuario con criterios de aceptación (CA-n) y diseño técnico. | `<NNN>-<slug>.md`, una por historia (p. ej. `001-productos.md`). |
| [`use-cases/`](use-cases/) | Casos de uso: actores, flujos principales y alternativos. | Markdown. |
| [`diagrams/`](diagrams/) | Diagramas Mermaid: casos de uso, entidad-relación, estados (pedido, pago), secuencia. Se actualizan con cada historia. | Mermaid dentro de Markdown (se ven en GitHub). |
| [`adr/`](adr/) | Registro de decisiones de arquitectura (ADR) cuando hay alternativas reales. | `<NNNN>-<slug>.md`: contexto, opciones, decisión, consecuencias. |

Las historias de Cuartico salen de las entradas del [product backlog](../scrum/product-backlog.md) (HU-01 a HU-10).
Las reglas de negocio de referencia están en [`CLAUDE.md`](../../CLAUDE.md#reglas-de-negocio-clave).
