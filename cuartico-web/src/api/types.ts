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

// ===== Productos (HU-02) — equivalen a los `record` de `product/dto/ProductDtos.java` =====

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

export interface ProductResponse {
  id: number
  name: string
  sku: string | null
  unit: UnitOfMeasure
  category: string | null
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
  category: string | null
  salePrice: number | null
  salePriceCurrency: string | null
  minStock: number
}

/** Cuerpo de `PUT /products/{id}`: lo mismo + la versión que se editó (bloqueo optimista, CA-9). */
export interface UpdateProductRequest extends CreateProductRequest {
  version: number
}

/** Parámetros de `GET /products` (CA-17 a CA-21). `page` empieza en 0, como en la API. */
export interface ProductListParams {
  q?: string
  active?: boolean
  category?: string
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
