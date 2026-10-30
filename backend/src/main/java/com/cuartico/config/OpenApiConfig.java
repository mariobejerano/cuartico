package com.cuartico.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Metadatos de la documentación OpenAPI y esquema bearer JWT (botón "Authorize" de Swagger UI). */
@Configuration
public class OpenApiConfig {

	static final String BEARER_SCHEME = "bearerAuth";

	@Bean
	OpenAPI cuarticoOpenApi(ObjectProvider<BuildProperties> buildProperties) {
		// build-info.properties lo genera Maven; si se ejecuta sin él (IDE) se usa "dev"
		BuildProperties build = buildProperties.getIfAvailable();
		String version = build != null ? build.getVersion() : "dev";
		return new OpenAPI()
			.info(new Info().title("Cuartico API")
				.version(version)
				.description("API de gestión de Cuartico (stock, combos, pedidos, pagos). Usa POST /api/v1/auth/login "
						+ "y pulsa «Authorize» con el accessToken."))
			.components(new Components().addSecuritySchemes(BEARER_SCHEME,
					new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
			.addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME));
	}

}
