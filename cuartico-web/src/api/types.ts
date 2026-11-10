/**
 * Tipos de la API (contrato del backend, ver docs/development/backend/api.md).
 * Escritos a mano y en un único sitio hasta que generemos los tipos desde OpenAPI (`/v3/api-docs`).
 * Son el equivalente a los `record` de `dto/AuthDtos.java`.
 */

export type Role = 'ADMIN' | 'OPERATOR'

export interface UserResponse {
  id: number
  username: string
  fullName: string
  role: Role
  active: boolean
  createdAt: string
}

export interface TokenResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  refreshToken: string
  user: UserResponse
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RefreshRequest {
  refreshToken: string
}

/** ProblemDetail (RFC 9457) con las extensiones de Cuartico (`code`, `errors`). */
export interface ProblemDetail {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  errors?: Record<string, string>
}

// ===== Productos — equivalen a los `record` de `product/dto/ProductDtos.java` =====

/** Unidades de medida (`UnitOfMeasure`). El texto visible sale de `unit.<CÓDIGO>` en los archivos de traducción. */
export const UNITS = ['UNIT', 'KG', 'LB', 'G', 'L', 'ML'] as const
export type UnitOfMeasure = (typeof UNITS)[number]

/** Stock y costo de solo lectura (tabla `product_stock`, ADR-002). En HU-02 siempre 0 / `null`. */
export interface StockSummary {
  onHand: number
  reserved: number
  available: number
  averageCost: number | null
  costCurrency: string | null
}

// ===== Categorías y tipos de producto (HU-15) — equivalen a `category/dto/CategoryDtos.java` =====

/** Tipos de producto (`ProductType`). Cada categoría hereda el de su raíz. Texto visible: `product_type.<CÓDIGO>`. */
export const PRODUCT_TYPES = ['FOOD', 'CLOTHING', 'APPLIANCE', 'OTHER'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

/** Una categoría tal como la devuelve `GET /categories` (lista plana, ordenada por `path`). `depth` 1 = raíz. */
export interface CategoryResponse {
  id: number
  parentId: number | null
  name: string
  nameEn: string | null
  productType: ProductType
  depth: number
  active: boolean
  /** «Alimentos › Granos», con los nombres en español. */
  path: string
  /** Lo mismo con `nameEn` de cada nivel (o `name` si falta). */
  pathEn: string
  /** Productos asignados directamente (sin contar subcategorías). */
  productCount: number
  version: number
  createdAt: string
  createdBy: string | null
  updatedAt: string
  updatedBy: string | null
}

/** Cuerpo de `POST /categories`. Raíz: `parentId = null` y `productType` obligatorio; hija: SIN `productType` (CA-3). */
export interface CreateCategoryRequest {
  name: string
  nameEn: string | null
  parentId: number | null
  productType?: ProductType
}

/** Cuerpo de `PUT /categories/{id}`: solo se renombra (CA-8). */
export interface UpdateCategoryRequest {
  name: string
  nameEn: string | null
  version: number
}

/** Categoría resumida dentro de un producto (CA-15). */
export interface CategoryRef {
  id: number
  name: string
  nameEn: string | null
  path: string
  pathEn: string
  active: boolean
}

export interface ProductResponse {
  id: number
  name: string
  sku: string | null
  unit: UnitOfMeasure
  category: CategoryRef
  /** Derivado de la categoría (CA-15): se lee, nunca se envía. */
  type: ProductType
  brand: string | null
  /** Solo en `APPLIANCE` (CA-16). */
  model: string | null
  /** Solo en `APPLIANCE`, entero 0–120 (CA-16). */
  warrantyMonths: number | null
  salePrice: number | null
  salePriceCurrency: string | null
  minStock: number
  active: boolean
  stock: StockSummary
  lowStock: boolean
  version: number
  createdAt: string
  createdBy: string | null
  updatedAt: string
  updatedBy: string | null
}

/** Cuerpo de `POST /products`. Los decimales viajan como número JSON. */
export interface CreateProductRequest {
  name: string
  sku: string | null
  unit: UnitOfMeasure
  categoryId: number
  brand: string | null
  model: string | null
  warrantyMonths: number | null
  salePrice: number | null
  salePriceCurrency: string | null
  minStock: number
}

/** Cuerpo de `PUT /products/{id}`: lo mismo + la versión que se editó (bloqueo optimista, CA-9). */
export interface UpdateProductRequest extends CreateProductRequest {
  version: number
}

/** Parámetros de `GET /products` (HU-02 CA-17 a CA-21, HU-15 CA-19). `page` empieza en 0, como en la API. */
export interface ProductListParams {
  q?: string
  active?: boolean
  /** Incluye también las subcategorías (lo resuelve el backend). */
  categoryId?: number
  type?: ProductType
  page: number
  size: number
  sort: 'name,asc' | 'name,desc'
}

/** Página genérica (`common/dto/PageResponse`). */
export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
