/**
 * Ruta de retorno tras el login (HU-01 CA-6). Solo se aceptan rutas INTERNAS:
 * empiezan por `/`, no por `//` ni `/\`, no contienen `\`, ni caracteres de control, ni esquema, y no son `/login`.
 * Cualquier otra cosa devuelve `null` (y se va al inicio): así evitamos una redirección abierta
 * (`/login?redirect=https://evil.com`), el clásico truco de phishing.
 */
export function safeRedirect(value: string | null | undefined): string | null {
  if (!passesBasicRules(value)) return null

  // Segunda red de seguridad: el navegador debe resolverla en nuestro mismo origen.
  const base = 'https://cuartico.invalid'
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return null
  }
  if (url.origin !== base) return null
  const normalized = url.pathname + url.search + url.hash
  // `new URL` resuelve `/.`, `/a/..` y `%2e`: `/.//evil.com` acabaría en `//evil.com`, que el navegador
  // trataría como OTRO origen. Por eso las reglas se vuelven a aplicar sobre el resultado normalizado.
  if (!passesBasicRules(normalized)) return null
  if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return null
  return normalized
}

function passesBasicRules(value: string | null | undefined): value is string {
  if (!value || !value.startsWith('/')) return false
  if (value.startsWith('//') || value.startsWith('/\\')) return false
  if (value.includes('\\')) return false
  // Barras codificadas (`%2f`, `%5c`): no las necesita ninguna ruta del panel y abren variantes raras.
  if (/%(2f|5c)/i.test(value)) return false
  // eslint-disable-next-line no-control-regex -- justamente buscamos caracteres de control (\t, \n…)
  if (/[\u0000-\u001f\u007f]/.test(value)) return false
  return true
}

/** Construye `/login?redirect=…` para volver luego a `path` (ya incluye la búsqueda, p. ej. `?q=arroz`). */
export function loginPathFor(path: string): string {
  const safe = safeRedirect(path)
  return safe && safe !== '/' ? `/login?redirect=${encodeURIComponent(safe)}` : '/login'
}
