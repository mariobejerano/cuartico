# Cuartico — guía del proyecto para Claude y el equipo de agentes

## Qué es
- **Cuartico**: sistema de gestión (back-office) de un negocio cubano que vende **combos** de productos.
  Stock, compras a proveedores, combos (catálogo), pedidos, pagos manuales, clientes, gastos y utilidad.
- **Combazo**: la marca de cara al cliente (tienda web y futuras apps móviles). Usa la misma API y el mismo stock.
- Proyecto de aprendizaje: no hay prisa, se prioriza hacerlo bien y entender cada decisión.
- Quien dirige el proyecto **supervisa** (en adelante, "la supervisión"); el equipo de agentes desarrolla. Nada llega a producción sin su aprobación.

## Fases
1. **Cuartico** (actual): gestión interna.
2. **Combazo catálogo**: web pública con combos disponibles + "Pedir por WhatsApp".
3. **Combazo tienda**: "arma tu combo", pedidos online que llegan a Cuartico.
4. **Móvil**: PWA primero, luego React Native (Expo) con APK para Android (Google Play y App Store no están disponibles en Cuba).

## Stack y estructura
```
cuartico/
├── backend/        Java 17 · Spring Boot 4.1 · Spring Security 7 (JWT HS256) · JPA · Flyway · PostgreSQL (H2 en dev)
├── cuartico-web/   React + TypeScript (Vite) — panel de gestión (pendiente)
├── combazo-web/    React + TypeScript — tienda para clientes (fase 2+)
├── docs/           documentación por rol (ver "Documentación" más abajo)
└── .claude/agents/ definición del equipo de agentes
```
Infraestructura (todo en planes gratuitos): GitHub (repo público) + GitHub Actions · backend en Render (Docker) · PostgreSQL en Neon (solo como base de datos: no usamos Neon Auth ni Functions) · frontends en Vercel.

## Comandos
```bash
cd backend
./mvnw spring-boot:run     # arranca en perfil dev (H2 en ./data, admin inicial en application-dev.yml)
./mvnw test                # tests de integración (H2 en memoria, perfil test)
./mvnw -q -B verify        # lo mismo que corre el CI
```

## Idiomas
- **Código, identificadores, mensajes de commit y nombres de ramas: inglés.**
- **Documentación (README, docs/, ADR) y conversación con la supervisión: español.**
- **La web es bilingüe (es/en) para el usuario final**:
  - Frontend: textos en archivos de traducción (react-i18next), nunca escritos directamente en los componentes.
  - Backend: mensajes al usuario vía `MessageSource` (`messages_es.properties` / `messages_en.properties`) según `Accept-Language`,
    y siempre un código de error estable (p. ej. `auth.invalid_credentials`) en el ProblemDetail.

## Convenciones del backend
- **Paquetes por módulo** (`auth`, `user`, `product`, `combo`, `order`…), no por capa. `config/` y `common/` para lo transversal.
- Controller → Service → Repository. La lógica de negocio vive en el Service. `@Transactional` en el Service.
- **DTOs como `record`** (agrupados en `dto/<Modulo>Dtos.java`). Las entidades JPA nunca salen por la API.
- Validación con Bean Validation (`@Valid`) en los DTOs de entrada.
- Errores: lanzar `ApiException` (o sus fábricas `notFound`, `conflict`…); el `GlobalExceptionHandler` responde ProblemDetail (RFC 9457).
- Entidades de negocio extienden `AuditableEntity` (createdAt/updatedAt/createdBy/updatedBy automáticos desde el JWT).
- **Esquema solo por Flyway** (`db/migration/V<n>__descripcion.sql`), SQL compatible con PostgreSQL y H2 en modo PostgreSQL.
  `ddl-auto=validate`. Nunca modificar una migración ya mergeada: crear una nueva.
- Inyección por constructor, sin Lombok. Inyectar `Clock` en lugar de usar `Instant.now()` directamente.
- Seguridad: endpoints autenticados por defecto; roles `ADMIN` y `OPERATOR` con `@PreAuthorize`.
- API bajo `/api/v1/...` (todos los endpoints). Documentación OpenAPI con springdoc: Swagger UI en `/swagger-ui.html` y JSON en `/v3/api-docs` (activos en `dev` y `test`; en `prod`/staging solo con `SPRINGDOC_ENABLED=true`, que está en `render/staging.yaml`).
- **Errores con código + MessageSource**: `ApiException` no lleva texto, lleva `HttpStatus` + código (`user.not_found`) + argumentos. El texto vive en `src/main/resources/messages_es.properties` (por defecto) y `messages_en.properties`, y se elige por `Accept-Language` (es/en; otro idioma → es). Todo ProblemDetail de error incluye `code` (estable, en inglés) y `detail` traducido; al añadir un error nuevo, añade su código a ambos archivos. Las anotaciones de Bean Validation usan `message = "{clave}"` (nunca texto fijo). Los logs van en inglés.
- Cada funcionalidad viene con tests de integración (MockMvc + perfil `test`) que cubren el camino feliz y los errores.

## Reglas de negocio clave
- **Combos = solo catálogo** (receta: producto × cantidad + precio). Se arman al vender. **El stock se lleva por producto.**
- **Trazabilidad de inventario**: todo cambio de stock es un **movimiento** inmutable (entrada por compra, reserva, salida por venta,
  liberación, ajuste con motivo). Stock disponible = físico − reservado. Costo: **promedio ponderado**. Sin lotes/vencimientos por ahora.
- **Pedido**: `PENDING` (reserva stock) → `CONFIRMED` → `IN_TRANSIT` → `DELIVERED` (descuenta stock); `CANCELLED` libera la reserva.
- **Pago, independiente del pedido** y registrado a mano (no hay cobro online): `UNPAID` → `PARTIALLY_PAID` → `PAID`.
  Cada pago guarda monto, **moneda**, **tasa de cambio del día**, método (efectivo, transferencia, Zelle…) y referencia.
  Diseñado para que en el futuro una pasarela cree el registro de pago automáticamente.
- **Multimoneda** (CUP, USD…): toda operación guarda su moneda y tasa; la utilidad se calcula en una moneda de referencia.

## Git y flujo de trabajo
- Ramas: `main` (producción, siempre estable) · `develop` (integración, se despliega a staging).
- `feature/<nombre>` y `fix/<nombre>` salen de `develop` y vuelven por **PR a `develop` (squash merge)**.
- `develop` → `main` por PR (merge commit): es un *release* a producción.
- `hotfix/<nombre>` sale de `main` y vuelve a `main` y a `develop`.
- Commits en inglés con Conventional Commits: `feat: ...`, `fix: ...`, `test: ...`, `docs: ...`, `refactor: ...`, `chore: ...`, `ci: ...`.

### Quién mergea y cuándo (solo Lupa mergea)
| Destino | Condiciones (todas) | Quién mergea |
|---|---|---|
| `develop` | CI en verde + **APROBADO** de Lupa sobre el SHA exacto del PR + **OK de la supervisión** a ese PR | Lupa (`--squash`; excepción: el PR `main` → `develop` tras un hotfix va con `--merge`) |
| `main` (release) | CI en verde + **LISTO PARA PRODUCCIÓN** de Vera en staging sobre el SHA exacto de `develop` + **OK de la supervisión** a ese release | Lupa (`--merge`) |
| `main` (hotfix) | CI en verde + **APROBADO** de Lupa + verificación de Vera, ambos sobre el SHA exacto + **OK de la supervisión**; después el cambio se lleva a `develop` | Lupa (`--merge`) |

- Los veredictos se publican como **comentario en el PR** con la línea `Revisado: <SHA>` (Lupa) o `Certificado: <SHA>` (Vera).
  Lupa solo mergea si ese SHA coincide con el commit actual del PR, y siempre con `--match-head-commit`. Si llega un commit nuevo, hay que revisar o certificar otra vez.
- Timon abre los PRs (como **borrador**), los pasa a "listo" (`gh pr ready`) al recibir el APROBADO de Lupa, pide los OK a la supervisión y transmite a Lupa el OK con el número de PR. Sin ese OK explícito, nadie mergea.
- Nadie hace push directo ni force-push a `main` o `develop`, ni usa `--admin` o `--auto`. No se reescribe historia publicada.

## Credenciales y seguridad
- **Nunca** escribir secretos en el código, en el repositorio, en logs ni en el chat. Nunca pedir a la supervisión que pegue un secreto.
- La supervisión inicia sesión personalmente en GitHub, Render, Neon y Vercel (OAuth vía GitHub), como mucho una vez al día por plataforma.
  Al empezar la jornada, Timon avisa qué plataformas harán falta; al terminar, se cierran las sesiones de las CLI.
- Los secretos de la app (`DB_*`, `APP_JWT_SECRET`, `APP_ADMIN_*`) viven solo en las variables de entorno de Render (uno distinto por entorno).
- Los valores de `application-dev.yml` y `application-test.yml` son solo para desarrollo local y tests.
- Cada `gh pr merge` muestra una ventana de aprobación a la supervisión (regla `ask` en `.claude/settings.local.json`).
- Pruebas autenticadas en staging: usuario de QA (rol `OPERATOR`) cuya contraseña la supervisión pone en la variable de entorno local
  `STAGING_QA_PASSWORD`. Los agentes la usan solo como `$STAGING_QA_PASSWORD`, sin mostrarla nunca. Nunca se prueba contra producción.

## Metodología: Scrum
- **Product backlog** priorizado en `docs/scrum/product-backlog.md` (lo mantiene Timon con la supervisión).
- **Sprints** en `docs/scrum/sprints/<NN>.md`: objetivo, historias comprometidas, resultado y notas de la **review con la supervisión**.
- La unidad de trabajo es la **historia de usuario completa (vertical slice)**: si requiere backend y frontend, se desarrolla entera
  (análisis, diseño, backend, frontend, QA y documentación) antes de darla por terminada. No se cierran historias "a medias".
- Las tareas técnicas sin valor directo de negocio (infraestructura, refactors) entran al backlog como *tareas técnicas*.

## Documentación (cada rol en su carpeta)
| Carpeta | Contenido | Responsable |
|---|---|---|
| `README.md` (raíz) | Información general: qué es, stack, cómo arrancar, enlaces a `docs/` | Pluto |
| `docs/README.md` | Índice de toda la documentación | Pluto |
| `docs/scrum/` | Product backlog y sprints | Timon |
| `docs/analysis/` | Historias (`stories/`), casos de uso (`use-cases/`), diagramas (`diagrams/`), ADR (`adr/`) | Faro |
| `docs/design/` | Design system y prototipos | Lienzo |
| `docs/development/backend/` | Arquitectura, convenciones, API, códigos de error | Forja-Back |
| `docs/development/frontend/` | Estructura, convenciones, guías de aprendizaje | Forja-Front |
| `docs/devops/` | Despliegue, entornos, CI/CD, configuración de Render/Neon/Vercel | Timon |
| `docs/qa/` | Estrategia de pruebas, matrices CA → tests, certificaciones de staging | Vera |

Si más adelante hace falta otra carpeta, se añade aquí primero.

## El equipo
| Agente | Rol |
|---|---|
| **Timon** (sesión principal) | Orquesta, mantiene el backlog, DevOps (Docker, Actions, Render, Neon, Vercel), abre PRs y pide los OK a la supervisión |
| **Faro** (`faro`) | Analista y arquitecto: historias de usuario, criterios de aceptación, diseño técnico, ADR |
| **Lienzo** (`lienzo`) | Diseñador web y de marca: design system, prototipos HTML, UX móvil, textos de interfaz |
| **Forja-Back** (`forja-back`) | Implementa el backend Spring Boot |
| **Forja-Front** (`forja-front`) | Implementa el frontend React **y enseña a la supervisión** (modo mentor) |
| **Vera** (`vera`) | QA: tests, casos límite, verificación de criterios de aceptación (APTO/NO APTO); **certifica cada release en staging** y verifica los hotfix |
| **Lupa** (`lupa`) | Revisión de código adversaria (contrapeso del desarrollador) y **única integradora**: mergea a `develop` y a `main` según la tabla de arriba. No modifica código |
| **Pluto** (`pluto`) | Documentación: README, guías, diagramas Mermaid, registro de decisiones |

**Flujo de una funcionalidad importante**: Faro (historia + diseño) → Lienzo (prototipo, si hay UI; la supervisión aprueba) →
Forja-Back / Forja-Front → Vera (tests contra criterios: **APTO**) → Pluto (docs) → Timon abre el PR en borrador →
**Lupa** + `/code-review` + `/security-review` (Lupa revisa también la documentación) → OK de la supervisión → Lupa mergea a `develop`.
Si Lupa pide cambios, Forja (o quien corresponda) corrige y Lupa vuelve a revisar. Si tras **3 rondas** siguen bloqueantes o importantes
sin resolver, Lupa lo escala a la supervisión a través de Timon.
**Ningún PR se mergea sin el APROBADO de Lupa**, aunque la funcionalidad sea sencilla. El resto de pasos pueden saltarse en
funcionalidades sencillas; Timon decide y lo dice.

**Flujo de un release**: PRs mergeados en `develop` → despliegue automático a staging → Timon abre el PR `develop` → `main` →
Vera certifica en staging (`Certificado: <SHA>`) → la supervisión da el OK → Lupa mergea → despliegue automático a producción.

## Definición de "terminado"
- Cumple los criterios de aceptación de la historia.
- `./mvnw verify` en verde (y los tests del frontend cuando exista).
- Vera: **APTO**. Lupa: **APROBADO** sobre el commit final (comentario en el PR con `Revisado: <SHA>`).
- Sin secretos ni datos personales en el diff.
- Historia completa: backend **y** frontend cuando la historia lo requiera (vertical slice).
- Documentación de cada rol actualizada en su carpeta de `docs/` (análisis, desarrollo, QA, devops) y el índice al día.
- PR a `develop` con descripción clara (qué, por qué, cómo probarlo).
