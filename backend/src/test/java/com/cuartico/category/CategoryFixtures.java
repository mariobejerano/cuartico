package com.cuartico.category;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.jayway.jsonpath.JsonPath;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Test helpers: ids of the four seeded roots (V4) and creation of throw-away subcategories. */
public final class CategoryFixtures {

	private CategoryFixtures() {
	}

	public static String login(MockMvc mvc, String username, String password) throws Exception {
		MvcResult r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password)))
			.andExpect(status().isOk())
			.andReturn();
		return JsonPath.read(r.getResponse().getContentAsString(), "$.accessToken");
	}

	/** Id of the seeded root of that type (exactly one exists unless a test created more roots). */
	public static long rootId(MockMvc mvc, String token, String type) throws Exception {
		MvcResult r = mvc.perform(get("/api/v1/categories").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(status().isOk())
			.andReturn();
		// The seeded roots have the lowest ids (V4 inserts them first)
		java.util.List<Number> ids = JsonPath.read(r.getResponse().getContentAsString(),
				"$[?(@.parentId == null && @.productType == '" + type + "')].id");
		return ids.stream().mapToLong(Number::longValue).min().orElseThrow();
	}

	/** Creates a subcategory with a unique name under the parent and returns its id. */
	public static long createChild(MockMvc mvc, String adminToken, long parentId, String prefix) throws Exception {
		String name = prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
		MvcResult r = mvc.perform(post("/api/v1/categories").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"%s\",\"parentId\":%d}".formatted(name, parentId)))
			.andExpect(status().isCreated())
			.andReturn();
		return ((Number) JsonPath.read(r.getResponse().getContentAsString(), "$.id")).longValue();
	}

}
