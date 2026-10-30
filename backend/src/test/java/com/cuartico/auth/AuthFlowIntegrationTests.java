package com.cuartico.auth;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowIntegrationTests {

	private static final String ADMIN_PASSWORD = "Admin123!test";

	@Autowired
	MockMvc mvc;

	@Test
	void loginWithValidCredentialsReturnsTokens() throws Exception {
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginJson("admin", ADMIN_PASSWORD)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accessToken").isNotEmpty())
			.andExpect(jsonPath("$.refreshToken").isNotEmpty())
			.andExpect(jsonPath("$.tokenType").value("Bearer"))
			.andExpect(jsonPath("$.user.role").value("ADMIN"));
	}

	@Test
	void loginWithWrongPasswordReturns401() throws Exception {
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginJson("admin", "incorrecta")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("auth.invalid_credentials"))
			.andExpect(jsonPath("$.detail").value("Usuario o contraseña incorrectos"));
	}

	@Test
	void loginValidatesRequestBody() throws Exception {
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.username").exists())
			.andExpect(jsonPath("$.errors.password").exists());
	}

	@Test
	void protectedEndpointRequiresToken() throws Exception {
		mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer basura")).andExpect(status().isUnauthorized());
	}

	@Test
	void meReturnsCurrentUser() throws Exception {
		String token = accessToken(login("admin", ADMIN_PASSWORD));
		mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.username").value("admin"));
	}

	@Test
	void refreshRotatesTokenAndDetectsReuse() throws Exception {
		MvcResult first = login("admin", ADMIN_PASSWORD);
		String refresh1 = refreshToken(first);

		// Primer uso: OK y entrega un refresh token nuevo
		MvcResult second = mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
				.content(refreshJson(refresh1)))
			.andExpect(status().isOk())
			.andReturn();
		String refresh2 = refreshToken(second);

		// Reutilizar el viejo: 401 y se revocan todas las sesiones...
		mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(refreshJson(refresh1)))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("auth.refresh_invalid"));

		// ...incluido el refresh token nuevo
		mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(refreshJson(refresh2)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void logoutRevokesRefreshToken() throws Exception {
		String refresh = refreshToken(login("admin", ADMIN_PASSWORD));
		mvc.perform(post("/api/v1/auth/logout").contentType(MediaType.APPLICATION_JSON).content(refreshJson(refresh)))
			.andExpect(status().isNoContent());
		mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(refreshJson(refresh)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void adminManagesUsersAndOperatorIsForbidden() throws Exception {
		String adminToken = accessToken(login("admin", ADMIN_PASSWORD));

		MvcResult created = mvc.perform(post("/api/v1/users").header("Authorization", "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"username":"socio","password":"Socio123!x","fullName":"Mi Socio","role":"OPERATOR"}
						"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.role").value("OPERATOR"))
			.andReturn();
		Integer socioId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

		mvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + adminToken))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].username", hasItem("socio")));

		// Usuario duplicado -> 409
		mvc.perform(post("/api/v1/users").header("Authorization", "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"username":"socio","password":"Socio123!x","fullName":"Otro","role":"OPERATOR"}
						"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("user.username_taken"));

		// El operador entra, pero no puede administrar usuarios
		MvcResult socioLogin = login("socio", "Socio123!x");
		String socioToken = accessToken(socioLogin);
		mvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + socioToken))
			.andExpect(status().isForbidden());

		// Al desactivarlo pierde la sesión (su refresh token deja de servir) y no puede volver a entrar
		mvc.perform(put("/api/v1/users/" + socioId).header("Authorization", "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"fullName":"Mi Socio","role":"OPERATOR","active":false}
						"""))
			.andExpect(status().isOk());
		mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
				.content(refreshJson(refreshToken(socioLogin))))
			.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginJson("socio", "Socio123!x")))
			.andExpect(status().isUnauthorized());
	}

	private MvcResult login(String username, String password) throws Exception {
		return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginJson(username, password)))
			.andExpect(status().isOk())
			.andReturn();
	}

	private static String accessToken(MvcResult result) throws Exception {
		return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
	}

	private static String refreshToken(MvcResult result) throws Exception {
		return JsonPath.read(result.getResponse().getContentAsString(), "$.refreshToken");
	}

	private static String loginJson(String username, String password) {
		return "{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password);
	}

	private static String refreshJson(String token) {
		return "{\"refreshToken\":\"%s\"}".formatted(token);
	}

}
