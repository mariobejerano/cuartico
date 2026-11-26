import { z } from 'zod'

// CSP (`script-src 'self'`, sin 'unsafe-eval'): Zod prueba `new Function("")` para compilar validadores más rápidos;
// la CSP lo bloquea y el navegador registra una violación aunque Zod capture el error. `jitless` evita esa prueba
// (validan igual, algo más despacio). Va en un módulo propio, importado el PRIMERO en main.tsx, porque los `import`
// se ejecutan antes que el cuerpo de main.tsx y los esquemas se crean al importarse.
z.config({ jitless: true })
