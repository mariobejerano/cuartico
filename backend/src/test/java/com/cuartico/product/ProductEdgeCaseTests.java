package com.cuartico.product;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.cuartico.category.CategoryFixtures;

import com.jayway.jsonpath.JsonPath;

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

/** HU-02 QA: boundary and regression cases on top of {@link ProductIntegrationTests}. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductEdgeCaseTests {

	private static final String PRODUCTS = "/api/v1/products";

	private static String adminToken;

	private static long foodId;

	@Autowired
	MockMvc mvc;

	@BeforeAll
	static void tokens(@Autowired MockMvc mvc) throws Exception {
		MvcResult r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"admin\",\"password\":\"Admin123!test\"}"))
			.andExpect(status().isOk())
			.andReturn();
		adminToken = JsonPath.read(r.getResponse().getContentAsString(), "$.accessToken");
		foodId = CategoryFixtures.rootId(mvc, adminToken, "FOOD");
	}

	@Test
	void lengthBoundaries() throws Exception {
		create("{\"name\":\"" + "x".repeat(121) + "\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.name").exists());
		create("{\"name\":\"A\",\"sku\":\"" + "S".repeat(51) + "\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.sku").exists());
		create("{\"name\":\"A\",\"sku\":\"" + ("S".repeat(40) + UUID.randomUUID().toString().substring(0, 10))
				+ "\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0}")
			.andExpect(status().isCreated());
		create("{\"name\":\"A\",\"brand\":\"" + "b".repeat(81) + "\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.brand").exists());
		create("{\"name\":\"A\",\"brand\":\"" + "b".repeat(80) + "\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0}")
			.andExpect(status().isCreated());
	}

	@Test
	void numericBoundaries() throws Exception {
		create(json("A", "9999999999.99", "USD", "0")).andExpect(status().isCreated());
		create(json("A", "10000000000", "USD", "0")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.salePrice").exists());
		create(json("A", "0", "CUP", "0")).andExpect(status().isCreated());
		create(json("A", "-0.01", "USD", "0")).andExpect(status().isBadRequest());
		create(json("A", null, null, "1.234")).andExpect(status().isCreated());
		create(json("A", null, null, "1.2345")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.minStock").exists());
		create(json("A", null, null, "-0.001")).andExpect(status().isBadRequest());
	}

	@Test
	void priceIsNotRoundedSilently() throws Exception {
		create(json("A", "1.005", "USD", "0")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.salePrice").exists());
		create(json("A", "1.50", "USD", "0")).andExpect(status().isCreated())
			.andExpect(jsonPath("$.salePrice").value(1.5));
	}

	@Test
	void unitIsCaseSensitiveAndNullRejectedAndAllSixAccepted() throws Exception {
		create("{\"name\":\"A\",\"categoryId\":@C,\"unit\":\"kg\",\"minStock\":0}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"));
		create("{\"name\":\"A\",\"unit\":null,\"minStock\":0}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.unit").exists());
		for (String u : new String[] { "UNIT", "KG", "LB", "G", "L", "ML" }) {
			create("{\"name\":\"A\",\"categoryId\":@C,\"unit\":\"" + u + "\",\"minStock\":0}").andExpect(status().isCreated());
		}
	}

	@Test
	void skuWithInternalSpaceOrAccentIsRejected() throws Exception {
		create("{\"name\":\"A\",\"sku\":\"AB 1\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.sku").exists());
		create("{\"name\":\"A\",\"sku\":\"AÑO\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.sku").exists());
	}

	@Test
	void searchIsAccentSensitiveAsDocumented() throws Exception {
		String tag = "qz" + UUID.randomUUID().toString().substring(0, 6);
		create("{\"name\":\"Azúcar " + tag + "\",\"categoryId\":@C,\"unit\":\"KG\",\"minStock\":0}").andExpect(status().isCreated());
		search("azucar " + tag).andExpect(jsonPath("$.totalElements").value(0));
		search("Azúcar " + tag).andExpect(jsonPath("$.totalElements").value(1));
	}

	@Test
	void backslashAndQuoteInSearchAreLiteralAndDoNotFail() throws Exception {
		for (String q : new String[] { "\\", "\\%", "'", "' OR 1=1 --", "_", "%_%", "a\\" }) {
			search(q).andExpect(status().isOk());
		}
		String tag = "bs" + UUID.randomUUID().toString().substring(0, 6);
		create("{\"name\":\"Back\\\\slash " + tag + "\",\"categoryId\":@C,\"unit\":\"KG\",\"minStock\":0}").andExpect(status().isCreated());
		search("\\slash " + tag).andExpect(jsonPath("$.totalElements").value(1));
		search("_").andExpect(jsonPath("$.content[*].name").value(not(hasItem("Arroz"))));
	}

	@Test
	void whitespaceOnlyQueryAndCategoryDoNotBreak() throws Exception {
		mvc.perform(get(PRODUCTS).param("q", "   ").param("categoryId", "  ")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isOk());
	}

	@Test
	void sortDirectionIsCaseInsensitive() throws Exception {
		mvc.perform(get(PRODUCTS).param("sort", "name,DESC").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isOk());
	}

	@Test
	void garbageTokenIs401AndOtherModulesKeepTheirErrorShape() throws Exception {
		mvc.perform(get(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer garbage"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("auth.unauthorized"));
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"));
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{x"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("request.malformed"));
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"admin\",\"password\":\"mala\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("auth.invalid_credentials"));
		mvc.perform(get("/api/v1/users/999999").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("user.not_found"));
	}

	@Test
	void updateWithBadVersionIsRejected() throws Exception {
		MvcResult r = create(json("V", null, null, "0")).andExpect(status().isCreated()).andReturn();
		int id = JsonPath.read(r.getResponse().getContentAsString(), "$.id");
		mvc.perform(put(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(fix("{\"name\":\"V\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0,\"version\":-1}")))
			.andExpect(status().is4xxClientError());
		mvc.perform(put(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(fix("{\"name\":\"V\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0,\"version\":\"x\"}")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.version").exists());
	}

	private static String fix(String json) {
		return json.replace("@C", String.valueOf(foodId));
	}

	private ResultActions search(String q) throws Exception {
		return mvc.perform(get(PRODUCTS).param("q", q).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private ResultActions create(String body) throws Exception {
		return mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
			.contentType(MediaType.APPLICATION_JSON)
			.content(fix(body)));
	}

	private static String json(String name, String price, String currency, String minStock) {
		return "{\"name\":\"%s\",\"categoryId\":@C,\"unit\":\"UNIT\",\"salePrice\":%s,\"salePriceCurrency\":%s,\"minStock\":%s}"
			.formatted(name, price == null ? "null" : price, currency == null ? "null" : "\"" + currency + "\"",
					minStock);
	}

}
