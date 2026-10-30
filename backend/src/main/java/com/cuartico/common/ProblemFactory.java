package com.cuartico.common;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.LocaleResolver;

/**
 * Construye los ProblemDetail de error: {@code detail} traducido según {@code Accept-Language} y
 * la propiedad {@code code} estable (en inglés). Lo usan el manejador global y los manejadores
 * de seguridad (que corren fuera de Spring MVC).
 */
@Component
public class ProblemFactory {

	private final MessageSource messages;

	private final LocaleResolver localeResolver;

	public ProblemFactory(MessageSource messages, LocaleResolver localeResolver) {
		this.messages = messages;
		this.localeResolver = localeResolver;
	}

	public Locale localeOf(HttpServletRequest request) {
		return localeResolver.resolveLocale(request);
	}

	public ProblemDetail create(HttpStatusCode status, String code, Locale locale, Object... args) {
		// Si falta la traducción, se muestra el propio código (nunca rompe la respuesta de error)
		String detail = messages.getMessage(code, args, code, locale);
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setProperty("code", code);
		return problem;
	}

	public ProblemDetail create(HttpStatusCode status, String code, HttpServletRequest request, Object... args) {
		return create(status, code, localeOf(request), args);
	}

	/** Cuerpo JSON equivalente al ProblemDetail, para escribirlo a mano fuera de Spring MVC. */
	public static Map<String, Object> toMap(ProblemDetail problem) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("type", problem.getType() != null ? problem.getType().toString() : "about:blank");
		body.put("title", problem.getTitle());
		body.put("status", problem.getStatus());
		body.put("detail", problem.getDetail());
		if (problem.getProperties() != null) {
			body.putAll(problem.getProperties());
		}
		return body;
	}

}
