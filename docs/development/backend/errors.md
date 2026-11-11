# Errores de la API
> Aplica a `develop`/staging. Producción (v0.1.0) aún no incluye los códigos ni la traducción; llegarán con la próxima release.

Responsable: Forja-Back. Todas las respuestas de error usan **ProblemDetail (RFC 9457)** con `Content-Type: application/problem+json`.

## Formato

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Usuario no encontrado: 999999",
  "code": "user.not_found"
}
```

- `code`: código **estable en inglés**. El frontend decide por este campo, nunca por `detail`.
- `detail`: texto traducido según la cabecera `Accept-Language`: `es` por defecto; `en` si se pide inglés; cualquier otro idioma responde en `es`.
  Si falta una traducción, `detail` muestra el propio código (nunca rompe la respuesta).
- `errors` (solo en validación, `validation.failed`): mapa `campo → mensaje traducido`. Se incluye el primer error de cada campo.
- `title`: el texto estándar del estado HTTP (en inglés, lo pone Spring).

Los errores de seguridad (401 y 403 que salen de los filtros) siguen el mismo formato: los escribe `SecurityErrorHandlers`
porque fuera de MVC no los captura el `GlobalExceptionHandler`.

## Códigos

Los textos son los de `backend/src/main/resources/messages_es.properties` (es) y `messages_en.properties` (en).

| Código | HTTP | es | en | Cuándo |
|---|---|---|---|---|
| `auth.invalid_credentials` | 401 | Usuario o contraseña incorrectos | Invalid username or password | Login con usuario inexistente, contraseña errónea o usuario desactivado (los tres responden igual). |
| `auth.refresh_invalid` | 401 | Refresh token inválido | Invalid refresh token | Refresh token desconocido o reutilizado fuera de la ventana de gracia (o con el sucesor ya usado/sustituido): se revocan todas las sesiones. Ver "Ventana de gracia" en README.md. |
| `auth.refresh_expired` | 401 | Refresh token expirado | Refresh token expired | Refresh token caducado. |
| `auth.user_disabled` | 401 | Usuario desactivado | User is disabled | Refresh con un token vigente de un usuario desactivado. Caso raro: al desactivar se revocan sus sesiones, así que normalmente responde antes `auth.refresh_invalid`. En login se usa `auth.invalid_credentials`. |
| `auth.unauthorized` | 401 | Autenticación requerida o token inválido | Authentication required or invalid token | Sin token, token inválido o caducado. |
| `auth.forbidden` | 403 | No tienes permisos para realizar esta acción | You do not have permission to perform this action | Rol insuficiente para el endpoint. |
| `user.not_found` | 404 | Usuario no encontrado: {0} | User not found: {0} | `{0}` es el username o el id buscado. |
| `user.username_taken` | 409 | Ya existe un usuario con ese nombre: {0} | A user with that username already exists: {0} | Alta de un username existente. |
| `user.cannot_demote_self` | 400 | No puedes desactivarte ni quitarte el rol de administrador a ti mismo | You cannot deactivate yourself or remove your own administrator role | Un admin intenta desactivarse o quitarse el rol `ADMIN`. |
| `user.wrong_current_password` | 400 | La contraseña actual no es correcta | The current password is incorrect | Cambio de contraseña con una actual errónea. |
| `product.not_found` | 404 | No existe el producto {0}. | Product {0} doesn't exist. | `GET`/`PUT`/activar/desactivar con un id inexistente. |
| `product.sku_conflict` | 409 | Ya existe un producto con el SKU {0}. | A product with SKU {0} already exists. | SKU repetido (activo o inactivo), también en carrera: la restricción `uk_products_sku` es la garantía final. |
| `category.not_found` | 404 | No existe la categoría {0}. | Category {0} doesn't exist. | Consulta/edición/activar/desactivar con id inexistente, o padre inexistente al crear. |
| `category.name_conflict` | 409 | Ya existe una categoría llamada «{0}» en este nivel. | A category named “{0}” already exists at this level. | Nombre repetido entre hermanas (sin distinguir mayúsculas; activas e inactivas; raíces entre sí). También en carrera (`uk_categories_parent_name`). |
| `category.max_depth` | 400 | Las categorías admiten como máximo 3 niveles. | Categories can have at most 3 levels. | Crear una hija bajo una categoría de `depth` 3. |
| `category.inactive` | 400 | La categoría está desactivada: elige una categoría activa. | The category is deactivated: choose an active category. | Asignar a un producto una categoría inactiva (salvo que ya la tenga). |
| `category.parent_inactive` | 409 | La categoría padre está desactivada. | The parent category is deactivated. | Crear una hija bajo un padre inactivo, o reactivar una hija con el padre inactivo. |
| `category.has_active_children` | 409 | No se puede desactivar: tiene subcategorías activas. | It cannot be deactivated: it has active subcategories. | Desactivar una categoría con hijas activas. |
| `category.type_required` | 400 | Indica el tipo de producto de la categoría raíz. | Choose the product type of the root category. | Crear una raíz sin `productType`. |
| `category.type_inherited` | 400 | El tipo se hereda de la categoría raíz: no lo indiques en una subcategoría. | The type is inherited from the root category: do not set it on a subcategory. | Crear una hija enviando `productType` (aunque coincida). |
| `product.category_not_found` | 400 | No existe la categoría {0}. | Category {0} doesn't exist. | `categoryId` inexistente en alta/edición de producto (400 y no 404: el recurso de la URL sí existe). |
| `product.attribute_not_allowed` | 400 | El campo {0} no se admite para este tipo de producto. | The field {0} is not allowed for this product type. | `model` o `warrantyMonths` con valor en un producto que no es `APPLIANCE` (`{0}` = campo). |
| `product.unit_not_allowed` | 400 | Este tipo de producto solo admite la unidad «Unidad». | This product type only admits the unit “Unit”. | `CLOTHING`/`APPLIANCE` con `unit` distinta de `UNIT`. |
| `product.price_currency_mismatch` | 400 | Si indicas un precio, indica también su moneda (y al revés). | If you enter a price, also choose its currency (and vice versa). | `salePrice` sin moneda o moneda sin precio. |
| `product.currency_unsupported` | 400 | La moneda {0} no está admitida. | Currency {0} isn't supported. | Moneda fuera de `app.currencies.supported` (comparación exacta). |
| `resource.version_conflict` | 409 | Otra persona cambió este registro mientras lo editabas. Recárgalo y vuelve a intentarlo. | Someone else changed this record while you were editing. Reload it and try again. | Bloqueo optimista: `version` enviada distinta de la actual, o `ObjectOptimisticLockingFailureException` al hacer flush (transversal a toda la API). |
| `request.invalid_sort` | 400 | Orden no válido: {0} | Invalid sort: {0} | `sort` con un campo fuera de la lista permitida o dirección distinta de `asc`/`desc`. |
| `validation.invalid_value` | (valor de `errors.<campo>`) | valor no válido | invalid value | No es un código de respuesta: es el texto de `errors.<campo>` cuando el valor no se puede convertir al tipo esperado. |
| `validation.failed` | 400 | Datos inválidos | Invalid data | Fallo de Bean Validation en un cuerpo de petición. Incluye `errors`. |
| `request.malformed` | 400 | La petición está mal formada | The request is malformed | JSON mal formado y otros 4xx sin código propio. |
| `request.unsupported_media_type` | 415 | Tipo de contenido no soportado | Unsupported media type | `Content-Type` que el endpoint no acepta (p. ej. `text/plain`). |
| `request.method_not_allowed` | 405 | Método HTTP no permitido para este recurso | HTTP method not allowed for this resource | Método no soportado en la ruta. Incluye la cabecera `Allow`. |
| `request.not_found` | 404 | Recurso no encontrado | Resource not found | Ruta inexistente dentro de MVC. |
| `request.not_acceptable` | 406 | Formato de respuesta no disponible | Response format not available | `Accept` que no se puede servir. |
| `internal.error` | 500 | Error interno del servidor | Internal server error | Excepción no controlada. Al cliente nunca se le envían detalles; la traza va al log. |

### Mensajes de Bean Validation

Las anotaciones usan `message = "{clave}"`; la clave se traduce en los mismos archivos.

| Clave | es | en |
|---|---|---|
| `jakarta.validation.constraints.NotBlank.message` | no puede estar vacío | must not be blank |
| `jakarta.validation.constraints.NotNull.message` | es obligatorio | is required |
| `jakarta.validation.constraints.Size.message` | el tamaño debe estar entre {min} y {max} | size must be between {min} and {max} |
| `user.username.pattern` | solo letras, números, punto, guion y guion bajo | only letters, digits, dot, hyphen and underscore are allowed |
| `product.sku.pattern` | Usa solo letras sin tilde, números, punto (.), guion (-) o guion bajo (_). | Use only unaccented letters, numbers, dot (.), hyphen (-) or underscore (_). |
| `jakarta.validation.constraints.DecimalMin.message` | debe ser mayor o igual que {value} | must be greater than or equal to {value} |
| `jakarta.validation.constraints.Digits.message` | número fuera de rango (máximo {integer} enteros y {fraction} decimales) | number out of range (at most {integer} integer digits and {fraction} decimals) |
| `jakarta.validation.constraints.Min.message` | debe ser mayor o igual que {value} | must be greater than or equal to {value} |
| `jakarta.validation.constraints.Max.message` | debe ser menor o igual que {value} | must be less than or equal to {value} |


### Errores de tipo y de conversión (transversal, desde HU-02)

- Cuerpo JSON con un valor de tipo incorrecto en un campo (`unit = "BOX"`, `minStock = "abc"`, `salePrice = true`): **400 `validation.failed`** con
  `errors.<campo> = validation.invalid_value` traducido (campos anidados con ruta de puntos). Si no hay campo al que asignarlo (cuerpo `[]` o `"texto"`)
  o es JSON con sintaxis inválida o cuerpo vacío, sigue siendo `request.malformed`.
- Parámetros de consulta o de ruta no convertibles (`page=abc`, `active=quizas`, `/products/abc`): **400 `validation.failed`** con `errors.<parámetro>`.
- Violaciones de Bean Validation sobre `ProductQuery` (`size`, `page`): **400 `validation.failed`** con `errors`; nunca se recorta en silencio.
- `ObjectOptimisticLockingFailureException` → **409 `resource.version_conflict`**.

## Cómo añadir un error nuevo

1. **Nombrar el código** como `<modulo>.<motivo>` en inglés y en snake_case (p. ej. `product.not_found`).
2. **Lanzarlo** desde el Service con `ApiException`: `throw ApiException.notFound("product.not_found", id);`
   (o `new ApiException(HttpStatus.X, code, args)` si no hay fábrica para ese estado). Los argumentos se referencian como `{0}`, `{1}`…
3. **Añadir la clave a los dos archivos**, `messages_es.properties` y `messages_en.properties`, con el mismo nombre de clave.
   Si el texto tiene argumentos, una comilla simple se escribe doble (`''`), porque pasa por `MessageFormat`.
   `MessageBundlesTests` falla si las claves no coinciden.
4. **Testear** el camino de error con MockMvc: comprobar `status`, `code` y `detail` en `es` y en `en`.
5. **Documentarlo** en la tabla de este archivo.

Los logs van siempre en inglés y no forman parte del texto de cara al usuario.

## Limitaciones conocidas

Pendientes en el [product backlog](../../scrum/product-backlog.md) (TT-02 a TT-05):

- `HandlerMethodValidationException` (validación de parámetros) responde `request.malformed` sin `errors`.
- 413 (payload demasiado grande) responde `request.malformed`; le falta un código propio.
- Los 401 lanzados como `ApiException.unauthorized` no llevan la cabecera `WWW-Authenticate`.
- Los errores que pasan por `/error` usan el formato por defecto de Spring Boot, no ProblemDetail.
