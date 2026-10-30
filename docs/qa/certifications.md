# Registro de certificaciones de staging

Responsable: Vera. Cada release (`develop` → `main`) se certifica en staging antes del OK de la supervisión.
Método y reglas: [strategy.md](strategy.md#certificación-en-staging).

## Veredictos

- **LISTO PARA PRODUCCIÓN**: el SHA desplegado en staging cumple lo esperado.
- **NO LISTO**: hay fallos bloqueantes. No se mergea a `main`.

## Entradas

### Release v0.1.0

| Campo | Valor |
|---|---|
| Release | v0.1.0 (primera release a producción) |
| SHA certificado (`develop`) | `7e18b69` |
| Commit en `main` tras el merge | `ab4b546` |
| Veredicto | **LISTO PARA PRODUCCIÓN** |
| Alcance | Pruebas no autenticadas en staging. **Sin pruebas autenticadas** en esta certificación. |
| Fecha | 2026-10-29 |
| PR de release | #4 |

Contenido de la release: lo que había en `develop` hasta `7e18b69`. El PR #5 (`5f236b6`) llegó después y no forma parte de esta certificación.

Pendiente antes de la siguiente release: certificar con pruebas autenticadas usando el usuario de QA de staging
(ver [strategy.md](strategy.md#pruebas-autenticadas-en-staging)).

---

<!-- Plantilla para nuevas entradas:

### Release vX.Y.Z

| Campo | Valor |
|---|---|
| Release | vX.Y.Z |
| SHA certificado (`develop`) | `<SHA>` |
| Veredicto | LISTO PARA PRODUCCIÓN / NO LISTO |
| Alcance | <qué se probó; si hubo pruebas autenticadas> |
| Fecha | <AAAA-MM-DD> |
| PR de release | #<número> |

Hallazgos: <lista breve, o "ninguno">
-->
