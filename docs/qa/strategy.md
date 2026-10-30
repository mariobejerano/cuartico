# Estrategia de pruebas

Responsable: Vera. Registro de certificaciones: [certifications.md](certifications.md).

## Tipos de prueba

| Tipo | Dónde corre | Qué valida |
|---|---|---|
| **Integración con MockMvc y H2** | Local (`./mvnw test`) y CI (`Tests (h2)`) | Controladores, seguridad, validación, errores y lógica de negocio, con el perfil `test` (H2 en memoria, modo PostgreSQL). |
| **Integración con PostgreSQL real** | CI (`Tests (postgres)`) | Las migraciones Flyway y las consultas contra PostgreSQL 18, la misma versión mayor que Neon. Es la variante que detecta diferencias de dialecto que H2 no muestra. |
| **Verificación por historia** | Vera, sobre el PR de cada historia | Cada criterio de aceptación (CA-n) de la historia tiene al menos un test que lo cubra. Resultado: **APTO** o **NO APTO**. |
| **Certificación en staging** | Vera, sobre `cuartico-api-staging` | Antes de cada release (`develop` → `main`), el SHA desplegado en staging se prueba y recibe **LISTO PARA PRODUCCIÓN** o **NO LISTO**. |
| **Verificación de hotfix** | Vera | Los hotfix (`hotfix/*` → `main`) se verifican sobre el SHA exacto antes del merge. |

Todas las funcionalidades deben tener tests de integración con MockMvc que cubran el camino feliz **y** los errores
(convención de [CLAUDE.md](../../CLAUDE.md)).

## Criterios de aceptación y tests

- Cada historia tiene su ficha en `docs/analysis/stories/` (Faro) con los criterios CA-n.
- Vera mantiene la matriz CA → tests por historia en `docs/qa/stories/<NNN>.md` (se crea con la primera historia que se verifique).
- Una historia no se da por terminada sin el APTO de Vera.

## Certificación en staging

1. Timon abre el PR `develop` → `main` cuando los PRs de la release están en `develop` y el despliegue a staging está hecho.
2. Vera prueba **el SHA exacto de `develop`** desplegado en staging.
3. Vera publica en el PR un comentario con la línea `Certificado: <SHA>` y el veredicto.
4. La supervisión da su OK. Solo entonces Lupa mergea a `main`.
5. Si llega un commit nuevo a `develop`, la certificación anterior ya no vale: hay que certificar otra vez.
6. El registro se actualiza en [certifications.md](certifications.md).

Staging usa una base de datos real (rama `staging` de Neon), no una base de pruebas aparte.

## Pruebas autenticadas en staging

- Se usa un **usuario de QA con rol `OPERATOR`** en staging. Nunca `ADMIN`.
- Su contraseña la pone la supervisión en la variable de entorno **local** `STAGING_QA_PASSWORD`. Los agentes la usan solo como
  `$STAGING_QA_PASSWORD`, nunca la imprimen, nunca la escriben en un archivo ni en un comentario de PR.
- Nunca se pide a la supervisión que pegue la contraseña en el chat.
- **Nunca se prueba contra producción.**
- Si una certificación no incluye pruebas autenticadas, el veredicto debe decirlo explícitamente en el alcance.

## Qué no cubre (hoy)

- No hay tests de frontend (todavía no existe `cuartico-web`).
- No hay pruebas de carga ni de rendimiento. En el plan gratuito de Render, la primera petición tras el "sueño" del servicio tarda cerca de un minuto.
- No hay tests contra pasarelas de pago (los pagos son manuales).
