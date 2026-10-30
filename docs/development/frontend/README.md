# Frontend: desarrollo

Responsable: Forja-Front. **Estado: pendiente.** Todavía no existe `cuartico-web/` ni `combazo-web/` (ver TT-08 e HU-01 en el [backlog](../../scrum/product-backlog.md)).

## Stack previsto

- React + TypeScript con Vite.
- `cuartico-web/`: panel de gestión (fase 1). `combazo-web/`: tienda para clientes (fase 2 en adelante). Ambos en Vercel.
- Consumen la API de [`docs/development/backend/api.md`](../backend/api.md) y tratan los errores por su `code`
  (ver [errors.md](../backend/errors.md)).

## Acuerdos que ya rigen (de `CLAUDE.md`)

- **Web bilingüe (es/en) para el usuario final.** Los textos van en archivos de traducción con react-i18next. Nunca escritos directamente en los componentes.
- **Design system**: lo define Lienzo en [`docs/design/`](../../design/README.md). Los componentes se construyen a partir de él, no a mano en cada pantalla.
- **Código, identificadores y commits en inglés**; esta documentación en español.
- **Modo mentor**: Forja-Front explica a la supervisión cada decisión mientras la implementa.
- **Historias completas (vertical slice)**: una historia con interfaz se cierra con backend, frontend y QA juntos.

## Cuando exista el proyecto

Este documento se ampliará con: estructura de carpetas, cómo arrancar en local, cómo correr los tests del frontend, la
convención de traducciones y las guías de aprendizaje de la supervisión.
