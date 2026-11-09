/* eslint-disable react-refresh/only-export-components -- tabla de rutas: aquí no hace falta recarga en caliente */
import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { GuestOnly, RequireAuth } from '../auth/guards'
import { LoginPage } from '../features/login/LoginPage'
import { AppLayout } from '../layout/AppLayout'

// Carga diferida: el código de cada página se descarga solo cuando se visita (bundle inicial más pequeño).
const HomePage = lazy(() => import('../pages/HomePage'))
const ProductsListPage = lazy(() => import('../features/products/ProductsListPage'))
const ProductFormPage = lazy(() => import('../features/products/ProductFormPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

/**
 * Tabla de rutas: es el equivalente a los `@GetMapping` de los controllers, pero en el navegador.
 * Las rutas privadas cuelgan de `RequireAuth` (un filtro de seguridad) y se pintan dentro de `AppLayout`.
 */
export const routes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'products', element: <ProductsListPage /> },
          { path: 'products/new', element: <ProductFormPage /> }, // HU-02 CA-25
          { path: 'products/:id/edit', element: <ProductFormPage /> },
          { path: '*', element: <NotFoundPage /> }, // CA-26
        ],
      },
    ],
  },
]
