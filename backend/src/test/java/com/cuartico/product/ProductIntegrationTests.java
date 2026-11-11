package com.cuartico.product;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cuartico.category.CategoryFixtures;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/** HU-02: product catalog API (acceptance criteria CA-1 .. CA-24). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductIntegrationTests {

	private static final String PRODUCTS = "/api/v1/products";

	private static String adminToken;

	private static String operatorToken;

	private static long foodId;

	private static long clothingId;

	private static long applianceId;

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@BeforeAll
	static void tokens(@Autowired MockMvc mvc) throws Exception {
		adminToken = login(mvc, "admin", "Admin123!test");
		foodId = CategoryFixtures.rootId(mvc, adminToken, "FOOD");
		clothingId = CategoryFixtures.rootId(mvc, adminToken, "CLOTHING");
		applianceId = CategoryFixtures.rootId(mvc, adminToken, "APPLIANCE");
		mvc.perform(post("/api/v1/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"username":"prod_operator","password":"Oper12345!","fullName":"Product Operator","role":"OPERATOR"}
						"""))
			.andExpect(status().isCreated());
		operatorToken = login(mvc, "prod_operator", "Oper12345!");
	}

	// ---------------------------------------------------------------- create

	@Test
	void createReturns201WithZeroStockAndStockRow() throws Exception {
		String sku = unique("CRE");
		MvcResult r = create(adminToken, body("Arroz", sku, "KG", foodId, "2.50", "USD", "5"))
			.andExpect(status().isCreated())
			.andReturn();
		// Location points to the new resource
		String location = r.getResponse().getHeader("Location");
		int id = JsonPath.read(r.getResponse().getContentAsString(), "$.id");
		org.junit.jupiter.api.Assertions.assertTrue(location.endsWith(PRODUCTS + "/" + id), location);

		mvc.perform(get(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + operatorToken))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Arroz"))
			.andExpect(jsonPath("$.sku").value(sku))
			.andExpect(jsonPath("$.unit").value("KG"))
			.andExpect(jsonPath("$.type").value("FOOD"))
			.andExpect(jsonPath("$.category.id").value(foodId))
			.andExpect(jsonPath("$.category.path").value("Alimentos"))
			.andExpect(jsonPath("$.category.pathEn").value("Food"))
			.andExpect(jsonPath("$.brand").doesNotExist())
			.andExpect(jsonPath("$.salePrice").value(2.5))
			.andExpect(jsonPath("$.salePriceCurrency").value("USD"))
			.andExpect(jsonPath("$.minStock").value(5))
			.andExpect(jsonPath("$.active").value(true))
			.andExpect(jsonPath("$.version").value(0))
			.andExpect(jsonPath("$.stock.onHand").value(0))
			.andExpect(jsonPath("$.stock.reserved").value(0))
			.andExpect(jsonPath("$.stock.available").value(0))
			.andExpect(jsonPath("$.stock.averageCost").doesNotExist())
			.andExpect(jsonPath("$.stock.costCurrency").doesNotExist())
			.andExpect(jsonPath("$.lowStock").value(true))
			.andExpect(jsonPath("$.createdBy").value("admin"))
			.andExpect(jsonPath("$.createdAt").isNotEmpty());

		Integer rows = jdbc.queryForObject(
				"select count(*) from variant_stock s join product_variants v on v.id = s.variant_id where v.product_id = ? and s.on_hand = 0 and s.reserved = 0", Integer.class,
				id);
		org.junit.jupiter.api.Assertions.assertEquals(1, rows);
	}

	@Test
	void createExactJsonShape() throws Exception {
		create(operatorToken, body("Shape", null, "UNIT", null, null, null, "0"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.sku").doesNotExist())
			.andExpect(jsonPath("$.salePrice").doesNotExist())
			.andExpect(jsonPath("$.lowStock").value(false))
			.andExpect(jsonPath("$.createdBy").value("prod_operator"))
			.andExpect(jsonPath("$.stock.available").value(0));
	}

	@Test
	void normalizationHappensBeforeValidation() throws Exception {
		String sku = unique("NRM");
		String longName = "x".repeat(120);
		create(adminToken, """
				{"name":"  Arroz 1 kg  ","sku":" %s ","categoryId":@C,"unit":"KG","minStock":0}
				""".formatted(sku.toLowerCase()))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.name").value("Arroz 1 kg"))
			.andExpect(jsonPath("$.sku").value(sku));

		create(adminToken, """
				{"name":"  %s  ","categoryId":@C,"unit":"KG","minStock":0}
				""".formatted(longName))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.name").value(longName));

		create(adminToken, """
				{"name":"   ","categoryId":@C,"unit":"KG","minStock":0}
				""")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.name").value("no puede estar vacío"));
	}

	@Test
	void duplicateSkuIsConflictEvenIfInactiveAndIgnoringCase() throws Exception {
		String sku = unique("DUP");
		int id = id(create(adminToken, body("Uno", sku, "UNIT", null, null, null, "0")));
		postAction(PRODUCTS + "/" + id + "/deactivate", adminToken).andExpect(status().isOk());

		create(adminToken, body("Dos", sku.toLowerCase(), "UNIT", null, null, null, "0"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"))
			.andExpect(jsonPath("$.detail").value("Ya existe un producto con el SKU " + sku + "."));

		mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content(body("Dos", sku, "UNIT", null, null, null, "0")))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("A product with SKU " + sku + " already exists."));
	}

	@Test
	void severalProductsWithoutSkuAreAllowed() throws Exception {
		create(adminToken, body("Sin sku A", null, "UNIT", null, null, null, "0")).andExpect(status().isCreated());
		create(adminToken, body("Sin sku B", "  ", "UNIT", null, null, null, "0")).andExpect(status().isCreated());
	}

	@Test
	void simultaneousCreatesWithSameSkuGiveOne201AndOne409() throws Exception {
		String sku = unique("RACE");
		String json = body("Carrera", sku, "UNIT", null, null, null, "0");
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			List<Future<Integer>> results = new ArrayList<>();
			for (int i = 0; i < 2; i++) {
				results.add(pool.submit(() -> {
					start.await();
					return mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json))
						.andReturn()
						.getResponse()
						.getStatus();
				}));
			}
			start.countDown();
			List<Integer> statuses = new ArrayList<>();
			for (Future<Integer> f : results) {
				statuses.add(f.get());
			}
			org.junit.jupiter.api.Assertions.assertTrue(statuses.contains(201), statuses.toString());
			org.junit.jupiter.api.Assertions.assertTrue(statuses.contains(409), statuses.toString());
			org.junit.jupiter.api.Assertions.assertEquals(1,
					jdbc.queryForObject("select count(*) from product_variants where sku = ?", Integer.class, sku));
		}
		finally {
			pool.shutdownNow();
		}
	}

	@Test
	void validationErrorsPerFieldTranslated() throws Exception {
		create(adminToken, """
				{"name":"","sku":"a b!","minStock":-1,"salePrice":-1,"salePriceCurrency":"USD"}
				""")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.name").value("no puede estar vacío"))
			.andExpect(jsonPath("$.errors.unit").value("es obligatorio"))
			.andExpect(jsonPath("$.errors.categoryId").value("es obligatorio"))
			.andExpect(jsonPath("$.errors.minStock").value("debe ser mayor o igual que 0"))
			.andExpect(jsonPath("$.errors.salePrice").value("debe ser mayor o igual que 0.00"))
			.andExpect(jsonPath("$.errors.sku")
				.value("Usa solo letras sin tilde, números, punto (.), guion (-) o guion bajo (_)."));

		mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content(fix("""
						{"name":"A","categoryId":@C,"unit":"KG","minStock":0,"salePrice":1.234,"salePriceCurrency":"USD"}
						""")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.salePrice")
				.value("number out of range (at most 10 integer digits and 2 decimals)"));
	}

	@Test
	void typeErrorsAreValidationFailedWithInvalidValue() throws Exception {
		create(adminToken, """
				{"name":"A","categoryId":@C,"unit":"BOX","minStock":"abc","salePrice":true,"salePriceCurrency":"USD"}
				""")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"));
		// Jackson reports one type error at a time: check each field on its own
		create(adminToken, "{\"name\":\"A\",\"categoryId\":@C,\"unit\":\"BOX\",\"minStock\":0}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.unit").value("valor no válido"));
		create(adminToken, "{\"name\":\"A\",\"categoryId\":@C,\"unit\":\"KG\",\"minStock\":\"abc\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.minStock").value("valor no válido"));
		mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content(fix("{\"name\":\"A\",\"categoryId\":@C,\"unit\":\"KG\",\"minStock\":0,\"salePrice\":true,\"salePriceCurrency\":\"USD\"}")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.salePrice").value("invalid value"));
	}

	@Test
	void malformedJsonStaysRequestMalformed() throws Exception {
		create(adminToken, "{no es json").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("request.malformed"));
		create(adminToken, "[]").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("request.malformed"));
	}

	@Test
	void priceAndCurrencyMustGoTogetherAndBeSupported() throws Exception {
		create(adminToken, body("P", null, "UNIT", null, "1.00", null, "0"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.price_currency_mismatch"))
			.andExpect(jsonPath("$.detail").value("Si indicas un precio, indica también su moneda (y al revés)."));
		create(adminToken, body("P", null, "UNIT", null, null, "USD", "0"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.price_currency_mismatch"));
		create(adminToken, body("P", null, "UNIT", null, "1.00", "EUR", "0"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.currency_unsupported"))
			.andExpect(jsonPath("$.detail").value("La moneda EUR no está admitida."));
		mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content(body("P", null, "UNIT", null, "1.00", "usd", "0")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.currency_unsupported"))
			.andExpect(jsonPath("$.detail").value("Currency usd isn't supported."));
		create(adminToken, body("P", null, "UNIT", null, "10", "CUP", "0"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.salePriceCurrency").value("CUP"));
	}

	@Test
	void readOnlyFieldsInBodyAreIgnored() throws Exception {
		create(adminToken, """
				{"name":"Ignora","categoryId":@C,"unit":"KG","minStock":0,"active":false,
				 "stock":{"onHand":99},"onHand":99,"averageCost":5,"version":7}
				""")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.active").value(true))
			.andExpect(jsonPath("$.version").value(0))
			.andExpect(jsonPath("$.stock.onHand").value(0))
			.andExpect(jsonPath("$.stock.averageCost").doesNotExist());
	}

	// ---------------------------------------------------------------- update

	@Test
	void updateBumpsVersionAndRecordsUpdater() throws Exception {
		int id = id(create(adminToken, body("Antes", unique("UPD"), "UNIT", null, null, null, "0")));
		putJson(id, adminToken, """
				{"name":" Despues ","sku":null,"categoryId":@C,"unit":"KG","salePrice":3,"salePriceCurrency":"CUP",
				 "minStock":2.5,"version":0}
				""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Despues"))
			.andExpect(jsonPath("$.sku").doesNotExist())
			.andExpect(jsonPath("$.unit").value("KG"))
			.andExpect(jsonPath("$.salePrice").value(3))
			.andExpect(jsonPath("$.minStock").value(2.5))
			.andExpect(jsonPath("$.version").value(1))
			.andExpect(jsonPath("$.createdBy").value("admin"))
			.andExpect(jsonPath("$.updatedBy").value("admin"));

		putJson(id, operatorToken, """
				{"name":"Por operador","categoryId":@C,"unit":"KG","minStock":2.5,"version":1}
				""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value(2))
			.andExpect(jsonPath("$.updatedBy").value("prod_operator"))
			.andExpect(jsonPath("$.createdBy").value("admin"));
	}

	@Test
	void updateWithStaleVersionIsConflict() throws Exception {
		int id = id(create(adminToken, body("Concurrente", null, "UNIT", null, null, null, "0")));
		putJson(id, adminToken, """
				{"name":"Primero","categoryId":@C,"unit":"UNIT","minStock":0,"version":0}
				""").andExpect(status().isOk());

		mvc.perform(put(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + operatorToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content(fix("{\"name\":\"Segundo\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0,\"version\":0}")))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("resource.version_conflict"))
			.andExpect(jsonPath("$.detail")
				.value("Someone else changed this record while you were editing. Reload it and try again."));

		mvc.perform(get(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(jsonPath("$.name").value("Primero"));
	}

	@Test
	void updateValidationAndNormalizationApplyToo() throws Exception {
		int id = id(create(adminToken, body("Val", null, "UNIT", null, null, null, "0")));
		putJson(id, adminToken, """
				{"name":"   ","categoryId":@C,"unit":"UNIT","minStock":0,"version":0}
				""")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.name").value("no puede estar vacío"));
		putJson(id, adminToken, """
				{"name":"Val","categoryId":@C,"unit":"UNIT","minStock":0}
				""")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.version").value("es obligatorio"));
		putJson(id, adminToken, """
				{"name":"Val","sku":" abc-1 ","categoryId":@C,"unit":"UNIT","minStock":0,"version":0,"salePrice":1}
				""")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.price_currency_mismatch"));
		putJson(id, adminToken, """
				{"name":"Val","sku":" %s ","categoryId":@C,"unit":"UNIT","minStock":0,"version":0}
				""".formatted(unique("n").toLowerCase()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.sku").value(org.hamcrest.Matchers.matchesPattern("^N-[A-Z0-9]+$")));
	}

	@Test
	void unknownIdIs404ForEveryOperation() throws Exception {
		String url = PRODUCTS + "/999999";
		mvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("product.not_found"))
			.andExpect(jsonPath("$.detail").value("No existe el producto 999999."));
		mvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(jsonPath("$.detail").value("Product 999999 doesn't exist."));
		putJson(999999, adminToken, "{\"name\":\"X\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0,\"version\":0}")
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("product.not_found"));
		postAction(url + "/deactivate", adminToken).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("product.not_found"));
		postAction(url + "/activate", adminToken).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("product.not_found"));
	}

	@Test
	void nonNumericIdIsValidationFailed() throws Exception {
		mvc.perform(get(PRODUCTS + "/abc").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.id").value("valor no válido"));
	}

	@Test
	void changingSkuToAnotherProductsSkuIsConflictButKeepingOwnIsFine() throws Exception {
		String skuA = unique("SKA");
		String skuB = unique("SKB");
		int a = id(create(adminToken, body("A", skuA, "UNIT", null, null, null, "0")));
		create(adminToken, body("B", skuB, "UNIT", null, null, null, "0")).andExpect(status().isCreated());

		putJson(a, adminToken, "{\"name\":\"A\",\"sku\":\"%s\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0,\"version\":0}"
			.formatted(skuB.toLowerCase()))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"));
		putJson(a, adminToken, "{\"name\":\"A2\",\"sku\":\"%s\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0,\"version\":0}"
			.formatted(skuA))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value(1));
	}

	@Test
	void inactiveProductCanBeEditedWithoutReactivating() throws Exception {
		int id = id(create(adminToken, body("Viejo", null, "UNIT", null, null, null, "0")));
		postAction(PRODUCTS + "/" + id + "/deactivate", adminToken).andExpect(status().isOk());
		putJson(id, operatorToken, "{\"name\":\"Corregido\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0,\"version\":1}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Corregido"))
			.andExpect(jsonPath("$.active").value(false));
	}

	// ---------------------------------------------------------------- activate / deactivate

	@Test
	void deactivateAndActivateAreIdempotentAndKeepData() throws Exception {
		int id = id(create(adminToken, body("Toggle", unique("TGL"), "UNIT", null, null, null, "0")));
		postAction(PRODUCTS + "/" + id + "/deactivate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false))
			.andExpect(jsonPath("$.version").value(1))
			.andExpect(jsonPath("$.name").value("Toggle"));
		// Idempotent: no new version
		postAction(PRODUCTS + "/" + id + "/deactivate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false))
			.andExpect(jsonPath("$.version").value(1));
		postAction(PRODUCTS + "/" + id + "/activate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true))
			.andExpect(jsonPath("$.version").value(2));
		postAction(PRODUCTS + "/" + id + "/activate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value(2));
	}

	@Test
	void deactivateWithStockIsAllowed() throws Exception {
		int id = id(create(adminToken, body("ConStock", null, "UNIT", null, null, null, "0")));
		jdbc.update("update variant_stock set on_hand = 10, reserved = 4 where variant_id = (select id from product_variants where product_id = ?)", id);
		postAction(PRODUCTS + "/" + id + "/deactivate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false))
			.andExpect(jsonPath("$.stock.onHand").value(10))
			.andExpect(jsonPath("$.stock.reserved").value(4))
			.andExpect(jsonPath("$.stock.available").value(6));
	}

	@Test
	void operatorCannotActivateOrDeactivate() throws Exception {
		int id = id(create(adminToken, body("Prohibido", null, "UNIT", null, null, null, "0")));
		postAction(PRODUCTS + "/" + id + "/deactivate", operatorToken)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("auth.forbidden"));
		postAction(PRODUCTS + "/" + id + "/activate", operatorToken)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("auth.forbidden"));
		mvc.perform(get(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(jsonPath("$.active").value(true));
	}

	@Test
	void deleteIsMethodNotAllowed() throws Exception {
		int id = id(create(adminToken, body("NoBorrar", null, "UNIT", null, null, null, "0")));
		mvc.perform(delete(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isMethodNotAllowed())
			.andExpect(jsonPath("$.code").value("request.method_not_allowed"));
	}

	// ---------------------------------------------------------------- list / search

	@Test
	void listDefaultsToAllProductsSortedByNameIgnoringCaseWithEnvelope() throws Exception {
		Long cat = newSub("LST");
		create(adminToken, body("banana", null, "UNIT", cat, null, null, "0"));
		create(adminToken, body("Cereal", null, "UNIT", cat, null, null, "0"));
		create(adminToken, body("Aceite", null, "UNIT", cat, null, null, "0"));

		list("categoryId=" + cat)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[*].name").value(contains("Aceite", "banana", "Cereal")))
			.andExpect(jsonPath("$.page").value(0))
			.andExpect(jsonPath("$.size").value(20))
			.andExpect(jsonPath("$.totalElements").value(3))
			.andExpect(jsonPath("$.totalPages").value(1))
			.andExpect(jsonPath("$.content[0].stock.available").value(0));

		list("categoryId=" + cat + "&sort=name,desc")
			.andExpect(jsonPath("$.content[*].name").value(contains("Cereal", "banana", "Aceite")));
	}

	@Test
	void searchByNameOrSkuIgnoringCaseAndLiteralWildcards() throws Exception {
		String tag = "zq" + UUID.randomUUID().toString().substring(0, 6);
		create(adminToken, body("Arroz " + tag, null, "UNIT", null, null, null, "0"));
		create(adminToken, body("Otro", tag.toUpperCase() + "-SKU", "UNIT", null, null, null, "0"));
		create(adminToken, body("Descuento 50% " + tag, null, "UNIT", null, null, null, "0"));
		create(adminToken, body("Snake_case " + tag, null, "UNIT", null, null, null, "0"));
		create(adminToken, body("Snakexcase " + tag, null, "UNIT", null, null, null, "0"));

		list("q=" + tag.toUpperCase()).andExpect(jsonPath("$.totalElements").value(5));
		list("q=" + tag + "-sku").andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.content[0].name").value("Otro"));
		// % and _ are literal
		listQ("50% " + tag).andExpect(jsonPath("$.totalElements").value(1));
		list("q=" + "snake_case " + tag).andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.content[0].name").value("Snake_case " + tag));
		listQ("%").andExpect(jsonPath("$.content[*].name").value(not(hasItem("Arroz " + tag))));
		// empty q = no filter
		list("q=").andExpect(status().isOk());
	}

	@Test
	void filterByActiveAndCategoryIgnoringCase() throws Exception {
		Long cat = newSub("FLT");
		int a = id(create(adminToken, body("Activo", null, "UNIT", cat, null, null, "0")));
		int b = id(create(adminToken, body("Inactivo", null, "UNIT", cat, null, null, "0")));
		postAction(PRODUCTS + "/" + b + "/deactivate", adminToken).andExpect(status().isOk());

		list("categoryId=" + cat).andExpect(jsonPath("$.totalElements").value(2));
		list("categoryId=" + cat + "&active=true").andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.content[0].id").value(a));
		list("categoryId=" + cat + "&active=false").andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.content[0].id").value(b))
			.andExpect(jsonPath("$.content[0].lowStock").value(false));
	}

	@Test
	void paginationAndOutOfRangePage() throws Exception {
		Long cat = newSub("PAG");
		for (int i = 1; i <= 5; i++) {
			create(adminToken, body("P" + i, null, "UNIT", cat, null, null, "0"));
		}
		list("categoryId=" + cat + "&size=2&page=1")
			.andExpect(jsonPath("$.content[*].name").value(contains("P3", "P4")))
			.andExpect(jsonPath("$.page").value(1))
			.andExpect(jsonPath("$.size").value(2))
			.andExpect(jsonPath("$.totalElements").value(5))
			.andExpect(jsonPath("$.totalPages").value(3));
		list("categoryId=" + cat + "&size=2&page=9")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content").isEmpty())
			.andExpect(jsonPath("$.totalElements").value(5));
	}

	@Test
	void pageAndSizeOutOfRangeAreValidationErrorsNeverClamped() throws Exception {
		list("size=0").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.size").value("debe ser mayor o igual que 1"));
		list("size=101").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.size").value("debe ser menor o igual que 100"));
		mvc.perform(get(PRODUCTS + "?page=-1").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.page").value("must be greater than or equal to 0"));
		list("size=100").andExpect(status().isOk()).andExpect(jsonPath("$.size").value(100));
	}

	@Test
	void queryParameterTypeErrorsAreValidationFailed() throws Exception {
		list("page=abc").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.page").value("valor no válido"));
		mvc.perform(get(PRODUCTS + "?active=quizas").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.active").value("invalid value"));
	}

	@Test
	void sortWhitelistAndStability() throws Exception {
		list("sort=price,asc").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("request.invalid_sort"))
			.andExpect(jsonPath("$.detail").value("Orden no válido: price,asc"));
		list("sort=name,sideways").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("request.invalid_sort"));
		list("sort=password").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("request.invalid_sort"));
		for (String ok : List.of("name", "name,desc", "createdAt,desc")) {
			list("sort=" + ok).andExpect(status().isOk());
		}
		// Same name: ties are broken by id
		Long cat = newSub("STB");
		int first = id(create(adminToken, body("Igual", null, "UNIT", cat, null, null, "0")));
		int second = id(create(adminToken, body("Igual", null, "UNIT", cat, null, null, "0")));
		list("categoryId=" + cat + "&sort=name,asc")
			.andExpect(jsonPath("$.content[0].id").value(first))
			.andExpect(jsonPath("$.content[1].id").value(second));
	}

	@Test
	void retiredCategoriesEndpointIs404() throws Exception {
		mvc.perform(get(PRODUCTS + "/categories").header(HttpHeaders.AUTHORIZATION, "Bearer " + operatorToken))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("request.not_found"));
	}

	@Test
	void lowStockFollowsMinStockAndActive() throws Exception {
		int id = id(create(adminToken, body("Bajo", null, "UNIT", null, null, null, "5")));
		jdbc.update("update variant_stock set on_hand = 5 where variant_id = (select id from product_variants where product_id = ?)", id);
		mvc.perform(get(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(jsonPath("$.lowStock").value(true));
		jdbc.update("update variant_stock set on_hand = 6 where variant_id = (select id from product_variants where product_id = ?)", id);
		mvc.perform(get(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(jsonPath("$.lowStock").value(false));
		int zero = id(create(adminToken, body("SinAlerta", null, "UNIT", null, null, null, "0")));
		mvc.perform(get(PRODUCTS + "/" + zero).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(jsonPath("$.lowStock").value(false));
	}

	// ---------------------------------------------------------------- permissions

	@Test
	void everyEndpointRequiresAuthentication() throws Exception {
		mvc.perform(get(PRODUCTS)).andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("auth.unauthorized"));
		mvc.perform(get(PRODUCTS + "/1")).andExpect(status().isUnauthorized());
		mvc.perform(get(PRODUCTS + "/categories")).andExpect(status().isUnauthorized());
		mvc.perform(post(PRODUCTS).contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(put(PRODUCTS + "/1").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(post(PRODUCTS + "/1/deactivate")).andExpect(status().isUnauthorized());
		mvc.perform(post(PRODUCTS + "/1/activate")).andExpect(status().isUnauthorized());
	}

	@Test
	void operatorCanListReadCreateAndEdit() throws Exception {
		int id = id(create(operatorToken, body("Del operador", null, "UNIT", null, null, null, "0")));
		mvc.perform(get(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + operatorToken))
			.andExpect(status().isOk());
		mvc.perform(get(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + operatorToken))
			.andExpect(status().isOk());
		putJson(id, operatorToken, "{\"name\":\"Editado\",\"categoryId\":@C,\"unit\":\"UNIT\",\"minStock\":0,\"version\":0}")
			.andExpect(status().isOk());
	}

	// ---------------------------------------------------------------- helpers

	private static String login(MockMvc mvc, String username, String password) throws Exception {
		MvcResult r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password)))
			.andExpect(status().isOk())
			.andReturn();
		return JsonPath.read(r.getResponse().getContentAsString(), "$.accessToken");
	}

	/** Replaces the @C placeholder with the id of the seeded FOOD root. */
	private static String fix(String json) {
		return json.replace("@C", String.valueOf(foodId));
	}

	private Long newSub(String prefix) throws Exception {
		return CategoryFixtures.createChild(mvc, adminToken, foodId, prefix);
	}

	private static String unique(String prefix) {
		return (prefix + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10)).toUpperCase();
	}

	private static String body(String name, String sku, String unit, Long categoryId, String price, String currency,
			String minStock) {
		return "{\"name\":%s,\"sku\":%s,\"unit\":%s,\"categoryId\":%s,\"salePrice\":%s,\"salePriceCurrency\":%s,\"minStock\":%s}"
			.formatted(str(name), str(sku), str(unit), categoryId == null ? foodId : categoryId, price == null ? "null" : price, str(currency),
					minStock);
	}

	private static String str(String value) {
		return value == null ? "null" : "\"" + value + "\"";
	}

	private ResultActions create(String token, String json) throws Exception {
		return mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(fix(json)));
	}

	private ResultActions putJson(int id, String token, String json) throws Exception {
		return mvc.perform(put(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(fix(json)));
	}

	private ResultActions postAction(String url, String token) throws Exception {
		return mvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private ResultActions list(String query) throws Exception {
		return mvc.perform(get(PRODUCTS + "?" + query).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private ResultActions listQ(String q) throws Exception {
		return mvc.perform(get(PRODUCTS).param("q", q).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private int id(ResultActions created) throws Exception {
		return JsonPath.read(created.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),
				"$.id");
	}

}
