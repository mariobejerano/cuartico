# Sesión en `cuartico-web`

Ver [HU-01](../stories/HU-01-panel-access.md) y [ADR-001](../adr/ADR-001-frontend-token-storage.md).

## Renovación ante 401 (una pestaña, varias peticiones)

```mermaid
sequenceDiagram
    participant UI as Pantalla
    participant C as api/client
    participant S as auth/session
    participant API as API (Render)

    UI->>C: GET /api/v1/products
    C->>API: Authorization: Bearer (caducado)
    API-->>C: 401 auth.unauthorized
    C->>S: renovar()
    Note over S: single-flight: otras peticiones con 401<br/>esperan esta misma promesa
    S->>S: navigator.locks 'cuartico-refresh' (serializa entre pestañas)
    S->>S: lee el refresh de localStorage DENTRO del lock<br/>(si otra pestaña ya rotó, obtiene el nuevo)
    S->>API: POST /auth/refresh {refreshToken más reciente}
    API-->>S: 200 {accessToken, refreshToken, user}
    S->>S: access en memoria, refresh en localStorage, libera el lock
    S-->>C: nuevo access
    C->>API: repite GET una vez
    API-->>C: 200
    C-->>UI: datos
    Note over S,API: 401 en /auth/refresh: borrar sesión local y volver al login (sin reintentar)<br/>timeout (90 s) o red: conservar el refresh, liberar el lock y ofrecer «Reintentar»
```

El mismo bloqueo `cuartico-refresh` envuelve el **refresh inicial** (al cargar) y el **logout**; dentro siempre se relee
`localStorage` y, si ya no hay refresh (otra pestaña cerró sesión), no se llama a la API.

## Ventana de gracia en el backend (ADR-001, HU-01 CA-28)

```mermaid
sequenceDiagram
    participant S as auth/session
    participant API as API

    S->>API: POST /auth/refresh {R1}
    Note over API: R1 → ROTATED, emite R2 (replaced_by_id = R2)
    API--xS: respuesta perdida (red)
    Note over S: corte a los 90 s: conserva R1, «Reintentar»
    S->>API: POST /auth/refresh {R1} (≤ 120 s después de rotar)
    Note over API: R1 ROTATED hace ≤ 120 s y R2 sin usar<br/>→ R2 SUPERSEDED, emite R3, sin revocación global
    API-->>S: 200 {R3}
```

## Estados de la sesión en el frontend

```mermaid
stateDiagram-v2
    [*] --> Comprobando: carga de la app
    Comprobando --> Autenticado: hay refresh y /refresh 200
    Comprobando --> Anonimo: no hay refresh o /refresh 401
    Anonimo --> Autenticado: login 200
    Autenticado --> Renovando: 401 en una petición
    Renovando --> Autenticado: /refresh 200
    Renovando --> Anonimo: /refresh 401
    Renovando --> SinConexion: timeout 90 s o error de red
    Comprobando --> SinConexion: timeout 90 s o error de red
    SinConexion --> Renovando: Reintentar (refresh conservado)
    Autenticado --> Anonimo: logout, cambio de contraseña (HU-14) o logout en otra pestaña
```
