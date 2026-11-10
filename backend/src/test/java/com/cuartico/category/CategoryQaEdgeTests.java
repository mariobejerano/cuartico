package com.cuartico.category;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import com.jayway.jsonpath.JsonPath;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/**
 * QA (Vera) edge cases of HU-15 that the developer tests do not cover: create-child vs deactivate-parent
 * race, integer parsing strictness (accept-float-as-int=false) on every numeric id/version field,
 * overflow, English messages of the new errors, and filter parameter errors.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CategoryQaEdgeTests {

	private static final String CATEGORIES = "/api/v1/categories";

	private static final String PRODUCTS = "/api/v1/products";

	private static String token;

	private static long food;

	private static long appliance;

	private static long clothing;

	@Autowired
	MockMvc mvc;

	@BeforeAll
	static void setUp(@Autowired MockMvc mvc) throws Exception {
		token = CategoryFixtures.login(mvc, "admin", "Admin123!test");
		food = CategoryFixtures.rootId(mvc, token, "FOOD");
		appliance = CategoryFixtures.rootId(mvc, token, "APPLIANCE");
		clothing = CategoryFixtures.rootId(mvc, token, "CLOTHING");
	}

	@Test
	void createChildVersusDeactivateParentNeverLeavesAnActiveChildUnderAnInactiveParent() throws Exception {
		for (int round = 0; round < 8; round++) {
			long parent = idOf(postJson(CATEGORIES, "{\"name\":\"Race-" + UUID.randomUUID() + "\",\"productType\":\"FOOD\"}"));
			CountDownLatch start = new CountDownLatch(1);
			ExecutorService pool = Executors.newFixedThreadPool(2);
			try {
				Future<Integer> create = pool.submit(() -> {
					start.await();
					return send(post(CATEGORIES).content("{\"name\":\"Hija\",\"parentId\":" + parent + "}")).andReturn().getResponse()
						.getStatus();
				});
				Future<Integer> deactivate = pool.submit(() -> {
					start.await();
					return send(post(CATEGORIES + "/" + parent + "/deactivate")).andReturn().getResponse().getStatus();
				});
				start.countDown();
				int created = create.get();
				int deactivated = deactivate.get();
				// Exactly one of the two wins; never 500
				Assertions.assertTrue((created == 201 && deactivated == 409) || (created == 409 && deactivated == 200),
						"round " + round + ": create=" + created + " deactivate=" + deactivated);
			}
			finally {
				pool.shutdownNow();
			}
			String all = mvc.perform(get(CATEGORIES).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
				.andReturn()
				.getResponse()
				.getContentAsString();
			List<Boolean> parentActive = JsonPath.read(all, "$[?(@.id == " + parent + ")].active");
			List<Object> activeChildren = JsonPath.read(all, "$[?(@.parentId == " + parent + " && @.active == true)].id");
			Assertions.assertFalse(!parentActive.get(0) && !activeChildren.isEmpty(),
					"inactive parent with an active child in round " + round);
		}
	}

	@Test
	void fractionalOrOverflowingNumbersAreRejectedNotTruncated() throws Exception {
		long child = idOf(postJson(CATEGORIES, "{\"name\":\"Num-" + UUID.randomUUID() + "\",\"parentId\":" + food + "}"));
		// parentId 1.5 would be truncated to 1 with Jackson defaults
		send(post(CATEGORIES).content("{\"name\":\"X\",\"parentId\":1.5}")).andExpect(status().isBadRequest());
		send(post(CATEGORIES).content("{\"name\":\"X\",\"parentId\":99999999999999999999}"))
			.andExpect(status().isBadRequest());
		// version 0.5 / 1.0 on rename: must not silently become 0 / 1
		send(put(CATEGORIES + "/" + child).content("{\"name\":\"Y\",\"version\":0.5}")).andExpect(status().isBadRequest());
		// products
		String base = "\"name\":\"N\",\"unit\":\"UNIT\",\"minStock\":0";
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":" + food + ".5}")).andExpect(status().isBadRequest());
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":" + appliance + ",\"warrantyMonths\":2147483648}"))
			.andExpect(status().isBadRequest());
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":" + appliance + ",\"warrantyMonths\":12.0}"))
			.andExpect(status().isBadRequest());
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":" + appliance + ",\"warrantyMonths\":\"abc\"}"))
			.andExpect(status().isBadRequest());
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":" + food + ",\"version\":0.5}"))
			.andExpect(status().isCreated());
	}

	@Test
	void attributeLengthsAndNullCategoryIdAreValidated() throws Exception {
		String base = "\"name\":\"L\",\"unit\":\"UNIT\",\"minStock\":0";
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":" + appliance + ",\"brand\":\"" + "b".repeat(81) + "\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.brand").exists());
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":" + appliance + ",\"model\":\"" + "m".repeat(81) + "\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.model").exists());
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":" + appliance + ",\"brand\":\"" + "b".repeat(80)
				+ "\",\"model\":\"  \",\"warrantyMonths\":0}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.model").doesNotExist())
			.andExpect(jsonPath("$.warrantyMonths").value(0));
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":null}")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.categoryId").exists());
		// whitespace-only model on a non-appliance is "empty": normalized to null before the type rule
		send(post(PRODUCTS).content("{" + base + ",\"categoryId\":" + food + ",\"model\":\"   \"}"))
			.andExpect(status().isCreated());
	}

	@Test
	void newErrorsAreTranslatedToEnglish() throws Exception {
		long child = idOf(postJson(CATEGORIES, "{\"name\":\"En-" + UUID.randomUUID() + "\",\"parentId\":" + food + "}"));
		long grand = idOf(postJson(CATEGORIES, "{\"name\":\"G\",\"parentId\":" + child + "}"));
		english(post(CATEGORIES).content("{\"name\":\"Z\",\"parentId\":" + grand + "}"), 400, "category.max_depth");
		english(post(CATEGORIES).content("{\"name\":\"Z\",\"parentId\":" + food + ",\"productType\":\"FOOD\"}"), 400,
				"category.type_inherited");
		english(post(CATEGORIES).content("{\"name\":\"Z\"}"), 400, "category.type_required");
		english(post(CATEGORIES + "/" + child + "/deactivate"), 409, "category.has_active_children");
		send(post(CATEGORIES + "/" + grand + "/deactivate")).andExpect(status().isOk());
		send(post(CATEGORIES + "/" + child + "/deactivate")).andExpect(status().isOk());
		english(post(CATEGORIES).content("{\"name\":\"Z\",\"parentId\":" + child + "}"), 409, "category.parent_inactive");
		english(post(CATEGORIES + "/" + grand + "/activate"), 409, "category.parent_inactive");
		english(post(PRODUCTS).content("{\"name\":\"Z\",\"unit\":\"KG\",\"minStock\":0,\"categoryId\":" + clothing + "}"),
				400, "product.unit_not_allowed");
		english(post(PRODUCTS).content("{\"name\":\"Z\",\"unit\":\"UNIT\",\"minStock\":0,\"categoryId\":" + child + "}"),
				400, "category.inactive");
		english(post(PRODUCTS).content("{\"name\":\"Z\",\"unit\":\"UNIT\",\"minStock\":0,\"categoryId\":987654}"), 400,
				"product.category_not_found");
		english(post(PRODUCTS).content("{\"name\":\"Z\",\"unit\":\"UNIT\",\"minStock\":0,\"categoryId\":" + food
				+ ",\"model\":\"M\"}"), 400, "product.attribute_not_allowed");
	}

	@Test
	void productFilterParameterErrorsAndCombinations() throws Exception {
		String auth = "Bearer " + token;
		mvc.perform(get(PRODUCTS).param("type", "food").header(HttpHeaders.AUTHORIZATION, auth))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.type").exists());
		mvc.perform(get(PRODUCTS).param("categoryId", "abc").header(HttpHeaders.AUTHORIZATION, auth))
			.andExpect(status().isBadRequest());
		mvc.perform(get(PRODUCTS).param("categoryId", "1.5").header(HttpHeaders.AUTHORIZATION, auth))
			.andExpect(status().isBadRequest());
		mvc.perform(get(PRODUCTS).param("categoryId", "-3").header(HttpHeaders.AUTHORIZATION, auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content").isEmpty());
		// Legacy text filter is ignored (unknown parameter), not an error
		mvc.perform(get(PRODUCTS).param("category", "Alimentos").header(HttpHeaders.AUTHORIZATION, auth))
			.andExpect(status().isOk());
	}

	@Test
	void accentsOnlyDifferenceIsAcceptedAsDocumentedButCaseOfAccentsCollides() throws Exception {
		String suffix = UUID.randomUUID().toString().substring(0, 6);
		send(post(CATEGORIES).content("{\"name\":\"Cafe" + suffix + "\",\"parentId\":" + food + "}"))
			.andExpect(status().isCreated());
		send(post(CATEGORIES).content("{\"name\":\"Caf\u00e9" + suffix + "\",\"parentId\":" + food + "}"))
			.andExpect(status().isCreated());
		send(post(CATEGORIES).content("{\"name\":\"CAF\u00c9" + suffix + "\",\"parentId\":" + food + "}"))
			.andExpect(status().isConflict());
		// tabs around the name are trimmed by the DTO (strip), so they collide as well
		send(post(CATEGORIES).content("{\"name\":\"\\tCafe" + suffix + "\\t\",\"parentId\":" + food + "}"))
			.andExpect(status().isConflict());
	}

	// ---------------------------------------------------------------- helpers

	private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder)
			throws Exception {
		return mvc.perform(builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON));
	}

	private void english(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder, int status,
			String code) throws Exception {
		MvcResult r = mvc.perform(builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
			.contentType(MediaType.APPLICATION_JSON)).andReturn();
		String body = r.getResponse().getContentAsString();
		Assertions.assertEquals(status, r.getResponse().getStatus(), code + " " + body);
		Assertions.assertEquals(code, JsonPath.read(body, "$.code"));
		String detail = JsonPath.read(body, "$.detail");
		// No Spanish leftovers and no unresolved placeholders
		Assertions.assertFalse(detail.contains("{0}") || detail.contains("{") || detail.isBlank(), detail);
		Assertions.assertFalse(detail.matches(".*\\b(no se|categor\u00eda inactiva|no admite|ya existe)\\b.*"), detail);
	}

	private long idOf(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder)
			throws Exception {
		MvcResult r = send(builder).andExpect(status().isCreated()).andReturn();
		return ((Number) JsonPath.read(r.getResponse().getContentAsString(), "$.id")).longValue();
	}

	private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder postJson(String url,
			String body) {
		return post(url).content(body);
	}

}
