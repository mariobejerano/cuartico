/**
 * Ruta de retorno tras el login (HU-01 CA-6). Solo se aceptan rutas INTERNAS:
 * empiezan por `/`, no por `//` ni `/\`, no contienen `\`, ni caracteres de control, ni esquema, y no son `/login`.
 * Cualquier otra cosa devuelve `null` (y se va al inicio): así evitamos una redirección abierta
 * (`/login?redirect=https://evil.com`), el clásico truco de phishing.
 */
export function safeRedirect(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  if (value.includes('\\')) return null
  // eslint-disable-next-line no-control-regex -- justamente buscamos caracteres de control (\t, \n…)
  if (/[\u0000-\u001f\u007f]/.test(value)) return null

  // Segunda red de seguridad: el navegador debe resolverla en nuestro mismo origen.
  const base = 'https://cuartico.invalid'
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return null
  }
  if (url.origin !== base) return null
  if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return null
  return url.pathname + url.search + url.hash
}

/** Construye `/login?redirect=…` para volver luego a `path` (ya incluye la búsqueda, p. ej. `?q=arroz`). */
export function loginPathFor(path: string): string {
  const safe = safeRedirect(path)
  return safe && safe !== '/' ? `/login?redirect=${encodeURIComponent(safe)}` : '/login'
}
