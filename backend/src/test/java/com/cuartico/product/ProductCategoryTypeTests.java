package com.cuartico.product;

import static org.hamcrest.Matchers.contains;
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

import com.cuartico.category.CategoryFixtures;
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
import org.springframework.test.web.servlet.ResultActions;

/** HU-15 (products: CA-13 .. CA-21) and TT-14 (SKU upper-casing, idempotent toggle). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductCategoryTypeTests {

	private static final String PRODUCTS = "/api/v1/products";

	private static String token;

	private static long food;

	private static long clothing;

	private static long appliance;

	private static long other;

	@Autowired
	MockMvc mvc;

	@BeforeAll
	static void setUp(@Autowired MockMvc mvc) throws Exception {
		token = CategoryFixtures.login(mvc, "admin", "Admin123!test");
		food = CategoryFixtures.rootId(mvc, token, "FOOD");
		clothing = CategoryFixtures.rootId(mvc, token, "CLOTHING");
		appliance = CategoryFixtures.rootId(mvc, token, "APPLIANCE");
		other = CategoryFixtures.rootId(mvc, token, "OTHER");
	}

	// CA-13
	@Test
	void categoryIsRequiredAndMustExistAndBeActive() throws Exception {
		send(post(PRODUCTS), "{\"name\":\"A\",\"unit\":\"UNIT\",\"minStock\":0}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.categoryId").value("es obligatorio"));
		send(post(PRODUCTS), product("A", 999999, "UNIT", "")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.category_not_found"))
			.andExpect(jsonPath("$.detail").value("No existe la categoría 999999."));

		long inactive = CategoryFixtures.createChild(mvc, token, food, "Inactiva");
		mvc.perform(post("/api/v1/categories/" + inactive + "/deactivate").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(status().isOk());
		send(post(PRODUCTS), product("A", inactive, "UNIT", "")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("category.inactive"));

		// A product already in a category that is later deactivated can still be edited, unchanged
		long cat = CategoryFixtures.createChild(mvc, token, food, "Luego");
		long id = idOf(send(post(PRODUCTS), product("Keeps", cat, "UNIT", "")));
		mvc.perform(post("/api/v1/categories/" + cat + "/deactivate").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(status().isOk());
		send(put(PRODUCTS + "/" + id), product("Keeps 2", cat, "UNIT", ",\"version\":0")).andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Keeps 2"))
			.andExpect(jsonPath("$.category.active").value(false));
		// ...but cannot be moved to another inactive one
		send(put(PRODUCTS + "/" + id), product("Keeps 2", inactive, "UNIT", ",\"version\":1"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("category.inactive"));
	}

	// CA-14, CA-15
	@Test
	void anyLevelAndDerivedTypeAndTypeInBodyIgnored() throws Exception {
		long sub = CategoryFixtures.createChild(mvc, token, appliance, "Cocina");
		send(post(PRODUCTS), product("Hornillo", sub, "UNIT", ",\"type\":\"FOOD\""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.type").value("APPLIANCE"))
			.andExpect(jsonPath("$.category.id").value(sub))
			.andExpect(jsonPath("$.category.name").value(org.hamcrest.Matchers.startsWith("Cocina-")))
			.andExpect(jsonPath("$.category.path").value(org.hamcrest.Matchers.startsWith("Electrodomésticos › Cocina-")))
			.andExpect(jsonPath("$.category.pathEn").value(org.hamcrest.Matchers.startsWith("Appliances › Cocina-")))
			.andExpect(jsonPath("$.category.active").value(true));
		send(post(PRODUCTS), product("En la raiz", other, "KG", "")).andExpect(status().isCreated())
			.andExpect(jsonPath("$.type").value("OTHER"))
			.andExpect(jsonPath("$.category.nameEn").value("Personal care & home"));
	}

	// CA-16
	@Test
	void attributesDependOnType() throws Exception {
		send(post(PRODUCTS), product("Nevera", appliance, "UNIT",
				",\"brand\":\"  LG  \",\"model\":\"GR-1\",\"warrantyMonths\":24"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.brand").value("LG"))
			.andExpect(jsonPath("$.model").value("GR-1"))
			.andExpect(jsonPath("$.warrantyMonths").value(24));
		send(post(PRODUCTS), product("Arroz", food, "KG", ",\"brand\":\"Mi marca\",\"model\":\"  \"")).andExpect(status().isCreated())
			.andExpect(jsonPath("$.brand").value("Mi marca"))
			.andExpect(jsonPath("$.model").doesNotExist())
			.andExpect(jsonPath("$.warrantyMonths").doesNotExist());

		send(post(PRODUCTS), product("Arroz", food, "KG", ",\"model\":\"X\"")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.attribute_not_allowed"))
			.andExpect(jsonPath("$.detail").value("El campo model no se admite para este tipo de producto."));
		send(post(PRODUCTS), product("Arroz", food, "KG", ",\"warrantyMonths\":0")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.attribute_not_allowed"))
			.andExpect(jsonPath("$.detail").value("El campo warrantyMonths no se admite para este tipo de producto."));

		// Range 0..120 and integer
		send(post(PRODUCTS), product("N", appliance, "UNIT", ",\"warrantyMonths\":121")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.warrantyMonths").exists());
		send(post(PRODUCTS), product("N", appliance, "UNIT", ",\"warrantyMonths\":-1")).andExpect(status().isBadRequest());
		send(post(PRODUCTS), product("N", appliance, "UNIT", ",\"warrantyMonths\":1.5")).andExpect(status().isBadRequest());
		send(post(PRODUCTS), product("N", appliance, "UNIT", ",\"warrantyMonths\":120")).andExpect(status().isCreated());
		send(post(PRODUCTS), product("N", appliance, "UNIT", ",\"model\":\"" + "m".repeat(81) + "\""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.model").exists());
	}

	// CA-17
	@Test
	void clothingAndAppliancesOnlyAcceptUnit() throws Exception {
		send(post(PRODUCTS), product("Camisa", clothing, "KG", "")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.unit_not_allowed"));
		send(post(PRODUCTS), product("Camisa", appliance, "LB", "")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.unit_not_allowed"));
		send(post(PRODUCTS), product("Camisa", clothing, "UNIT", "")).andExpect(status().isCreated())
			.andExpect(jsonPath("$.type").value("CLOTHING"));
		send(post(PRODUCTS), product("Sal", food, "KG", "")).andExpect(status().isCreated());
	}

	// CA-18
	@Test
	void changingTypeNeverClearsAttributesSilently() throws Exception {
		long id = idOf(send(post(PRODUCTS), product("Batidora", appliance, "UNIT",
				",\"model\":\"B1\",\"warrantyMonths\":12")));
		// Moving to FOOD with model/warranty still set is rejected and the product does not change
		send(put(PRODUCTS + "/" + id), product("Batidora", food, "UNIT", ",\"model\":\"B1\",\"warrantyMonths\":12,\"version\":0"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.attribute_not_allowed"));
		mvc.perform(get(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(jsonPath("$.type").value("APPLIANCE"))
			.andExpect(jsonPath("$.model").value("B1"))
			.andExpect(jsonPath("$.version").value(0));
		// With them cleared it moves
		send(put(PRODUCTS + "/" + id), product("Batidora", food, "UNIT", ",\"version\":0")).andExpect(status().isOk())
			.andExpect(jsonPath("$.type").value("FOOD"))
			.andExpect(jsonPath("$.model").doesNotExist());
		// Moving to clothing with KG is a unit error
		send(put(PRODUCTS + "/" + id), product("Batidora", clothing, "KG", ",\"version\":1")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.unit_not_allowed"));
	}

	// CA-19
	@Test
	void filtersByCategoryWithDescendantsAndByType() throws Exception {
		long root = idOf(rootCategory("Filtro", "CLOTHING"));
		long child = CategoryFixtures.createChild(mvc, token, root, "Hijo");
		long grandChild = CategoryFixtures.createChild(mvc, token, child, "Nieto");
		send(post(PRODUCTS), product("Zeta raiz", root, "UNIT", "")).andExpect(status().isCreated());
		send(post(PRODUCTS), product("Beta hijo", child, "UNIT", "")).andExpect(status().isCreated());
		send(post(PRODUCTS), product("Alfa nieto", grandChild, "UNIT", "")).andExpect(status().isCreated());

		list("categoryId=" + root).andExpect(jsonPath("$.content[*].name").value(contains("Alfa nieto", "Beta hijo", "Zeta raiz")));
		list("categoryId=" + child).andExpect(jsonPath("$.content[*].name").value(contains("Alfa nieto", "Beta hijo")));
		list("categoryId=" + grandChild + "&q=alfa").andExpect(jsonPath("$.totalElements").value(1));
		list("categoryId=" + root + "&q=beta&active=true").andExpect(jsonPath("$.totalElements").value(1));
		list("categoryId=" + root + "&active=false").andExpect(jsonPath("$.totalElements").value(0));
		// Unknown category: empty, not an error
		list("categoryId=999999").andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
		list("categoryId=abc").andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.categoryId").exists());

		list("type=CLOTHING&q=alfa nieto").andExpect(jsonPath("$.totalElements").value(1));
		list("type=FOOD&q=alfa nieto").andExpect(jsonPath("$.totalElements").value(0));
		list("type=CLOTHING&categoryId=" + child).andExpect(jsonPath("$.totalElements").value(2));
		list("type=APPLIANCE&categoryId=" + child).andExpect(jsonPath("$.totalElements").value(0));
		list("type=FRUIT").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.type").exists());
	}

	// CA-20, CA-21
	@Test
	void sortByCategoryIsRetiredAndTheEndpointIsGone() throws Exception {
		list("sort=category").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("request.invalid_sort"));
		list("sort=sku,desc").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("request.invalid_sort"));
		list("sort=createdAt,desc").andExpect(status().isOk());
		mvc.perform(get(PRODUCTS + "/categories").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("request.not_found"));
	}

	// TT-14: SKU whose value changes on upper-casing
	@Test
	void skuThatChangesWhenUpperCasedIsRejected() throws Exception {
		for (String sku : List.of("ß", "straße", "ı", "ſ")) {
			send(post(PRODUCTS), "{\"name\":\"A\",\"sku\":\"" + sku + "\",\"categoryId\":" + food
					+ ",\"unit\":\"UNIT\",\"minStock\":0}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("validation.failed"))
				.andExpect(jsonPath("$.errors.sku").exists());
		}
		String ok = "ok-" + UUID.randomUUID().toString().substring(0, 8);
		send(post(PRODUCTS), "{\"name\":\"A\",\"sku\":\" " + ok + " \",\"categoryId\":" + food
				+ ",\"unit\":\"UNIT\",\"minStock\":0}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.sku").value(ok.toUpperCase()));
	}

	// TT-14: idempotent toggle, also under a race
	@Test
	void simultaneousDeactivationsAreBothOk() throws Exception {
		long id = idOf(send(post(PRODUCTS), product("Carrera", food, "UNIT", "")));
		for (String action : List.of("deactivate", "activate")) {
			CountDownLatch start = new CountDownLatch(1);
			ExecutorService pool = Executors.newFixedThreadPool(3);
			try {
				List<Future<Integer>> results = new ArrayList<>();
				for (int i = 0; i < 3; i++) {
					results.add(pool.submit(() -> {
						start.await();
						return mvc.perform(post(PRODUCTS + "/" + id + "/" + action)
								.header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
							.andReturn()
							.getResponse()
							.getStatus();
					}));
				}
				start.countDown();
				for (Future<Integer> f : results) {
					Assertions.assertEquals(200, f.get());
				}
			}
			finally {
				pool.shutdownNow();
			}
		}
	}

	// ---------------------------------------------------------------- helpers

	/** JSON body: {@code extra} is appended as raw members (must start with a comma, or be empty). */
	private static String product(String name, long categoryId, String unit, String extra) {
		return "{\"name\":\"%s\",\"categoryId\":%d,\"unit\":\"%s\",\"minStock\":0%s}".formatted(name, categoryId, unit,
				extra);
	}

	private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder,
			String json) throws Exception {
		return mvc.perform(builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private ResultActions rootCategory(String prefix, String type) throws Exception {
		return mvc.perform(post("/api/v1/categories").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"%s-%s\",\"productType\":\"%s\"}".formatted(prefix,
					UUID.randomUUID().toString().substring(0, 8), type)));
	}

	private ResultActions list(String query) throws Exception {
		return mvc.perform(get(PRODUCTS + "?" + query).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private static long idOf(ResultActions created) throws Exception {
		return ((Number) JsonPath.read(created.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),
				"$.id")).longValue();
	}

}
