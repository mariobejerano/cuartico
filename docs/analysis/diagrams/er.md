# Modelo entidad-relación

Estado tras V2 (propuesta de [HU-02](../stories/HU-02-products.md)). Se amplía con cada historia.

```mermaid
erDiagram
    users ||--o{ refresh_tokens : "tiene"
    products ||--|| product_stock : "caché de stock (ADR-002)"

    users {
        BIGINT id PK
        VARCHAR username UK
        VARCHAR password_hash
        VARCHAR full_name
        VARCHAR role "ADMIN | OPERATOR"
        BOOLEAN active
    }
    refresh_tokens {
        BIGINT id PK
        VARCHAR token_hash UK "SHA-256"
        BIGINT user_id FK
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ revoked_at
    }
    products {
        BIGINT id PK
        VARCHAR name
        VARCHAR sku UK "opcional, mayúsculas"
        VARCHAR unit "UNIT | KG | LB | G | L | ML"
        VARCHAR category "texto libre"
        NUMERIC sale_price "referencia, opcional"
        VARCHAR sale_price_currency "ISO 4217"
        NUMERIC min_stock
        BOOLEAN active
        BIGINT version "bloqueo optimista"
    }
    product_stock {
        BIGINT product_id PK, FK
        NUMERIC on_hand
        NUMERIC reserved
        NUMERIC average_cost "moneda de referencia"
        VARCHAR cost_currency
    }
```

Las tablas de negocio llevan además `created_at`, `updated_at`, `created_by`, `updated_by` (`AuditableEntity`).
