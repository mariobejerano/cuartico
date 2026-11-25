/// <reference types="vitest/config" />
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Cabeceras de seguridad del sitio estático de staging, leídas de render/staging.yaml (única fuente de verdad).
 * Solo las usa `npm run preview`: así se prueba el build en local con la CSP real (ADR-004, «CSP»).
 */
function stagingHeaders(): Record<string, string> {
  const file = fileURLToPath(new URL('../render/staging.yaml', import.meta.url))
  if (!existsSync(file)) return {}
  const headers: Record<string, string> = {}
  // Cada cabecera es un par `name: X` / `value: "…"` (o sin comillas) en líneas seguidas.
  const pattern = /name:\s*([\w-]+)[^\n]*\n\s*value:\s*(?:"([^"]*)"|(\S+))/g
  for (const [, name, quoted, plain] of readFileSync(file, 'utf8').matchAll(pattern)) headers[name] = quoted ?? plain
  return headers
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Un build sin URL de la API daría una web que no puede hablar con nadie: mejor fallar aquí.
  if (command === 'build' && !env.VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is required to build (e.g. https://cuartico-api.onrender.com)')
  }
  return {
    // tailwindcss(): genera en el build un .css estático con solo las clases usadas (compatible con style-src 'self').
    plugins: [react(), tailwindcss()],
    // Alias `@/` → `src/` (lo usan los componentes de shadcn/ui; también está en tsconfig.app.json).
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173 },
    preview: { port: 4173, headers: stagingHeaders() },
    build: { outDir: 'dist', sourcemap: false },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      env: { VITE_API_BASE_URL: 'http://api.test' },
    },
  }
})
