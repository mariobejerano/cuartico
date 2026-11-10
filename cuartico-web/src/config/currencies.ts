/**
 * Monedas admitidas en los precios (TT-14, Lupa PR #10). **Único sitio del frontend** donde se listan.
 *
 * Deben coincidir con `app.currencies.supported` del backend (`application.yml`). Hoy la API no expone esa lista
 * (no hay `GET /api/v1/config`); cuando la exponga (propuesta: con HU-08), este archivo pasará a ser solo el valor
 * de reserva mientras carga. Hasta entonces, añadir una moneda = cambiar `application.yml` **y** esta constante.
 *
 * Si un producto ya guardado trae una moneda que no está aquí, el formulario la añade a la lista para no perderla.
 */
export const CURRENCIES = ['CUP', 'USD'] as const

/** Moneda preseleccionada en un producto nuevo: siempre USD (decisión de la supervisión, 2026-11-05). */
export const DEFAULT_CURRENCY = 'USD'
