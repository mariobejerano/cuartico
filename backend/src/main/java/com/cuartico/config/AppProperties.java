package com.cuartico.config;

import java.time.Duration;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Configuración propia de la aplicación (prefijo {@code app.*}), tipada y validada al arrancar.
 */
@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(@Valid Jwt jwt, Cors cors, Admin admin) {

	public record Jwt(
			@NotBlank String issuer,
			@NotBlank String secret,
			@NotNull Duration accessTokenTtl,
			@NotNull Duration refreshTokenTtl) {
	}

	public record Cors(List<String> allowedOrigins) {
	}

	public record Admin(String username, String password) {
	}

}
