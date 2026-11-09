# ADR-002: Stock y costo del producto, ¿cacheados o calculados?

- **Estado:** Aceptado (2026-10-30). **Addendum 2026-11-09** (al final): la caché es 1:1 con la variante (ADR-003).
- **Fecha:** 2026-10-30
- **Historias:** [HU-02](../stories/HU-02-products.md) (crea el modelo), HU-04 (lo mantiene), HU-06/HU-07 (lo consumen)

## Contexto
- Regla de negocio: todo cambio de stock es un **movimiento inmutable** (entrada por compra, reserva, salida por venta,
  liberación, ajuste). Disponible = físico − reservado. Costo por **promedio ponderado**.
- HU-02 muestra stock y costo en **solo lectura**; HU-04 crea los movimientos.
- Lecturas frecuentes y masivas: listado de productos, "combos disponibles según stock" (HU-06) y Combazo (fases 2–3)
  necesitan el disponible de **muchos productos a la vez**.
- Escrituras concurrentes: dos pedidos pueden intentar reservar el último producto (HU-07).
- El promedio ponderado **depende del orden** de los movimientos: no es una suma, hay que recorrer el historial.

## Opciones
1. **Calculado**: `SUM` de movimientos por producto en cada lectura, y el costo recorriendo el historial.
   Una única fuente de verdad, pero cada listado agrega toda la tabla de movimientos; el costo promedio es caro de recalcular;
   y para reservar sin sobreventa hay que bloquear algo igualmente (no hay fila que bloquear).
2. **Cacheado en `products`** (`stock_on_hand`, `stock_reserved`, `average_cost`): lectura trivial. Pero mezcla catálogo e
   inventario en la misma fila: cada venta incrementa la `version` del producto y un operador que está editando el nombre
   recibiría un 409 sin motivo real. Además, el módulo `product` y el futuro `inventory` escribirían la misma entidad.
3. **Cacheado en una tabla aparte `product_stock` (1:1 con `products`)**: lectura con un `JOIN`; la fila de stock es la que se
   bloquea al reservar (`SELECT … FOR UPDATE`), sin interferir con la edición del catálogo. Cada módulo es dueño de su tabla.

## Decisión
**Opción 3.** `product_stock` se crea en V3 (HU-02; V2 la ocupó la ventana de gracia de HU-01) con ceros; HU-04 la mantiene.

Reglas para HU-04 (se detallarán allí):
- El movimiento y la actualización de `product_stock` van en la **misma transacción**, con bloqueo pesimista de la fila de
  `product_stock`. Las reservas comprueban `on_hand − reserved ≥ cantidad` con la fila bloqueada.
- `product_stock` solo se modifica a través del servicio de inventario, nunca desde el catálogo ni a mano.
- `average_cost` se guarda en la **moneda de referencia, `USD`** (`app.currencies.reference`, convertida con la tasa de cada compra) y se anota esa moneda
  en `cost_currency` para no depender implícitamente de la configuración.
- Invariante verificable: `on_hand` = suma de los movimientos del producto. Vera tendrá un test de reconciliación.

## Consecuencias
- (+) Lecturas baratas (listados, combos disponibles, Combazo) y control de concurrencia claro al reservar.
- (+) Editar el catálogo y mover stock no compiten por la misma versión.
- (−) Dato duplicado (movimientos + caché): si alguien escribe fuera del servicio, se desincroniza. Mitigación: un solo
  punto de escritura y el test de reconciliación. Si algún día se desincroniza, se puede reconstruir desde los movimientos.
- (−) Un `JOIN` más en las consultas de producto (despreciable con este volumen).

## Addendum 2026-11-09: la caché pasa a la variante (ADR-003)
Con las variantes ([ADR-003](ADR-003-categories-types-variants.md), [HU-16](../stories/HU-16-product-variants.md)) lo
vendible ya no es el producto sino la **variante** (`product_variants`; un producto simple tiene exactamente una).

- El 1:1 de esta decisión pasa a ser **`product_variants` ↔ `variant_stock`** (`variant_id` PK y FK). La migración V5 crea
  `variant_stock` con los datos de `product_stock` (todo ceros: aún no hay movimientos) y elimina `product_stock`.
- Todo lo demás se mantiene, ahora **por variante**: bloqueo pesimista de la fila de `variant_stock` al reservar,
  movimiento y caché en la misma transacción, un único punto de escritura (servicio de inventario, HU-04), `average_cost`
  en `USD` con `cost_currency`, e invariante de reconciliación `on_hand` = suma de movimientos de la variante.
- Los movimientos de HU-04 nacen con `variant_id`.
- **Agregado por producto** (listado, reportes), sobre **todas** sus variantes, activas o inactivas (desactivar una talla
  no saca sus unidades del almacén ni su valor): `onHand`, `reserved`, `available` = sumas; `averageCost` = promedio
  **ponderado** Σ(onHand·averageCost) / Σ onHand sobre las variantes con costo (nunca la suma de promedios), `null` si
  ese Σ onHand = 0; `costCurrency` = `USD` cuando hay costo. Detalle y test en [HU-16](../stories/HU-16-product-variants.md) CA-15.
- Responde a la pregunta de Lupa en el PR #10.
