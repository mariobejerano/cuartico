package com.cuartico.common;

import org.springframework.http.HttpStatus;

/**
 * Error de negocio: estado HTTP + código estable (p. ej. {@code user.not_found}) + argumentos del
 * mensaje. No lleva texto: el {@link GlobalExceptionHandler} traduce el código con el
 * {@code MessageSource} según el idioma de la petición y responde un ProblemDetail (RFC 9457).
 */
public class ApiException extends RuntimeException {

	private final HttpStatus status;

	private final String code;

	private final transient Object[] args;

	public ApiException(HttpStatus status, String code, Object... args) {
		// El mensaje de la excepción es solo para logs de desarrolladores
		super(code);
		this.status = status;
		this.code = code;
		this.args = args;
	}

	public HttpStatus getStatus() {
		return status;
	}

	public String getCode() {
		return code;
	}

	public Object[] getArgs() {
		return args;
	}

	public static ApiException notFound(String code, Object... args) {
		return new ApiException(HttpStatus.NOT_FOUND, code, args);
	}

	public static ApiException conflict(String code, Object... args) {
		return new ApiException(HttpStatus.CONFLICT, code, args);
	}

	public static ApiException badRequest(String code, Object... args) {
		return new ApiException(HttpStatus.BAD_REQUEST, code, args);
	}

	public static ApiException unauthorized(String code, Object... args) {
		return new ApiException(HttpStatus.UNAUTHORIZED, code, args);
	}

}
