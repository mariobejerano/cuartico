package com.cuartico.common;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.springframework.beans.TypeMismatchException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.exc.MismatchedInputException;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Todas las respuestas de error salen como ProblemDetail (application/problem+json) con una
 * propiedad {@code code} estable (en inglés, para que el frontend decida) y un {@code detail}
 * traducido según {@code Accept-Language}.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	private final ProblemFactory problems;

	public GlobalExceptionHandler(ProblemFactory problems) {
		this.problems = problems;
	}

	@ExceptionHandler(ApiException.class)
	ResponseEntity<ProblemDetail> handleApi(ApiException ex, HttpServletRequest request) {
		ProblemDetail problem = problems.create(ex.getStatus(), ex.getCode(), request, ex.getArgs());
		if (ex instanceof FieldValidationException fields) {
			Locale locale = problems.localeOf(request);
			Map<String, String> errors = new LinkedHashMap<>();
			fields.getFieldMessageCodes().forEach((field, code) -> errors.put(field, problems.message(code, locale)));
			problem.setProperty("errors", errors);
		}
		return ResponseEntity.status(ex.getStatus()).body(problem);
	}

	@ExceptionHandler({ BadCredentialsException.class, DisabledException.class })
	ResponseEntity<ProblemDetail> handleLogin(AuthenticationException ex, HttpServletRequest request) {
		// Mismo mensaje para usuario inexistente, contraseña errónea o usuario desactivado
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
			.body(problems.create(HttpStatus.UNAUTHORIZED, "auth.invalid_credentials", request));
	}

	/**
	 * {@code @PreAuthorize} lanza estas excepciones desde dentro del controlador (no llegan al
	 * AccessDeniedHandler de Spring Security); sin estos manejadores el de {@code Exception} las
	 * convertiría en 500.
	 */
	@ExceptionHandler(AccessDeniedException.class)
	ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.FORBIDDEN)
			.body(problems.create(HttpStatus.FORBIDDEN, "auth.forbidden", request));
	}

	@ExceptionHandler(AuthenticationException.class)
	ResponseEntity<ProblemDetail> handleAuthentication(AuthenticationException ex, HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
			.header(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
			.body(problems.create(HttpStatus.UNAUTHORIZED, "auth.unauthorized", request));
	}

	/** Errores de @Valid: mapa campo -> mensaje traducido en la propiedad "errors". */
	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		Map<String, String> errors = new LinkedHashMap<>();
		Locale locale = localeOf(request);
		for (FieldError e : ex.getBindingResult().getFieldErrors()) {
			// El mensaje de Bean Validation ya viene interpolado y traducido (ver messages_*.properties).
			// Un fallo de conversión de tipo (p. ej. page=abc) trae un texto técnico de Spring: se reemplaza.
			String message = e.isBindingFailure() ? invalidValue(locale) : e.getDefaultMessage();
			errors.putIfAbsent(e.getField(), message);
		}
		return validationFailed(errors, locale);
	}

	/** Parámetro de ruta o de consulta con un tipo que no se puede convertir (p. ej. /products/abc). */
	@Override
	protected ResponseEntity<Object> handleTypeMismatch(TypeMismatchException ex, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		Locale locale = localeOf(request);
		String field = ex.getPropertyName() != null ? ex.getPropertyName() : "value";
		if (ex instanceof MethodArgumentTypeMismatchException mismatch) {
			field = mismatch.getName();
		}
		return validationFailed(Map.of(field, invalidValue(locale)), locale);
	}

	@Override
	protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		// Error de tipo de Jackson con campo conocido (unit="BOX", minStock="abc"): es un error de validación
		if (ex.getCause() instanceof MismatchedInputException mismatch && !mismatch.getPath().isEmpty()) {
			Locale locale = localeOf(request);
			return validationFailed(Map.of(fieldPath(mismatch), invalidValue(locale)), locale);
		}
		// Sintaxis inválida, cuerpo vacío o cuerpo que no es un objeto (sin campo al que asignar el error)
		return respond(HttpStatus.BAD_REQUEST, "request.malformed", headers, request);
	}

	/** Dos ediciones simultáneas del mismo registro: la residual que no atrapa la comprobación de versión. */
	@ExceptionHandler(ObjectOptimisticLockingFailureException.class)
	ResponseEntity<ProblemDetail> handleOptimisticLock(ObjectOptimisticLockingFailureException ex,
			HttpServletRequest request) {
		log.warn("Optimistic locking conflict on {} {}", request.getMethod(), request.getRequestURI());
		return ResponseEntity.status(HttpStatus.CONFLICT)
			.body(problems.create(HttpStatus.CONFLICT, "resource.version_conflict", request));
	}

	private ResponseEntity<Object> validationFailed(Map<String, String> errors, Locale locale) {
		ProblemDetail problem = problems.create(HttpStatus.BAD_REQUEST, "validation.failed", locale);
		problem.setProperty("errors", errors);
		return ResponseEntity.badRequest().body(problem);
	}

	private String invalidValue(Locale locale) {
		return problems.message("validation.invalid_value", locale);
	}

	/** Ruta del campo con puntos para anidados; los índices de lista se escriben entre corchetes. */
	private static String fieldPath(MismatchedInputException ex) {
		StringBuilder path = new StringBuilder();
		for (JacksonException.Reference ref : ex.getPath()) {
			if (ref.getPropertyName() != null) {
				if (!path.isEmpty()) {
					path.append('.');
				}
				path.append(ref.getPropertyName());
			}
			else if (ref.getIndex() >= 0) {
				path.append('[').append(ref.getIndex()).append(']');
			}
		}
		return path.toString();
	}

	@Override
	protected ResponseEntity<Object> handleHttpMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		return respond(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "request.unsupported_media_type", headers, request);
	}

	@Override
	protected ResponseEntity<Object> handleHttpRequestMethodNotSupported(HttpRequestMethodNotSupportedException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		// headers incluye "Allow" con los métodos permitidos
		return respond(HttpStatus.METHOD_NOT_ALLOWED, "request.method_not_allowed", headers, request);
	}

	/** Resto de errores de Spring MVC (404 sin recurso, parámetros que faltan, etc.). */
	@Override
	protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
			HttpStatusCode statusCode, WebRequest request) {
		String code = switch (statusCode.value()) {
			case 404 -> "request.not_found";
			case 406 -> "request.not_acceptable";
			default -> statusCode.is4xxClientError() ? "request.malformed" : "internal.error";
		};
		if (statusCode.is5xxServerError()) {
			log.error("Unhandled Spring MVC exception", ex);
		}
		return respond(statusCode, code, headers, request);
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ProblemDetail> handleUnexpected(Exception ex, HttpServletRequest request) {
		// Se registra la traza completa, pero al cliente nunca se le devuelven detalles internos
		log.error("Unhandled exception on {} {}", request.getMethod(), request.getRequestURI(), ex);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
			.body(problems.create(HttpStatus.INTERNAL_SERVER_ERROR, "internal.error", request));
	}

	private ResponseEntity<Object> respond(HttpStatusCode status, String code, HttpHeaders headers,
			WebRequest request) {
		ProblemDetail problem = problems.create(status, code, localeOf(request));
		return ResponseEntity.status(status).headers(headers).body(problem);
	}

	private Locale localeOf(WebRequest request) {
		return problems.localeOf(((ServletWebRequest) request).getRequest());
	}

}
