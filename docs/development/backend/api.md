# API REST
> HU-15 cambió la forma de `category` y añadió campos: ver «Cambios en productos (HU-15)» más abajo.

Base: `/api/v1`. Estado: **endpoints de `develop`**. La versión de producción (v0.1.0) todavía sirve las rutas sin versión
(`/api/auth/...`, `/api/users/...`); `/api/v1` llega con la próxima release (ver [sprint 0](../../scrum/sprints/00.md)).

Todos los endpoints requieren `Authorization: Bearer <accessToken>`, salvo los marcados como público.
Los errores siguen el formato de [errors.md](errors.md). Las peticiones de ejemplo están en `backend/requests.http`.

## Endpoints

| Método | Ruta | Acceso | Código OK | Descripción |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | público | 200 | Valida usuario y contraseña. Devuelve `accessToken`, `refreshToken`, `tokenType` (`Bearer`), `expiresIn` (segundos) y `user`. |
| POST | `/api/v1/auth/refresh` | público (refresh token en el cuerpo) | 200 | Rota el refresh token: revoca el usado y devuelve un par de tokens nuevo. Si el token ya rotado se reenvía dentro de `app.jwt.refresh-reuse-grace` (120 s desde la primera rotación, límite inclusivo) y su sucesor no se usó, responde 200 con un par nuevo y deja el sucesor inutilizado (`SUPERSEDED`). Fuera de la gracia, o con el sucesor usado/sustituido, o tras desactivación, cambio/reseteo de contraseña o logout, es reutilización: 401 `auth.refresh_invalid` y se cierran todas las sesiones del usuario. |
| POST | `/api/v1/auth/logout` | público (refresh token en el cuerpo) | 204 | Revoca el refresh token indicado. |
| GET | `/api/v1/auth/me` | autenticado (cualquier rol) | 200 | Datos del usuario del access token. |
| POST | `/api/v1/auth/change-password` | autenticado (cualquier rol) | 204 | Cambia la contraseña propia (exige la actual) y cierra todas sus sesiones. |
| GET | `/api/v1/users` | `ADMIN` | 200 | Lista los usuarios, ordenados por `username`. |
| POST | `/api/v1/users` | `ADMIN` | 201 | Crea un usuario. |
| GET | `/api/v1/users/{id}` | `ADMIN` | 200 | Detalle de un usuario. |
| PUT | `/api/v1/users/{id}` | `ADMIN` | 200 | Cambia nombre completo, rol y estado (`active`). Desactivar un usuario cierra sus sesiones. Un admin no puede desactivarse ni quitarse el rol `ADMIN`. |
| POST | `/api/v1/users/{id}/reset-password` | `ADMIN` | 204 | Restablece la contraseña de otro usuario y cierra sus sesiones. |
| GET | `/api/v1/products` | `ADMIN`, `OPERATOR` | 200 | Listado paginado `PageResponse<ProductResponse>`. Parámetros: `q` (nombre o SKU, sin distinguir mayúsculas, `%` y `_` literales), `active`, `categoryId` (incluye las subcategorías; inexistente → lista vacía), `type` (`FOOD|CLOTHING|APPLIANCE|OTHER`; desconocido → 400 `validation.failed`), `page` (desde 0), `size` (1-100, 20 por defecto), `sort` (`name`, `sku`, `createdAt` + `,asc`/`,desc`; por defecto `name,asc`). `size`/`page` fuera de rango o de tipo inválido: 400 `validation.failed` con `errors`; `sort` no permitido: 400 `request.invalid_sort`. |
| GET | `/api/v1/products/categories` | (retirado) | 404 | Eliminado en HU-15 (`request.not_found`); usar `GET /api/v1/categories`. |
| GET | `/api/v1/products/{id}` | `ADMIN`, `OPERATOR` | 200 | Detalle. 404 `product.not_found`. |
| POST | `/api/v1/products` | `ADMIN`, `OPERATOR` | 201 | Crea el producto (y su fila `product_stock` en ceros). Cabecera `Location`. 400 `validation.failed`, `product.price_currency_mismatch`, `product.currency_unsupported`; 409 `product.sku_conflict`. |
| PUT | `/api/v1/products/{id}` | `ADMIN`, `OPERATOR` | 200 | Edita (también inactivos). Exige `version`; si no coincide, 409 `resource.version_conflict`. Además los errores del alta y 404. |
| POST | `/api/v1/products/{id}/deactivate` | `ADMIN` | 200 | `active = false`. Idempotente (sin nueva versión si ya estaba inactivo). 403 para `OPERATOR`. |
| POST | `/api/v1/products/{id}/activate` | `ADMIN` | 200 | `active = true`. Idempotente. |
| GET | `/actuator/health` | público | 200 | Estado de la aplicación. Lo usa Render como health check. |
| GET | `/actuator/info` | autenticado | 200 | Información de la aplicación. |
| GET | `/v3/api-docs`, `/swagger-ui.html` | público solo si springdoc está activo | 200 | OpenAPI JSON y Swagger UI. Activos en `dev`/`test` y en staging (`SPRINGDOC_ENABLED=true`). En producción: anónimo → 401; autenticado → 404. |

Consola H2 (`/h2-console`): solo perfil `dev`, no forma parte de la API.

## Cuerpos de petición

| DTO | Campos | Reglas |
|---|---|---|
| `LoginRequest` | `username`, `password` | Obligatorios. |
| `RefreshRequest` | `refreshToken` | Obligatorio. Se usa en `/refresh` y en `/logout`. |
| `ChangePasswordRequest` | `currentPassword`, `newPassword` | Obligatorios. `newPassword` de 8 a 72 caracteres. |
| `CreateUserRequest` | `username`, `password`, `fullName`, `role` | `username`: 3–50 caracteres, solo letras, números, `.`, `-` y `_`, único. `password`: 8–72. `fullName`: hasta 100. `role`: `ADMIN` u `OPERATOR`. |
| `UpdateUserRequest` | `fullName`, `role`, `active` | `fullName` obligatorio, hasta 100. `role` obligatorio. `active` obligatorio (`true`/`false`); si se omite o es `null` responde 400 `validation.failed` con `errors.active` y no se modifica nada (corregido TT-11: antes se omitía como `false` y desactivaba al usuario). |
| `ResetPasswordRequest` | `newPassword` | Obligatorio, 8–72. |

## Cuerpos de respuesta

- `TokenResponse` (login y refresh): `accessToken`, `tokenType`, `expiresIn`, `refreshToken`, `user`.
- `UserResponse` (usuarios y `/me`): `id`, `username`, `fullName`, `role`, `active`, `createdAt`. Nunca incluye la contraseña.

## Cómo crear un usuario

1. Hacer login con un usuario `ADMIN` (`POST /api/v1/auth/login`) y copiar `accessToken`.
2. Llamar a `POST /api/v1/users` con la cabecera `Authorization: Bearer <accessToken>` y un cuerpo como:
   `{"username": "ana.perez", "password": "<mínimo 8 caracteres>", "fullName": "Ana Pérez", "role": "OPERATOR"}`.
3. La respuesta es `201` con el `UserResponse`. El usuario puede entrar ya con esa contraseña.

En Swagger UI (staging o local) el paso 2 se hace con el botón «Authorize» tras el login.
El primer administrador se crea solo al arrancar con la base vacía (ver [backend](README.md#base-de-datos-y-flyway)).

## Productos (HU-02)

Monedas admitidas desde configuración: `app.currencies.supported` (`CUP`, `USD`) y `app.currencies.reference` (`USD`); añadir una moneda no requiere migración.
Comparación exacta (mayúsculas): `usd` responde `product.currency_unsupported`.

**`CreateProductRequest`** (POST): `name` (obligatorio, 1-120), `sku` (opcional, 1-50, `[A-Za-z0-9._-]`; se guarda recortado y en mayúsculas, vacío → `null`, único entre activos e inactivos),
`unit` (`UNIT|KG|LB|G|L|ML`, obligatorio; solo `UNIT` si el tipo es `CLOTHING` o `APPLIANCE`), `categoryId` (obligatorio), `brand` (opcional, ≤ 80), `model` y `warrantyMonths` (opcionales, solo `APPLIANCE`; `warrantyMonths` entero 0-120), `salePrice` (opcional, >= 0, máx. 10 enteros y 2 decimales),
`salePriceCurrency` (obligatoria si hay `salePrice`, y nula si no lo hay), `minStock` (obligatorio, >= 0, máx. 9 enteros y 3 decimales).
**`UpdateProductRequest`** (PUT): los mismos campos más `version` (obligatorio). La normalización (recortar, SKU en mayúsculas) ocurre en el constructor compacto del record, antes de validar.
`active`, `stock` y cualquier otro campo del cuerpo se ignoran.

**`ProductResponse`** (los decimales viajan como número JSON con escala fija: precio 2, cantidades 3, costo 4):
```json
{
  "id": 1, "name": "Arroz", "sku": "ARR-001", "unit": "KG", "type": "FOOD",
  "category": { "id": 1, "name": "Alimentos", "nameEn": "Food", "path": "Alimentos", "pathEn": "Food", "active": true },
  "brand": null, "model": null, "warrantyMonths": null,
  "salePrice": 2.50, "salePriceCurrency": "USD", "minStock": 5.000, "active": true,
  "stock": { "onHand": 0.000, "reserved": 0.000, "available": 0.000, "averageCost": null, "costCurrency": null },
  "lowStock": true, "version": 0,
  "createdAt": "2026-11-07T16:41:31.739103Z", "createdBy": "admin",
  "updatedAt": "2026-11-07T16:41:31.739103Z", "updatedBy": "admin"
}
```
`salePrice`, `salePriceCurrency`, `sku`, `brand`, `model` y `warrantyMonths` son `null` si no hay valor. `lowStock = active && minStock > 0 && available <= minStock`.

**`PageResponse<T>`**: `{ "content": [...], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0 }`. Una página más allá del final devuelve `content` vacío.

## Categorías (HU-15)

Árbol de hasta 3 niveles (`depth` 1 = raíz). `ADMIN` y `OPERATOR` leen; solo `ADMIN` crea, renombra, activa y desactiva. No hay `DELETE` (405).

| Método | Ruta | Rol | OK | Errores |
|---|---|---|---|---|
| GET | `/api/v1/categories?active=true\|false` | ADMIN, OPERATOR | 200 lista plana ordenada por ruta, sin paginar (sin `active` = todas) | 400 `validation.failed` |
| GET | `/api/v1/categories/{id}` | ADMIN, OPERATOR | 200 | 404 `category.not_found` |
| POST | `/api/v1/categories` | ADMIN | 201 + `Location` | 400 `validation.failed`, `category.type_required`, `category.type_inherited`, `category.max_depth`; 404 `category.not_found` (padre); 409 `category.name_conflict`, `category.parent_inactive` |
| PUT | `/api/v1/categories/{id}` | ADMIN | 200 | 400 `validation.failed`; 404; 409 `category.name_conflict`, `resource.version_conflict` |
| POST | `/api/v1/categories/{id}/deactivate` | ADMIN | 200 (idempotente) | 404; 409 `category.has_active_children` |
| POST | `/api/v1/categories/{id}/activate` | ADMIN | 200 (idempotente) | 404; 409 `category.parent_inactive` |

**`CreateCategoryRequest`**: `name` (obligatorio, 1-60, recortado), `nameEn` (opcional, ≤ 60; vacío → `null`), `parentId` (`null` = raíz), `productType` (`FOOD|CLOTHING|APPLIANCE|OTHER`; obligatorio en raíz, prohibido en hija).
**`UpdateCategoryRequest`**: `name`, `nameEn`, `version` (obligatorio). El padre y el tipo no cambian.
Un `PUT` que no cambia ningún valor (mismo `name` y `nameEn`) es un no-op: responde 200 con la misma `version` (no se incrementa); `version + 1` ocurre solo cuando algo cambia. El listado se ordena por ruta con colación española (sin distinguir tildes ni mayúsculas: «Ácidos» antes que «Zumos»).

**`CategoryResponse`**:
```json
{
  "id": 7, "parentId": 1, "name": "Granos", "nameEn": "Grains", "productType": "FOOD", "depth": 2,
  "active": true, "path": "Alimentos › Granos", "pathEn": "Food › Grains", "productCount": 12, "version": 0,
  "createdAt": "2026-11-10T14:00:00Z", "createdBy": "admin", "updatedAt": "2026-11-10T14:00:00Z", "updatedBy": "admin"
}
```
`parentId` y `nameEn` son `null` si no hay. `pathEn` usa `nameEn` de cada nivel o, si falta, `name`. `productCount` = productos (activos e inactivos) asignados directamente a la categoría.
Las 4 raíces sembradas por V4: Alimentos/Food (`FOOD`), Ropa/Clothing (`CLOTHING`), Electrodomésticos/Appliances (`APPLIANCE`), Aseo y hogar/Personal care & home (`OTHER`).

### Cambios en productos (HU-15)
- **Entrada** (`POST`/`PUT`): `category` (texto) se sustituye por `categoryId` (obligatorio); nuevos `brand` (≤ 80), `model` (≤ 80, solo `APPLIANCE`), `warrantyMonths` (entero 0-120, solo `APPLIANCE`). `type` en el cuerpo se ignora. `CLOTHING` y `APPLIANCE` solo admiten `unit = UNIT`. Mover a otro tipo exige enviar `model`/`warrantyMonths` en `null`.
- **Respuesta**: sustituye `category` (texto) por `type` (derivado) y `category` = `{ "id", "name", "nameEn", "path", "pathEn", "active" }`; añade `brand`, `model`, `warrantyMonths` (`null` si no hay):
```json
{ "id": 1, "name": "Nevera", "sku": null, "unit": "UNIT", "type": "APPLIANCE",
  "category": { "id": 3, "name": "Electrodomésticos", "nameEn": "Appliances", "path": "Electrodomésticos", "pathEn": "Appliances", "active": true },
  "brand": "LG", "model": "GR-1", "warrantyMonths": 24, "salePrice": 250.00, "...": "..." }
```
- **Filtros** de `GET /products`: `categoryId` (incluye descendientes; inexistente → lista vacía) y `type`; combinables con `q` y `active`. `type` desconocido → 400 `validation.failed` (`errors.type`).
- **Orden**: `sort` = `name`, `sku` o `createdAt`; `category` → 400 `request.invalid_sort`.
- **Retirado**: `GET /api/v1/products/categories` → 404 `request.not_found`.
- Activar/desactivar un producto es idempotente (200 aunque ya esté en ese estado o en carrera). Un SKU cuyo valor cambiaría al pasar a mayúsculas (`ß`) → 400 `errors.sku`.
