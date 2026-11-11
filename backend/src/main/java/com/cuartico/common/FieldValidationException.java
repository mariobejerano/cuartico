package com.cuartico.common;

import java.util.Map;

import org.springframework.http.HttpStatus;

/**
 * A 400 {@code validation.failed} raised from a Service for rules Bean Validation cannot express (they depend on
 * other fields). Same response as a failed {@code @Valid}: an {@code errors} map field -> translated message, where
 * each value is a message code (for example {@code jakarta.validation.constraints.NotNull.message}).
 */
public class FieldValidationException extends ApiException {

	private final transient Map<String, String> fieldMessageCodes;

	public FieldValidationException(String field, String messageCode) {
		super(HttpStatus.BAD_REQUEST, "validation.failed");
		this.fieldMessageCodes = Map.of(field, messageCode);
	}

	public Map<String, String> getFieldMessageCodes() {
		return fieldMessageCodes;
	}

}
