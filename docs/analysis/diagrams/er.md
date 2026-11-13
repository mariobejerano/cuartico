# Modelo entidad-relación

Sprint 1: V1 + productos ([HU-02](../stories/HU-02-products.md)) + ventana de gracia del refresh
([HU-01](../stories/HU-01-panel-access.md) CA-28 a CA-33), en el primer diagrama (histórico: `products.category`, `sku`,
`min_stock` y `product_stock` ya no existen tras V4/V5). Sprint 2: **V4** ([HU-15](../stories/HU-15-categories-and-type-attributes.md),
mergeada en PR #13) y **V5** ([HU-16](../stories/HU-16-product-variants.md), mergeada en PR #14), en la
sección de ADR-003, que es el modelo vigente de productos. Se amplía con cada historia.

```mermaid
erDiagram
    users ||--o{ refresh_tokens : "tiene"
    refresh_tokens |o--o| refresh_tokens : "replaced_by_id (sucesor al rotar)"
    products ||--|| product_stock : "caché de stock (ADR-002)"

    users {
        BIGINT id PK
        VARCHAR username UK
        VARCHAR password_hash
        VARCHAR full_name
        VARCHAR role "ADMIN | OPERATOR"
        BOOLEAN active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        VARCHAR created_by
        VARCHAR updated_by
    }
    refresh_tokens {
        BIGINT id PK
        VARCHAR token_hash UK "SHA-256"
        BIGINT user_id FK
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ revoked_at
        VARCHAR revoked_reason "nuevo: ROTATED, SUPERSEDED, LOGOUT..."
        BIGINT replaced_by_id FK "nuevo, ON DELETE SET NULL"
        TIMESTAMPTZ created_at
    }
    products {
        BIGINT id PK
        VARCHAR name "no único"
        VARCHAR sku UK "opcional, mayúsculas"
        VARCHAR unit "UNIT | KG | LB | G | L | ML"
        VARCHAR category "texto libre"
        NUMERIC sale_price "referencia, opcional"
        VARCHAR sale_price_currency "ISO 4217: CUP | USD"
        NUMERIC min_stock
        BOOLEAN active
        BIGINT version "bloqueo optimista"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        VARCHAR created_by
        VARCHAR updated_by
    }
    product_stock {
        BIGINT product_id PK "y FK a products"
        NUMERIC on_hand
        NUMERIC reserved
        NUMERIC average_cost "en USD (moneda de referencia)"
        VARCHAR cost_currency
        TIMESTAMPTZ updated_at
    }
```

Notas: `refresh_tokens` y `product_stock` no extienden `AuditableEntity` (no las edita un usuario). Índices: los `UK`
(`username`, `token_hash`, `sku`), `idx_refresh_tokens_user` e `idx_refresh_tokens_replaced_by` (nuevo); productos no lleva índices de búsqueda (ver HU-02, migración).

## Modelo ADR-003 (V4 y V5)

> [ADR-003](../adr/ADR-003-categories-types-variants.md) (aceptado 2026-11-09). **V4** (HU-15, sprint 2, PR #13:
> `categories`, `products.category_id`, `brand`, `model`, `warranty_months`). **V5** (HU-16, sprint 2, mergeada en
> PR #14: `product_variants`, `variant_stock`). Incluye la 4.ª raíz «Aseo y hogar» (`OTHER`). Sustituye
> `products.category` (texto) por `categories` (árbol) y `product_stock` por `variant_stock` (1:1 con la variante).
> Se quitan de `products`: `category`, `sku`, `min_stock` (pasan a categoría y variante).

```mermaid
erDiagram
    categories |o--o{ categories : "parent_id (máx. 3 niveles)"
    categories ||--o{ products : "category_id (obligatoria)"
    products ||--|{ product_variants : "≥ 1 (simple = 1 sin talla/color)"
    product_variants ||--|| variant_stock : "caché de stock (ADR-002, ahora por variante)"

    categories {
        BIGINT id PK
        BIGINT parent_id FK "nulo = raíz"
        VARCHAR name "es; único por padre (name_key)"
        VARCHAR name_en "opcional"
        VARCHAR name_key "LOWER(TRIM(name)), lo calcula la BD"
        VARCHAR product_type "FOOD | CLOTHING | APPLIANCE | OTHER; heredado de la raíz"
        INTEGER depth "1..3"
        BOOLEAN active
        BIGINT version
    }
    products {
        BIGINT id PK
        VARCHAR name
        BIGINT category_id FK "tipo derivado de la categoría"
        VARCHAR unit "UNIT obligatorio en CLOTHING y APPLIANCE"
        VARCHAR brand "opcional"
        VARCHAR model "solo APPLIANCE"
        INTEGER warranty_months "solo APPLIANCE, 0..120"
        NUMERIC sale_price
        VARCHAR sale_price_currency
        BOOLEAN has_variants
        BOOLEAN active
        BIGINT version
    }
    product_variants {
        BIGINT id PK
        BIGINT product_id FK
        VARCHAR sku UK "opcional"
        VARCHAR size "mayúsculas; único (product_id, size, color_key)"
        VARCHAR color
        VARCHAR color_key "LOWER(TRIM(color)), lo calcula la BD"
        NUMERIC min_stock
        BOOLEAN active
        BIGINT version
    }
    variant_stock {
        BIGINT variant_id PK "y FK a product_variants"
        NUMERIC on_hand
        NUMERIC reserved
        NUMERIC average_cost "USD"
        VARCHAR cost_currency
        TIMESTAMPTZ updated_at
    }
```

Futuro (HU-04/HU-06, referencia): `stock_movements.variant_id` y líneas de compra/pedido con `variant_id`;
`combo_items (product_id, variant_id nulo = «se elige al vender»)`. Columnas de auditoría omitidas en el diagrama.
