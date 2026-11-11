package com.cuartico.product;

import static org.hamcrest.Matchers.contains;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * HU-16, QA edge cases beyond the developer tests: the extra fields a client might send to {@code enable}, edits of a
 * variant that collide with SKUs and options, SKU normalisation across products and variants, a weighted average with
 * mixed cost data, and the English texts of every new error code.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductVariantQaEdgeTests {

	private static final String PRODUCTS = "/api/v1/products";

	private static String adminToken;

	private static long foodId;

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@BeforeAll
	static void setUp(@Autowired MockMvc mvc) throws Exception {
		adminToken = CategoryFixtures.login(mvc, "admin", "Admin123!test");
		foodId = CategoryFixtures.rootId(mvc, adminToken, "FOOD");
	}

	@Test
	void enableIgnoresUnknownFieldsSoSkuAndThresholdOfTheBodyNeverReplaceTheStoredOnes() throws Exception {
		String sku = unique("ENX");
		long id = idOf(create(simple("Convertible", sku, "7")));
		// A client that also sends sku/minStock: no 400, and nothing is overwritten
		postJson(PRODUCTS + "/" + id + "/variants/enable",
				"{\"size\":\" m \",\"color\":\"Rojo\",\"sku\":\"OTHER-SKU\",\"minStock\":99}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.hasVariants").value(true))
			.andExpect(jsonPath("$.variants[0].sku").value(sku))
			.andExpect(jsonPath("$.variants[0].minStock").value(7))
			.andExpect(jsonPath("$.variants[0].size").value("M"))
			.andExpect(jsonPath("$.variants[0].color").value("Rojo"));
	}

	@Test
	void enableValidatesItsBody() throws Exception {
		long id = idOf(create(simple("Convertible2", null, "0")));
		postJson(PRODUCTS + "/" + id + "/variants/enable", "{}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("variant.options_required"));
		postJson(PRODUCTS + "/" + id + "/variants/enable", "{\"size\":\"  \",\"color\":\"\"}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("variant.options_required"));
		postJson(PRODUCTS + "/" + id + "/variants/enable", "{\"size\":\"" + "X".repeat(21) + "\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.size").exists());
		postJson(PRODUCTS + "/" + id + "/variants/enable", "{\"color\":\"" + "c".repeat(31) + "\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.color").exists());
		postJson(PRODUCTS + "/99999999/variants/enable", "{\"size\":\"M\"}").andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("product.not_found"));
		// Still simple after all the failures, same version
		getP(id).andExpect(jsonPath("$.hasVariants").value(false)).andExpect(jsonPath("$.version").value(0));
	}

	@Test
	void editingAVariantCollidesWithSkusAndOptionsButNeverWithItself() throws Exception {
		String skuA = unique("EDA");
		String skuB = unique("EDB");
		create(withVariants("Ajeno", "[" + variant(skuB, "S", "Verde", "1") + "]")).andExpect(status().isCreated());
		long id = idOf(create(withVariants("Editable",
				"[" + variant(skuA, "M", "Rojo", "1") + "," + variant(null, "L", "Rojo", "1") + "]")));
		long m = variantId(id, "M");
		long l = variantId(id, "L");
		String base = PRODUCTS + "/" + id + "/variants/";

		// Own SKU in lower case and own options with another case: no self-conflict, version + 1
		putJson(base + m, "{\"sku\":\"" + skuA.toLowerCase() + "\",\"size\":\"m\",\"color\":\"ROJO\",\"minStock\":2,\"version\":0}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.variants[?(@.id == " + m + ")].version").value(contains(1)))
			.andExpect(jsonPath("$.variants[?(@.id == " + m + ")].color").value(contains("ROJO")));
		// The SKU of a variant of another product
		putJson(base + l, "{\"sku\":\"" + skuB + "\",\"size\":\"L\",\"color\":\"Rojo\",\"minStock\":1,\"version\":0}")
			.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("product.sku_conflict"));
		// The options of the sibling
		putJson(base + l, "{\"sku\":null,\"size\":\"M\",\"color\":\"rojo\",\"minStock\":1,\"version\":0}")
			.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("variant.options_conflict"));
		// No options left
		putJson(base + l, "{\"sku\":null,\"size\":\" \",\"color\":null,\"minStock\":1,\"version\":0}")
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("variant.options_required"));
		// Negative / overflowing threshold, missing version
		putJson(base + l, "{\"sku\":null,\"size\":\"L\",\"color\":\"Rojo\",\"minStock\":-1,\"version\":0}")
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.minStock").exists());
		putJson(base + l, "{\"sku\":null,\"size\":\"L\",\"color\":\"Rojo\",\"minStock\":1234567890,\"version\":0}")
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.minStock").exists());
		putJson(base + l, "{\"sku\":null,\"size\":\"L\",\"color\":\"Rojo\",\"minStock\":1}")
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.version").exists());
		// The failed edits left the variant untouched
		getP(id).andExpect(jsonPath("$.variants[?(@.id == " + l + ")].version").value(contains(0)));
		// A deactivated variant can still be edited (it keeps its data) and stays inactive
		postNoBody(base + l + "/deactivate").andExpect(status().isOk());
		putJson(base + l, "{\"sku\":null,\"size\":\"L\",\"color\":\"Azul\",\"minStock\":3,\"version\":1}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.variants[?(@.id == " + l + ")].active").value(contains(false)));
	}

	@Test
	void skuIsNormalisedAndUniqueAcrossSimpleProductsAndVariants() throws Exception {
		String core = unique("SK");
		long a = idOf(create(simple("Norm", "  " + core.toLowerCase() + "  ", "0")));
		getP(a).andExpect(jsonPath("$.sku").value(core));
		create(simple("Espacio", "AB CD", "0")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.sku").exists());
		// A variant cannot take the SKU of a simple product (case and spaces ignored), nor the other way round
		create(withVariants("ConVar", "[" + variant(" " + core.toLowerCase() + " ", "M", null, "0") + "]"))
			.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("product.sku_conflict"));
		String vsku = unique("VS");
		long v = idOf(create(withVariants("ConVar2", "[" + variant(vsku, "M", null, "0") + "]")));
		create(simple("Simple2", vsku.toLowerCase(), "0")).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"));
		// Updating a simple product to the SKU of a variant is a conflict; keeping its own is fine
		putJson(PRODUCTS + "/" + a, update("Norm", vsku, 0)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"));
		putJson(PRODUCTS + "/" + a, update("Norm", core, 0)).andExpect(status().isOk());
		// hasVariants / variants in the PUT body of a product with variants are ignored; it keeps its variants
		putJson(PRODUCTS + "/" + v, "{\"name\":\"ConVar2\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":false,\"variants\":[],\"version\":0}"
			.formatted(foodId))
			.andExpect(status().isOk()).andExpect(jsonPath("$.hasVariants").value(true))
			.andExpect(jsonPath("$.variantCount").value(1));
	}

	@Test
	void searchTreatsPercentAndUnderscoreInSkusAsLiterals() throws Exception {
		String tag = "Q" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
		create(withVariants("Literal " + tag, "[" + variant(tag + "_1", "M", null, "0") + "," + variant(tag + "-2", "L", null, "0") + "]"))
			.andExpect(status().isCreated());
		list("q=" + tag + "_").andExpect(jsonPath("$.totalElements").value(1));
		list("q=" + tag + "%25").andExpect(jsonPath("$.totalElements").value(0));
	}

	@Test
	void weightedCostIgnoresVariantsWithoutCostAndKeepsNullWhenCostedOnesAreEmpty() throws Exception {
		long id = idOf(create(withVariants("Mixto " + unique("MX"),
				"[" + variant(null, "M", null, "0") + "," + variant(null, "L", null, "0") + "]")));
		long m = variantId(id, "M");
		long l = variantId(id, "L");
		// M has cost but no units; L has units but no cost: nothing to weigh -> null, no currency
		jdbc.update("update variant_stock set on_hand = 0, average_cost = 5.0000, cost_currency = 'USD' where variant_id = ?", m);
		jdbc.update("update variant_stock set on_hand = 10 where variant_id = ?", l);
		getP(id).andExpect(jsonPath("$.stock.onHand").value(10))
			.andExpect(jsonPath("$.stock.averageCost").doesNotExist())
			.andExpect(jsonPath("$.stock.costCurrency").doesNotExist());
		list("q=Mixto").andExpect(jsonPath("$.content[0].stock.averageCost").doesNotExist());
		// Once M has units, the average is M's cost alone (L has no cost to weigh)
		jdbc.update("update variant_stock set on_hand = 2 where variant_id = ?", m);
		getP(id).andExpect(jsonPath("$.stock.averageCost").value(5.0)).andExpect(jsonPath("$.stock.costCurrency").value("USD"));
		list("q=Mixto").andExpect(jsonPath("$.content[0].stock.averageCost").value(5.0));
	}

	@Test
	void everyNewErrorCodeHasAnEnglishTextAndUnknownLanguagesFallBackToSpanish() throws Exception {
		long simple = idOf(create(simple("EnSimple", null, "0")));
		long multi = idOf(create(withVariants("EnMulti",
				"[" + variant(null, "M", null, "0") + "," + variant(null, "L", null, "0") + "]")));
		long vId = variantId(multi, "M");
		String en = "en";
		expectDetail(post(PRODUCTS + "/" + simple + "/variants/disable"), en, 409, "product.no_variants");
		expectDetail(post(PRODUCTS + "/" + multi + "/variants/disable"), en, 409, "product.has_multiple_variants");
		expectDetail(post(PRODUCTS + "/" + multi + "/variants/enable").contentType(MediaType.APPLICATION_JSON).content("{\"size\":\"M\"}"),
				en, 409, "product.has_variants");
		expectDetail(post(PRODUCTS + "/" + simple + "/variants/enable").contentType(MediaType.APPLICATION_JSON).content("{}"),
				en, 400, "variant.options_required");
		expectDetail(post(PRODUCTS + "/" + multi + "/variants/" + vId + "999/deactivate"), en, 404, "variant.not_found");
		expectDetail(post(PRODUCTS).contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"X\",\"sku\":\"A1\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":true,\"variants\":[%s]}"
				.formatted(foodId, variant(null, "M", null, "0"))), en, 400, "product.variant_fields_not_allowed");
		expectDetail(post(PRODUCTS + "/" + simple + "/variants").contentType(MediaType.APPLICATION_JSON)
			.content("{\"variants\":[" + variant(null, "M", null, "0") + "]}"), en, 409, "product.no_variants");
		// Neither es nor en: Spanish
		String detailFr = JsonPath.read(mvc.perform(post(PRODUCTS + "/" + simple + "/variants/disable")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken).header(HttpHeaders.ACCEPT_LANGUAGE, "fr"))
			.andReturn().getResponse().getContentAsString(), "$.detail");
		String detailEs = JsonPath.read(mvc.perform(post(PRODUCTS + "/" + simple + "/variants/disable")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken).header(HttpHeaders.ACCEPT_LANGUAGE, "es"))
			.andReturn().getResponse().getContentAsString(), "$.detail");
		assertEquals(detailEs, detailFr);
	}

	// ---------------------------------------------------------------- helpers

	private void expectDetail(MockHttpServletRequestBuilder req, String lang, int expected, String code) throws Exception {
		String body = mvc.perform(req.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, lang))
			.andExpect(status().is(expected))
			.andReturn().getResponse().getContentAsString();
		assertEquals(code, JsonPath.read(body, "$.code"));
		String detail = JsonPath.read(body, "$.detail");
		assertFalse(detail.isBlank() || detail.equals(code) || detail.contains("{0}"), code + " has no proper text: " + detail);
		assertFalse(detail.contains("variante") || detail.contains("producto") || detail.contains("tiene"),
				code + " came back in Spanish: " + detail);
	}

	private static String unique(String prefix) {
		return (prefix + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10)).toUpperCase();
	}

	private static String str(String value) {
		return value == null ? "null" : "\"" + value + "\"";
	}

	private static String variant(String sku, String size, String color, String minStock) {
		return "{\"sku\":%s,\"size\":%s,\"color\":%s,\"minStock\":%s}".formatted(str(sku), str(size), str(color), minStock);
	}

	private static String simple(String name, String sku, String minStock) {
		return "{\"name\":\"%s\",\"sku\":%s,\"categoryId\":%d,\"unit\":\"UNIT\",\"minStock\":%s}".formatted(name, str(sku), foodId,
				minStock);
	}

	private static String update(String name, String sku, long version) {
		return "{\"name\":\"%s\",\"sku\":%s,\"categoryId\":%d,\"unit\":\"UNIT\",\"minStock\":0,\"version\":%d}".formatted(name,
				str(sku), foodId, version);
	}

	private static String withVariants(String name, String variantsJson) {
		return "{\"name\":\"%s\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":true,\"variants\":%s}".formatted(name, foodId,
				variantsJson);
	}

	private ResultActions create(String json) throws Exception {
		return mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private ResultActions putJson(String url, String json) throws Exception {
		return mvc.perform(put(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private ResultActions postJson(String url, String json) throws Exception {
		return mvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private ResultActions postNoBody(String url) throws Exception {
		return mvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private ResultActions getP(long id) throws Exception {
		return mvc.perform(get(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private ResultActions list(String query) throws Exception {
		return mvc.perform(get(PRODUCTS + "?" + query).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private long idOf(ResultActions created) throws Exception {
		Number id = JsonPath.read(created.andReturn().getResponse().getContentAsString(), "$.id");
		return id.longValue();
	}

	private long variantId(long productId, String size) throws Exception {
		List<Number> ids = JsonPath.read(getP(productId).andReturn().getResponse().getContentAsString(),
				"$.variants[?(@.size == '" + size + "')].id");
		return ids.get(0).longValue();
	}

}
