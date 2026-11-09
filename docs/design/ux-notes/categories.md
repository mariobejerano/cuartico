# Notas de UX · Categorías (HU-15)

> Prototipo: [`prototypes/categories.html`](../prototypes/categories.html) · Textos: [`copy.md` §8](../copy.md#8-categorías-hu-15)
> **Estado: Aprobado (2026-11-09)**, con un ajuste ya aplicado: el tipo `OTHER` se muestra como «Aseo y hogar». Aprobados también la pestaña «Más» para ADMIN.
> Historia: [HU-15](../../analysis/stories/HU-15-categories-and-type-attributes.md) (CA-1 a CA-12, CA-24, CA-25, CA-28) · Decisión: [ADR-003](../../analysis/adr/ADR-003-categories-types-variants.md).
> En el prototipo, **⚙ Prototipo** cambia rol, respuestas de la API (incluidas las carreras que el frontend no puede provocar), conexión y tema.
> Los duplicados se detectan de verdad contra los datos: prueba «granos» dentro de Alimentos (error) o «Lacteos» (aviso).

## 1. Dónde vive la página (navegación)

| Ancho | Entrada «Categorías» | Por qué |
|---|---|---|
| Escritorio / tablet | Barra lateral, debajo de «Productos», **solo ADMIN** | Es parte del catálogo; al lado de Productos se encuentra sin buscar. |
| Móvil | Hoja **«Más»** (antes «Cuenta»), sección «Gestión», **solo ADMIN** | Es un módulo ocasional (se usa al montar el catálogo, no a diario). Aplica lo ya aprobado en el design system §7.8: «Cuenta» pasa a «Más» cuando llega el primer módulo ocasional. |
| OPERATOR | No ve la entrada (CA-24). Si llega por URL: pantalla «No tienes acceso a esta página» + [Ir a productos] | Explica el porqué y da salida; no un 404 engañoso. |

**Decisión a aprobar:** la pestaña de la barra inferior se llama **«Más»** (icono de menú) para ADMIN y sigue siendo **«Cuenta»** para OPERATOR,
porque a él la hoja solo le muestra su cuenta (llamarla «Más» prometería algo que no hay). Cuando HU-14 añada «Usuarios» seguirá siendo
solo ADMIN; si algún día el OPERATOR tiene un módulo ocasional, pasa también a «Más».

## 2. El árbol

**Flujo**: entrar → ver las 4 categorías principales con sus subcategorías desplegadas → «Añadir subcategoría» / «Renombrar» / «Desactivar» en la fila.

| Decisión | Por qué |
|---|---|
| Una **tarjeta por categoría principal**, con sus subcategorías como lista anidada y una guía vertical por nivel | Las 4 raíces son los 4 «mundos» del negocio (y su tipo); separarlas en tarjetas se lee de un vistazo en móvil. |
| Lista anidada `<ul>` con encabezados (`h2` raíz, `h3` resto), **no** `role="tree"` | El árbol es corto y siempre está desplegado; `role="tree"` exige navegar con flechas y gestionar el foco, algo que nadie espera aquí. El lector ya anuncia «lista, nivel 2». |
| Siempre desplegado, sin plegar/desplegar | Son decenas de filas; plegar añade toques y esconde lo que se busca. Si crece mucho, se añade un buscador antes que plegar. |
| El tipo solo se ve en la raíz, como etiqueta gris «Tipo: Ropa» (CA-25) | Es información, no un estado; repetirlo en cada hija sería ruido (lo heredan todas). |
| Segunda línea con el nombre en el otro idioma («EN: Grains»); si falta el inglés, «Sin nombre en inglés» en cursiva | La fase 3 del ADR pide completar `name_en`: así el ADMIN ve de un vistazo cuáles faltan, sin abrir cada una. |
| Nombre mostrado según el idioma de la interfaz (`nameEn ?? name`, CA-28) y orden alfabético por ese nombre | Lo que ves es lo que se ordena; en inglés el orden cambia y es lo esperable. |
| Inactivas **ocultas por defecto**, casilla «Mostrar inactivas (2)» arriba | El árbol del día a día es el de las activas; el contador avisa de que hay más. Como una categoría con hijas activas no se puede desactivar, ocultar una inactiva nunca esconde una activa. |
| Inactiva: nombre atenuado + etiqueta «Inactiva» | Texto además de color (design system §7.5). |
| Escritorio: acciones como botones de texto en la fila (`ghost sm`); móvil: un botón «⋯» de 44 px que abre una **hoja de acciones** con título (ruta) y botones grandes | Tres botones por fila no caben a 360 px con sangría de 3 niveles. La hoja reutiliza el patrón de la hoja de cuenta. El «⋯» lleva `aria-label` «Acciones de «Granos»». |
| «Añadir subcategoría» se oculta en el nivel 3 y en las inactivas (CA-25); en la hoja móvil se explica con una nota («Último nivel: no admite subcategorías») | En escritorio, la ausencia se entiende por la sangría; en la hoja hay sitio para decir por qué. |
| Tras crear, la fila nueva se ilumina un instante (fondo de marca suave que se desvanece; fijo si *reduced motion*) | Muestra dónde ha quedado sin mover el foco ni hacer scroll. |

## 3. Crear y renombrar (un diálogo)

**Un solo diálogo «Nueva categoría»** sirve para raíces y subcategorías:

| Campo | Comportamiento | Por qué |
|---|---|---|
| Categoría superior | Select nativo: «Ninguna (categoría principal)» + rutas de las **activas de nivel 1 y 2** (`Alimentos › Granos`). Desde «Añadir subcategoría» llega preseleccionada y el foco va directo al nombre | Un único flujo para todo; desde la fila son 2 toques + escribir. Solo se ofrecen padres válidos: el error de profundidad (CA-4) no se puede provocar desde la UI. |
| Tipo de producto | Solo si no hay categoría superior. Select obligatorio con ayuda «Decide qué datos pide cada producto. No se puede cambiar después.» | Avisar de que es definitivo antes de elegir (no se mueve ni se cambia de tipo). |
| Tipo heredado | Si hay categoría superior: recuadro con candado «Tipo: Alimentos (lo hereda de «Alimentos»)» | El usuario entiende de dónde sale; nunca se envía `productType` en una hija (CA-3). |
| Nombre en español | Obligatorio, ≤ 60 | Es la clave de unicidad. |
| Nombre en inglés | Opcional, ≤ 60, `lang="en"`; ayuda «Si lo dejas vacío, en inglés se muestra el nombre en español.» | Explica el *fallback* (CA-28) para que no se sienta obligatorio. |

**Renombrar** usa el mismo diálogo sin «Categoría superior» ni tipo editable; muestra el tipo con candado y la nota
«No se puede mover a otra categoría ni cambiar su tipo.» (CA-8). Botón «Guardar nombre».

**Botones**: [Cancelar] [Crear categoría] / [Guardar nombre]; en móvil, hoja inferior con botones a ancho completo.

### Validación y errores
| Caso | Qué se ve |
|---|---|
| Nombre vacío / > 60 | Error en el campo al salir de él y al enviar (foco al primero). |
| **Duplicado en el mismo padre** (CA-6) | Error en el campo «Nombre» **al salir del campo**, sin esperar al servidor: «Ya existe «Granos» dentro de «Alimentos».» (raíz: «Ya existe una categoría principal llamada «Ropa».»). El árbol ya está cargado, así que la comprobación es gratis. El 409 `category.name_conflict` del servidor se pinta igual. Cuentan también las inactivas. |
| **Parecido, sin tildes** («Lacteos» junto a «Lácteos») | **Aviso ámbar, no bloquea**: «Se parece a «Lácteos», que ya existe aquí. Si es la misma, no la crees otra vez.» La BD solo ignora mayúsculas (`LOWER`), no tildes: ver [§6 nota 1](#6-notas-para-faro). |
| `category.max_depth` (400) o `category.parent_inactive` (409): solo por carrera (otro ADMIN cambió el árbol) | Error en el campo «Categoría superior»; el árbol se pone al día. |
| `resource.version_conflict` al renombrar | Alerta roja en el diálogo + [Recargar categoría] (trae el nombre actual; lo escrito se pierde, igual que en productos). |
| Red / servidor dormido | Alerta en el diálogo con [Reintentar]; a los 5 s, aviso «El servidor se está despertando». |
| Guardando | Botón con spinner «Guardando…», deshabilitado. |

Éxito: el diálogo se cierra, toast «Categoría «Arroz» creada.» / «Categoría renombrada.», el foco vuelve al botón que lo abrió.

## 4. Desactivar y activar (CA-9, CA-10)

| Caso | Qué se ve | Por qué |
|---|---|---|
| Sin hijas activas | Diálogo «¿Desactivar «Pastas»?» + qué implica («No se podrá elegir en productos nuevos… Los productos que ya la tienen la conservan…») + [Cancelar] [Desactivar] (primario, **no rojo**: es reversible). Toast con [Deshacer]. | Igual que productos (aprobado). |
| **Con hijas activas** | El frontend lo sabe antes de llamar: diálogo informativo «Todavía no se puede desactivar «Alimentos»» · «Primero desactiva sus subcategorías activas: «Aceites y grasas», «Bebidas»… y 7 más.» + [Entendido] | Mejor explicar el bloqueo y qué hacer que dejar pulsar y fallar. El 409 `category.has_active_children` (carrera) se muestra como toast de error. |
| Activar con la superior inactiva | Diálogo «Primero activa «Alimentos › Confituras»» + explicación + [Entendido] | Mismo patrón; evita el 409 `category.parent_inactive`. |
| Activar (caso normal) | Sin confirmación, toast «…activada.» | Activar no es arriesgado (como en productos). |

## 5. Estados de la página

| Estado | Qué se ve |
|---|---|
| Cargando | Skeleton de 3 tarjetas; `aria-busy` |
| 5 s sin respuesta | Alerta «El servidor se está despertando…» |
| Error 5xx / de red | Igual que productos: icono, título, `detail`, código para soporte, [Reintentar] |
| Vacío | No existe: la migración V4 crea siempre las 4 raíces (CA-1) |
| Sin conexión | Alerta ámbar persistente |
| OPERATOR | «No tienes acceso a esta página» + [Ir a productos] |

**Datos de ejemplo**: incluyen «Alimentos › Confituras › Mermeladas», ambas inactivas, para ver el filtro y los bloqueos.
La migración V4 lleva los textos «aseo», «limpieza» e «higiene» a la raíz «Aseo y hogar» y «calzado» a «Ropa» (cambio de Faro), así que
no hace falta limpieza manual tras migrar.

## 6. Notas para Faro

1. **Duplicados con tildes.** La tarea pedía «sin distinguir mayúsculas/acentos», pero HU-15 CA-6 y ADR-003 usan `LOWER(TRIM(name))`:
   «Lácteos» y «LÁCTEOS» chocan, **«Lacteos» y «Lácteos» no**. El prototipo lo trata con un aviso no bloqueante. Si se quiere bloquear,
   haría falta normalizar también las tildes en `name_key` (`unaccent` en PostgreSQL no existe en H2; habría que calcularlo en Java y
   perder la «normalización en un solo sitio»). Recomiendo **dejar el aviso** y no tocar el modelo.
2. **Navegación.** CA-24/CA-25 dicen quién ve la página, no dónde está la entrada. Propongo añadir a CA-25: «entrada en la barra lateral
   (solo ADMIN) y, en móvil, en la hoja «Más»; para ADMIN la pestaña «Cuenta» pasa a llamarse «Más»» (alineado con design system §7.8 y HU-14 CA-1).
3. **Número de productos por categoría** (opcional). El diálogo de desactivar diría «12 productos la conservan» si `GET /categories`
   devolviera `productCount` (un `GROUP BY` barato). No es imprescindible; si se descarta, el texto actual sirve.
4. ~~Migración del texto «Aseo».~~ **Resuelta por Faro (2026-11-09):** alias aseo/limpieza/higiene → «Aseo y hogar»; calzado → «Ropa».
5. **`name_en` sin unicidad.** Dos hermanas pueden llamarse igual en inglés («Grains»). No lo bloqueo; si molesta, aviso como el de tildes.
