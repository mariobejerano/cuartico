# Modelo entidad-relación

Estado propuesto al cerrar el sprint 1: V1 + productos ([HU-02](../stories/HU-02-products.md)) + ventana de gracia del
refresh ([HU-01](../stories/HU-01-panel-access.md) CA-28 a CA-33). Se amplía con cada historia.

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
