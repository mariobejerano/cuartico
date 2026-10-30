package com.cuartico.config;

import java.io.IOException;

import com.cuartico.common.ProblemFactory;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Respuestas 401 y 403 generadas por los filtros de Spring Security (fuera de Spring MVC, por lo
 * que el {@code GlobalExceptionHandler} no las ve): también salen como ProblemDetail con
 * {@code code} y {@code detail} traducido.
 */
@Component
public class SecurityErrorHandlers implements AuthenticationEntryPoint, AccessDeniedHandler {

	private final ProblemFactory problems;

	private final JsonMapper jsonMapper;

	/** Pone la cabecera WWW-Authenticate (RFC 6750), con el detalle del error si el token es inválido. */
	private final BearerTokenAuthenticationEntryPoint bearerEntryPoint = new BearerTokenAuthenticationEntryPoint();

	public SecurityErrorHandlers(ProblemFactory problems, JsonMapper jsonMapper) {
		this.problems = problems;
		this.jsonMapper = jsonMapper;
	}

	@Override
	public void commence(HttpServletRequest request, HttpServletResponse response,
			AuthenticationException authException) throws IOException {
		// Fija el estado 401 y WWW-Authenticate; después se escribe el cuerpo
		bearerEntryPoint.commence(request, response, authException);
		write(request, response, HttpStatus.UNAUTHORIZED, "auth.unauthorized");
	}

	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response,
			AccessDeniedException accessDeniedException) throws IOException {
		write(request, response, HttpStatus.FORBIDDEN, "auth.forbidden");
	}

	private void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String code)
			throws IOException {
		ProblemDetail problem = problems.create(status, code, request);
		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.setCharacterEncoding("UTF-8");
		response.getWriter().write(jsonMapper.writeValueAsString(ProblemFactory.toMap(problem)));
	}

}
