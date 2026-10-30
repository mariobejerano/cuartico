package com.cuartico.config;

import java.util.Base64;
import java.util.List;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Seguridad de la API:
 * <ul>
 * <li>Sin sesiones: cada petición trae un JWT en {@code Authorization: Bearer ...}.</li>
 * <li>Los JWT los firma y valida esta misma app con HMAC-SHA256 (Spring Security OAuth2 Resource
 * Server + Nimbus), sin librerías externas tipo jjwt.</li>
 * <li>El claim {@code roles} se convierte en authorities {@code ROLE_*} para usar
 * {@code @PreAuthorize("hasRole('ADMIN')")}.</li>
 * </ul>
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

	public static final String ROLES_CLAIM = "roles";

	/** Consola H2 solo en desarrollo; necesita frames y no usa JWT. */
	@Bean
	@Order(1)
	@Profile("dev")
	SecurityFilterChain h2ConsoleFilterChain(HttpSecurity http) throws Exception {
		http.securityMatcher("/h2-console/**")
			.authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
			.csrf(csrf -> csrf.disable())
			.headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()));
		return http.build();
	}

	@Bean
	@Order(2)
	SecurityFilterChain apiFilterChain(HttpSecurity http, SecurityErrorHandlers errorHandlers,
			@Value("${springdoc.api-docs.enabled:false}") boolean apiDocsEnabled) throws Exception {
		http.authorizeHttpRequests(auth -> {
				auth.requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/refresh",
						"/api/v1/auth/logout").permitAll();
				auth.requestMatchers("/actuator/health", "/error").permitAll();
				if (apiDocsEnabled) {
					// Documentación OpenAPI y Swagger UI (solo cuando springdoc está habilitado)
					auth.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll();
				}
				auth.anyRequest().authenticated();
			})
			// 401/403 como ProblemDetail con código estable
			.exceptionHandling(ex -> ex.authenticationEntryPoint(errorHandlers).accessDeniedHandler(errorHandlers))
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			// API stateless con token en cabecera (no cookies): CSRF no aplica
			.csrf(csrf -> csrf.disable())
			.cors(Customizer.withDefaults())
			.oauth2ResourceServer(oauth -> oauth
				.authenticationEntryPoint(errorHandlers)
				.accessDeniedHandler(errorHandlers)
				.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));
		return http.build();
	}

	@Bean
	SecretKey jwtSecretKey(AppProperties props) {
		byte[] bytes = Base64.getDecoder().decode(props.jwt().secret());
		if (bytes.length < 32) {
			throw new IllegalStateException("app.jwt.secret must be at least 256 bits (32 bytes, Base64-encoded)");
		}
		return new SecretKeySpec(bytes, "HmacSHA256");
	}

	@Bean
	JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
		return NimbusJwtEncoder.withSecretKey(jwtSecretKey).algorithm(MacAlgorithm.HS256).build();
	}

	@Bean
	JwtDecoder jwtDecoder(SecretKey jwtSecretKey, AppProperties props) {
		NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey).macAlgorithm(MacAlgorithm.HS256).build();
		// Valida expiración + que el emisor sea esta app
		decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(props.jwt().issuer()));
		return decoder;
	}

	private JwtAuthenticationConverter jwtAuthenticationConverter() {
		JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
		authorities.setAuthoritiesClaimName(ROLES_CLAIM);
		authorities.setAuthorityPrefix("ROLE_");
		JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
		converter.setJwtGrantedAuthoritiesConverter(authorities);
		return converter;
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		// {bcrypt} por defecto, con prefijo para poder migrar de algoritmo en el futuro
		return PasswordEncoderFactories.createDelegatingPasswordEncoder();
	}

	/** Usado solo por el login (usuario + contraseña). El resto de la API se autentica con JWT. */
	@Bean
	AuthenticationManager authenticationManager(UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
		DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
		provider.setPasswordEncoder(passwordEncoder);
		return new ProviderManager(provider);
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(AppProperties props) {
		CorsConfiguration config = new CorsConfiguration();
		config.setAllowedOrigins(props.cors().allowedOrigins());
		config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", config);
		return source;
	}

}
