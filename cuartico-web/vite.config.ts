/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Un build sin URL de la API daría una web que no puede hablar con nadie: mejor fallar aquí.
  if (command === 'build' && !env.VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is required to build (e.g. https://cuartico-api.onrender.com)')
  }
  return {
    plugins: [react()],
    server: { port: 5173 },
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
