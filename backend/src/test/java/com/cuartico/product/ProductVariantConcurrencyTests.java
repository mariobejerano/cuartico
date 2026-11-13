package com.cuartico.product;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * HU-16 concurrency: two simultaneous requests must never end in a 500 or in an inconsistent state. The
 * guarantees are the product row lock (taken before any variant, always in that order) and the unique constraints
 * on SKU and (product, size, color_key).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductVariantConcurrencyTests {

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
	void sameOptionsDifferingOnlyInCaseGiveOne201AndOne409() throws Exception {
		long id = createWithVariants("Carrera opciones", "[" + variant(null, "S", "Azul") + "]");
		for (int round = 0; round < 5; round++) {
			String size = "T" + round;
			List<Integer> statuses = race(
					() -> addVariant(id, variant(null, size, "Rojo")),
					() -> addVariant(id, variant(null, size, "rojo")));
			assertTrue(statuses.contains(201) && statuses.contains(409), statuses.toString());
			assertEquals(1, count("select count(*) from product_variants where product_id = ? and size = ?", id, size));
		}
	}

	@Test
	void editAndAddCreatingTheSameOptionsGiveOneOkAndOneConflict() throws Exception {
		// Edit vs add: moving a variant to options that another request is creating at the same time
		long id = createWithVariants("Carrera editar", "[" + variant(null, "S", "Azul") + "]");
		long s = variantId(id, "S");
		List<Integer> statuses = race(
				() -> addVariant(id, variant(null, "T", "azul")),
				() -> editVariant(id, s, "{\"sku\":null,\"size\":\"T\",\"color\":\"AZUL\",\"minStock\":0,\"version\":0}"));
		assertTrue(statuses.contains(409) && (statuses.contains(200) || statuses.contains(201)), statuses.toString());
		assertEquals(1, count("select count(*) from product_variants where product_id = ? and size = 'T' and color_key = 'azul'", id));
	}

	@Test
	void sameSkuInTwoDifferentProductsGivesOne201AndOne409() throws Exception {
		for (int round = 0; round < 5; round++) {
			String sku = ("RACE-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10)).toUpperCase();
			List<Integer> statuses = race(
					() -> createStatus(withVariants("Producto A " + sku, "[" + variant(sku, "M", "Rojo") + "]")),
					() -> createStatus(simple("Producto B " + sku, sku)));
			assertTrue(statuses.contains(201) && statuses.contains(409), statuses.toString());
			assertEquals(1, count("select count(*) from product_variants where sku = ?", sku));
		}
	}

	@Test
	void disableNeverCrossesAnAddLeavingASimpleProductWithTwoVariants() throws Exception {
		for (int round = 0; round < 8; round++) {
			long id = createWithVariants("Carrera convertir " + round, "[" + variant(null, "M", "Rojo") + "]");
			List<Integer> statuses = race(
					() -> addVariant(id, variant(null, "L", "Rojo")),
					() -> statusOf(post(PRODUCTS + "/" + id + "/variants/disable")));
			// Either the add won (201) and disable answers 409 has_multiple_variants, or disable won (200)
			// and the add answers 409 no_variants. Never both succeed.
			assertTrue((statuses.get(0) == 201 && statuses.get(1) == 409) || (statuses.get(0) == 409 && statuses.get(1) == 200),
					statuses.toString());
			boolean hasVariants = jdbc.queryForObject("select has_variants from products where id = ?", Boolean.class, id);
			int variants = count("select count(*) from product_variants where product_id = ?", id);
			assertTrue(hasVariants ? variants >= 1 : variants == 1, "has_variants=" + hasVariants + " variants=" + variants);
		}
	}

	@Test
	void enableVsEditOfTheSimpleProductNeverLosesAnUpdate() throws Exception {
		for (int round = 0; round < 5; round++) {
			String sku = ("ENA-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10)).toUpperCase();
			long id = idOf(createBody(simple("Carrera enable " + round, sku)));
			List<Integer> statuses = race(
					() -> statusOf(post(PRODUCTS + "/" + id + "/variants/enable").contentType(MediaType.APPLICATION_JSON)
						.content("{\"size\":\"M\"}")),
					() -> statusOf(put(PRODUCTS + "/" + id).contentType(MediaType.APPLICATION_JSON)
						.content("{\"name\":\"Renamed\",\"sku\":\"" + sku + "\",\"categoryId\":" + foodId
								+ ",\"unit\":\"UNIT\",\"minStock\":1,\"version\":0}")));
			// PUT with version 0: either it ran first (200, version 1, then enable still works) or enable ran first
			// and moved the version (409). It never answers 500 and the enable always succeeds.
			assertEquals(200, statuses.get(0), statuses.toString());
			assertTrue(statuses.get(1) == 200 || statuses.get(1) == 409, statuses.toString());
			assertEquals(1, count("select count(*) from product_variants where product_id = ?", id));
		}
	}

	@Test
	void addVariantsAndProductDeactivationBothSucceed() throws Exception {
		for (int round = 0; round < 5; round++) {
			long id = createWithVariants("Carrera desactivar " + round, "[" + variant(null, "M", "Rojo") + "]");
			List<Integer> statuses = race(
					() -> addVariant(id, variant(null, "L", "Rojo")),
					() -> statusOf(post(PRODUCTS + "/" + id + "/deactivate")));
			assertEquals(List.of(201, 200), statuses);
			assertEquals(2, count("select count(*) from product_variants where product_id = ?", id));
			assertEquals(false, jdbc.queryForObject("select active from products where id = ?", Boolean.class, id));
			assertEquals(2, count("select count(*) from variant_stock s join product_variants v on v.id = s.variant_id where v.product_id = ?", id));
		}
	}

	@Test
	void simultaneousVariantDeactivationsAreBothOk() throws Exception {
		long id = createWithVariants("Carrera toggle", "[" + variant(null, "M", "Rojo") + "," + variant(null, "L", "Rojo") + "]");
		long m = variantId(id, "M");
		for (String action : List.of("deactivate", "activate")) {
			List<Integer> statuses = race(
					() -> statusOf(post(PRODUCTS + "/" + id + "/variants/" + m + "/" + action)),
					() -> statusOf(post(PRODUCTS + "/" + id + "/variants/" + m + "/" + action)),
					() -> statusOf(post(PRODUCTS + "/" + id + "/variants/" + m + "/" + action)));
			assertEquals(List.of(200, 200, 200), statuses);
		}
		// Idempotent also under the race: exactly two real changes happened
		assertEquals(2L, jdbc.queryForObject("select version from product_variants where id = ?", Long.class, m));
	}

	@Test
	void simultaneousEditsOfTheSameVariantGiveOneOkAndOneConflict() throws Exception {
		long id = createWithVariants("Carrera editar misma", "[" + variant(null, "M", "Rojo") + "]");
		long m = variantId(id, "M");
		List<Integer> statuses = race(
				() -> editVariant(id, m, "{\"sku\":null,\"size\":\"M\",\"color\":\"Rojo\",\"minStock\":1,\"version\":0}"),
				() -> editVariant(id, m, "{\"sku\":null,\"size\":\"M\",\"color\":\"Rojo\",\"minStock\":2,\"version\":0}"));
		assertEquals(List.of(200, 409), statuses.stream().sorted().toList());
		assertEquals(1L, jdbc.queryForObject("select version from product_variants where id = ?", Long.class, m));
	}

	// ---------------------------------------------------------------- helpers

	/** Runs the tasks at the same time (released together) and returns their statuses in the order given. */
	@SafeVarargs
	private static List<Integer> race(Callable<Integer>... tasks) throws Exception {
		CountDownLatch ready = new CountDownLatch(tasks.length);
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(tasks.length);
		try {
			List<Future<Integer>> results = new ArrayList<>();
			for (Callable<Integer> task : tasks) {
				results.add(pool.submit(() -> {
					ready.countDown();
					start.await();
					return task.call();
				}));
			}
			ready.await();
			start.countDown();
			List<Integer> statuses = new ArrayList<>();
			for (Future<Integer> f : results) {
				statuses.add(f.get());
			}
			return statuses;
		}
		finally {
			pool.shutdownNow();
		}
	}

	private int statusOf(MockHttpServletRequestBuilder request) throws Exception {
		return mvc.perform(request.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)).andReturn().getResponse().getStatus();
	}

	private int addVariant(long productId, String variantJson) throws Exception {
		return statusOf(post(PRODUCTS + "/" + productId + "/variants").contentType(MediaType.APPLICATION_JSON)
			.content("{\"variants\":[" + variantJson + "]}"));
	}

	private int editVariant(long productId, long variantId, String body) throws Exception {
		return statusOf(put(PRODUCTS + "/" + productId + "/variants/" + variantId).contentType(MediaType.APPLICATION_JSON)
			.content(body));
	}

	private int createStatus(String body) throws Exception {
		return statusOf(post(PRODUCTS).contentType(MediaType.APPLICATION_JSON).content(body));
	}

	private String createBody(String body) throws Exception {
		return mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
	}

	private long idOf(String json) {
		return ((Number) JsonPath.read(json, "$.id")).longValue();
	}

	private long createWithVariants(String name, String variantsJson) throws Exception {
		return idOf(createBody(withVariants(name, variantsJson)));
	}

	private long variantId(long productId, String size) throws Exception {
		String json = mvc.perform(get(PRODUCTS + "/" + productId).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andReturn()
			.getResponse()
			.getContentAsString();
		List<Number> ids = JsonPath.read(json, "$.variants[?(@.size == '" + size + "')].id");
		return ids.get(0).longValue();
	}

	private int count(String sql, Object... args) {
		return jdbc.queryForObject(sql, Integer.class, args);
	}

	private static String variant(String sku, String size, String color) {
		return "{\"sku\":%s,\"size\":\"%s\",\"color\":\"%s\",\"minStock\":0}".formatted(
				sku == null ? "null" : "\"" + sku + "\"", size, color);
	}

	private static String withVariants(String name, String variantsJson) {
		return "{\"name\":\"%s\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":true,\"variants\":%s}".formatted(name,
				foodId, variantsJson);
	}

	private static String simple(String name, String sku) {
		return "{\"name\":\"%s\",\"sku\":\"%s\",\"categoryId\":%d,\"unit\":\"UNIT\",\"minStock\":0}".formatted(name, sku, foodId);
	}

}
