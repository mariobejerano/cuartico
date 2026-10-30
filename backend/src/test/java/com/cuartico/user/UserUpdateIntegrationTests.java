package com.cuartico.user;

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
class UserUpdateIntegrationTests {

	private static final String ADMIN_PASSWORD = "Admin123!test";

	@Autowired
	MockMvc mvc;

	@Test
	void updateWithoutActiveReturns400AndKeepsUserActive() throws Exception {
		String adminToken = adminToken();
		MvcResult login = null;
		int id = createUser(adminToken, "upd_missing");
		login = loginUser("upd_missing");

		mvc.perform(put("/api/v1/users/" + id).header("Authorization", "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"fullName":"Sin Active","role":"OPERATOR"}
						"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.active").value("es obligatorio"));

		// Same for an explicit null
		mvc.perform(put("/api/v1/users/" + id).header("Authorization", "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"fullName":"Sin Active","role":"OPERATOR","active":null}
						"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.active").exists());

		// The user is still active and keeps their session
		mvc.perform(get("/api/v1/users/" + id).header("Authorization", "Bearer " + adminToken))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true));
		String refresh = JsonPath.read(login.getResponse().getContentAsString(), "$.refreshToken");
		mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
				.content("{\"refreshToken\":\"%s\"}".formatted(refresh)))
			.andExpect(status().isOk());
	}

	@Test
	void updateWithActiveTrueAndFalseStillWorks() throws Exception {
		String adminToken = adminToken();
		int id = createUser(adminToken, "upd_toggle");

		mvc.perform(put("/api/v1/users/" + id).header("Authorization", "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"fullName":"Toggle","role":"OPERATOR","active":true}
						"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true))
			.andExpect(jsonPath("$.fullName").value("Toggle"));

		mvc.perform(put("/api/v1/users/" + id).header("Authorization", "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"fullName":"Toggle","role":"OPERATOR","active":false}
						"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false));
	}

	private String adminToken() throws Exception {
		MvcResult r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"admin\",\"password\":\"%s\"}".formatted(ADMIN_PASSWORD)))
			.andExpect(status().isOk())
			.andReturn();
		return JsonPath.read(r.getResponse().getContentAsString(), "$.accessToken");
	}

	private int createUser(String adminToken, String username) throws Exception {
		MvcResult r = mvc.perform(post("/api/v1/users").header("Authorization", "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"username":"%s","password":"Socio123!x","fullName":"Test User","role":"OPERATOR"}
						""".formatted(username)))
			.andExpect(status().isCreated())
			.andReturn();
		return JsonPath.read(r.getResponse().getContentAsString(), "$.id");
	}

	private MvcResult loginUser(String username) throws Exception {
		return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"%s\",\"password\":\"Socio123!x\"}".formatted(username)))
			.andExpect(status().isOk())
			.andReturn();
	}

}
