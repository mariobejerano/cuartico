package com.cuartico.common;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Errores con código estable e i18n (es por defecto, en con Accept-Language). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ErrorHandlingIntegrationTests {

	private static final String LOGIN = "/api/v1/auth/login";

	private static final String BAD_LOGIN = "{\"username\":\"admin\",\"password\":\"incorrecta\"}";

	@Autowired
	MockMvc mvc;

	@Test
	void invalidCredentialsIsTranslatedByAcceptLanguage() throws Exception {
		mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content(BAD_LOGIN))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("auth.invalid_credentials"))
			.andExpect(jsonPath("$.detail").value("Usuario o contraseña incorrectos"));

		mvc.perform(post(LOGIN).header(HttpHeaders.ACCEPT_LANGUAGE, "es-CU,es;q=0.9")
				.contentType(MediaType.APPLICATION_JSON)
				.content(BAD_LOGIN))
			.andExpect(jsonPath("$.detail").value("Usuario o contraseña incorrectos"));

		mvc.perform(post(LOGIN).header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content(BAD_LOGIN))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("auth.invalid_credentials"))
			.andExpect(jsonPath("$.detail").value("Invalid username or password"));
	}

	@Test
	void unsupportedLanguageFallsBackToSpanish() throws Exception {
		mvc.perform(post(LOGIN).header(HttpHeaders.ACCEPT_LANGUAGE, "fr")
				.contentType(MediaType.APPLICATION_JSON)
				.content(BAD_LOGIN))
			.andExpect(jsonPath("$.detail").value("Usuario o contraseña incorrectos"));
	}

	@Test
	void validationErrorsAreTranslatedPerField() throws Exception {
		mvc.perform(post(LOGIN).header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.detail").value("Invalid data"))
			.andExpect(jsonPath("$.errors.username").value("must not be blank"))
			.andExpect(jsonPath("$.errors.password").value("must not be blank"));

		mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"\"}"))
			.andExpect(jsonPath("$.errors.username").value("no puede estar vacío"));
	}

	@Test
	void sizeAndPatternMessagesAreTranslated() throws Exception {
		String token = adminToken();
		String body = "{\"username\":\"a b\",\"password\":\"corta\",\"fullName\":\"X\",\"role\":\"OPERATOR\"}";

		mvc.perform(post("/api/v1/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.username")
				.value("only letters, digits, dot, hyphen and underscore are allowed"))
			.andExpect(jsonPath("$.errors.password").value("size must be between 8 and 72"));

		mvc.perform(post("/api/v1/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
			.andExpect(jsonPath("$.errors.username").value("solo letras, números, punto, guion y guion bajo"))
			.andExpect(jsonPath("$.errors.password").value("el tamaño debe estar entre 8 y 72"));
	}

	@Test
	void missingTokenReturnsProblemJsonWithWwwAuthenticate() throws Exception {
		mvc.perform(get("/api/v1/auth/me"))
			.andExpect(status().isUnauthorized())
			.andExpect(header().exists(HttpHeaders.WWW_AUTHENTICATE))
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("auth.unauthorized"))
			.andExpect(jsonPath("$.status").value(401))
			.andExpect(jsonPath("$.detail").value("Autenticación requerida o token inválido"));

		mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer basura")
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(status().isUnauthorized())
			.andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, containsString("Bearer")))
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("auth.unauthorized"))
			.andExpect(jsonPath("$.detail").value("Authentication required or invalid token"));
	}

	@Test
	void operatorGetsProblemJsonForbidden() throws Exception {
		String adminToken = adminToken();
		mvc.perform(post("/api/v1/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"operador403\",\"password\":\"Oper12345!\",\"fullName\":\"Op\","
						+ "\"role\":\"OPERATOR\"}"))
			.andExpect(status().isCreated());
		String opToken = JsonPath.read(login("operador403", "Oper12345!"), "$.accessToken");

		mvc.perform(get("/api/v1/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + opToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(status().isForbidden())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("auth.forbidden"))
			.andExpect(jsonPath("$.detail").value("You do not have permission to perform this action"));
	}

	@Test
	void businessErrorsCarryCodeAndArguments() throws Exception {
		String token = adminToken();
		mvc.perform(get("/api/v1/users/999999").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("user.not_found"))
			.andExpect(jsonPath("$.detail").value("Usuario no encontrado: 999999"));

		mvc.perform(get("/api/v1/users/999999").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(jsonPath("$.detail").value("User not found: 999999"));
	}

	@Test
	void malformedJsonReturns400() throws Exception {
		mvc.perform(post(LOGIN).header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{no es json"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("request.malformed"))
			.andExpect(jsonPath("$.detail").value("The request is malformed"));
	}

	@Test
	void unsupportedMediaTypeReturns415() throws Exception {
		mvc.perform(post(LOGIN).contentType(MediaType.TEXT_PLAIN).content("hola"))
			.andExpect(status().isUnsupportedMediaType())
			.andExpect(jsonPath("$.code").value("request.unsupported_media_type"))
			.andExpect(jsonPath("$.detail").value("Tipo de contenido no soportado"));
	}

	@Test
	void methodNotAllowedReturns405() throws Exception {
		String token = adminToken();
		mvc.perform(delete("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(status().isMethodNotAllowed())
			.andExpect(header().exists(HttpHeaders.ALLOW))
			.andExpect(jsonPath("$.code").value("request.method_not_allowed"))
			.andExpect(jsonPath("$.detail").value("HTTP method not allowed for this resource"));
	}

	@Test
	void unexpectedExceptionReturnsGeneric500WithoutLeakingDetails() throws Exception {
		String token = adminToken();
		mvc.perform(get("/api/v1/test/boom").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(status().isInternalServerError())
			.andExpect(jsonPath("$.code").value("internal.error"))
			.andExpect(jsonPath("$.detail").value("Internal server error"))
			.andExpect(content().string(not(containsString("secret internal detail"))))
			.andExpect(content().string(not(containsString("IllegalStateException"))))
			.andExpect(content().string(not(containsString("at com.cuartico"))));
	}

	private String adminToken() throws Exception {
		return JsonPath.read(login("admin", "Admin123!test"), "$.accessToken");
	}

	private String login(String username, String password) throws Exception {
		return mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password)))
			.andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString();
	}

}
