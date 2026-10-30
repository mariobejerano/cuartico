package com.cuartico.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** CA-9: con springdoc deshabilitado (producción) la documentación no es accesible. */
@SpringBootTest(properties = { "springdoc.api-docs.enabled=false", "springdoc.swagger-ui.enabled=false" })
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiDocsDisabledIntegrationTests {

	@Autowired
	MockMvc mvc;

	@Test
	void docsAreClosedToAnonymousUsers() throws Exception {
		mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
		mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isUnauthorized());
		mvc.perform(get("/swagger-ui.html")).andExpect(status().isUnauthorized());
	}

	@Test
	void docsDoNotExistEvenWhenAuthenticated() throws Exception {
		String login = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"admin\",\"password\":\"Admin123!test\"}"))
			.andReturn().getResponse().getContentAsString();
		String auth = "Bearer " + JsonPath.read(login, "$.accessToken");
		mvc.perform(get("/v3/api-docs").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isNotFound());
	}

}
