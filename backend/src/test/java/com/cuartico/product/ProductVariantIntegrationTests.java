package com.cuartico.product;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

/** HU-16: product variants API (acceptance criteria CA-1 .. CA-20; the migration CA-18/19 has its own class). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductVariantIntegrationTests {

	private static final String PRODUCTS = "/api/v1/products";

	private static String adminToken;

	private static String operatorToken;

	private static long foodId;

	private static long clothingId;

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@BeforeAll
	static void setUp(@Autowired MockMvc mvc) throws Exception {
		adminToken = CategoryFixtures.login(mvc, "admin", "Admin123!test");
		foodId = CategoryFixtures.rootId(mvc, adminToken, "FOOD");
		clothingId = CategoryFixtures.rootId(mvc, adminToken, "CLOTHING");
		mvc.perform(post("/api/v1/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"username":"var_operator","password":"Oper12345!","fullName":"Variant Operator","role":"OPERATOR"}
						"""))
			.andExpect(status().isCreated());
		operatorToken = CategoryFixtures.login(mvc, "var_operator", "Oper12345!");
	}

	// ---------------------------------------------------------------- simple products (CA-1 .. CA-3)

	@Test
	void ca1_simpleProductHasOneHiddenVariantAndItsStockRow() throws Exception {
		String sku = unique("SIM");
		long id = idOf(create(adminToken, simple("Arroz", sku, "5")).andExpect(status().isCreated())
			.andExpect(jsonPath("$.hasVariants").value(false))
			.andExpect(jsonPath("$.variantCount").value(1))
			.andExpect(jsonPath("$.sku").value(sku))
			.andExpect(jsonPath("$.minStock").value(5))
			.andExpect(jsonPath("$.stock.onHand").value(0))
			.andExpect(jsonPath("$.stock.available").value(0))
			.andExpect(jsonPath("$.lowStock").value(true))
			.andExpect(jsonPath("$.variants", hasSize(1)))
			.andExpect(jsonPath("$.variants[0].sku").value(sku))
			.andExpect(jsonPath("$.variants[0].size").doesNotExist())
			.andExpect(jsonPath("$.variants[0].color").doesNotExist())
			.andExpect(jsonPath("$.variants[0].active").value(true))
			.andExpect(jsonPath("$.variants[0].version").value(0)));

		assertEquals(1, count("select count(*) from product_variants where product_id = ? and size is null and color is null and color_key is null", id));
		assertEquals(1, count("select count(*) from variant_stock s join product_variants v on v.id = s.variant_id "
				+ "where v.product_id = ? and s.on_hand = 0 and s.reserved = 0", id));
		// Explicit false behaves the same as absent
		create(adminToken, "{\"name\":\"B\",\"categoryId\":%d,\"unit\":\"UNIT\",\"minStock\":0,\"hasVariants\":false}".formatted(foodId))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.hasVariants").value(false));
	}

	@Test
	void ca2_editingSimpleProductUpdatesItsHiddenVariant() throws Exception {
		String sku = unique("ED");
		long id = idOf(create(adminToken, simple("Editable", sku, "1")));
		String newSku = unique("ED2");
		putJson(id, operatorToken, """
				{"name":"Editable 2","sku":" %s ","categoryId":%d,"unit":"UNIT","minStock":3,"version":0}
				""".formatted(newSku.toLowerCase(), foodId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.sku").value(newSku))
			.andExpect(jsonPath("$.minStock").value(3))
			.andExpect(jsonPath("$.variants[0].sku").value(newSku))
			.andExpect(jsonPath("$.variants[0].minStock").value(3))
			.andExpect(jsonPath("$.version").value(1));

		// Another product's SKU (simple or variant): 409; its own: fine; clearing it: fine
		long other = idOf(create(adminToken, withVariants("Con tallas", "[" + variant(unique("OV"), "M", null, "0") + "]")));
		String otherSku = JsonPath.read(getProduct(other).andReturn().getResponse().getContentAsString(), "$.variants[0].sku");
		putJson(id, adminToken, """
				{"name":"Editable 2","sku":"%s","categoryId":%d,"unit":"UNIT","minStock":3,"version":1}
				""".formatted(otherSku.toLowerCase(), foodId))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"));
		putJson(id, adminToken, """
				{"name":"Editable 2","sku":null,"categoryId":%d,"unit":"UNIT","minStock":3,"version":1}
				""".formatted(foodId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.sku").doesNotExist())
			// Only the hidden variant changed, yet the product version moves: the version that rules is the product one
			.andExpect(jsonPath("$.version").value(2));
		// A PUT that changes nothing does not move any version
		putJson(id, adminToken, """
				{"name":"Editable 2","sku":null,"categoryId":%d,"unit":"UNIT","minStock":3,"version":2}
				""".formatted(foodId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value(2));

		// minStock is required for a simple product (the field error is the same as in HU-02)
		putJson(id, adminToken, """
				{"name":"Editable 2","categoryId":%d,"unit":"UNIT","version":2}
				""".formatted(foodId))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.minStock").value("es obligatorio"));
	}

	@Test
	void ca3_variantEndpointsOnASimpleProductAreConflict() throws Exception {
		long id = idOf(create(adminToken, simple("Simple", null, "0")));
		long variantId = firstVariantId(id);
		postJson(PRODUCTS + "/" + id + "/variants", adminToken, "{\"variants\":[" + variant(null, "M", null, "0") + "]}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.no_variants"));
		putJson(PRODUCTS + "/" + id + "/variants/" + variantId, adminToken,
				"{\"sku\":null,\"size\":\"M\",\"color\":null,\"minStock\":0,\"version\":0}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.no_variants"));
		postNoBody(PRODUCTS + "/" + id + "/variants/" + variantId + "/deactivate", adminToken)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.no_variants"));
		postNoBody(PRODUCTS + "/" + id + "/variants/" + variantId + "/activate", adminToken)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.no_variants"));
	}

	// ---------------------------------------------------------------- create with variants (CA-4 .. CA-7)

	@Test
	void ca4_createWithVariantsReturnsAllOfThemWithZeroStock() throws Exception {
		String s1 = unique("A");
		String s2 = unique("B");
		String s3 = unique("C");
		long id = idOf(create(adminToken, withVariants("Camiseta", "[" + variant(s1, "M", "Blanco", "2") + ","
				+ variant(s2, "L", "Blanco", "0") + "," + variant(s3, "S", "Azul marino", "1.5") + "]"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.hasVariants").value(true))
			.andExpect(jsonPath("$.variantCount").value(3))
			.andExpect(jsonPath("$.sku").doesNotExist())
			.andExpect(jsonPath("$.minStock").doesNotExist())
			.andExpect(jsonPath("$.variants", hasSize(3)))
			.andExpect(jsonPath("$.variants[0].size").value("S"))
			.andExpect(jsonPath("$.variants[0].color").value("Azul marino"))
			.andExpect(jsonPath("$.variants[0].minStock").value(1.5))
			.andExpect(jsonPath("$.variants[0].stock.onHand").value(0))
			.andExpect(jsonPath("$.variants[0].version").value(0))
			.andExpect(jsonPath("$.stock.onHand").value(0))
			.andExpect(jsonPath("$.stock.averageCost").doesNotExist())
			.andExpect(jsonPath("$.stock.costCurrency").doesNotExist())
			.andExpect(jsonPath("$.version").value(0)));
		assertEquals(3, count("select count(*) from product_variants where product_id = ?", id));
		assertEquals(3, count("select count(*) from variant_stock s join product_variants v on v.id = s.variant_id "
				+ "where v.product_id = ?", id));
		assertEquals(1, count("select count(*) from products where id = ? and has_variants = true", id));
		getProduct(id).andExpect(jsonPath("$.variantCount").value(3));
	}

	@Test
	void ca4_structuralErrors() throws Exception {
		String one = "[" + variant(null, "M", null, "0") + "]";
		// product-level sku or minStock together with hasVariants = true
		create(adminToken, "{\"name\":\"X\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":true,\"sku\":\"ZZ-1\",\"variants\":%s}"
			.formatted(foodId, one))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.variant_fields_not_allowed"));
		create(adminToken, "{\"name\":\"X\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":true,\"minStock\":0,\"variants\":%s}"
			.formatted(foodId, one))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.variant_fields_not_allowed"));
		// variants absent or empty with hasVariants = true
		create(adminToken, "{\"name\":\"X\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":true}".formatted(foodId))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.variants").value("no puede estar vacío"));
		create(adminToken, "{\"name\":\"X\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":true,\"variants\":[]}"
			.formatted(foodId))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.variants").exists());
		// variants present with hasVariants false or absent
		create(adminToken, "{\"name\":\"X\",\"categoryId\":%d,\"unit\":\"UNIT\",\"minStock\":0,\"variants\":%s}"
			.formatted(foodId, one))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.variant_fields_not_allowed"));
		// simple without minStock
		create(adminToken, "{\"name\":\"X\",\"categoryId\":%d,\"unit\":\"UNIT\"}".formatted(foodId))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.minStock").value("es obligatorio"));
		// more than 100
		String many = "[" + String.join(",", java.util.Collections.nCopies(101, variant(null, "M", null, "0"))) + "]";
		create(adminToken, withVariants("Muchas", many))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.variants").exists());
		// translated
		mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content(withVariants("X", "[]")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.variants").value("must not be empty"));
	}

	@Test
	void ca4_hundredVariantsAreAccepted() throws Exception {
		StringBuilder sb = new StringBuilder("[");
		for (int i = 0; i < 100; i++) {
			sb.append(i == 0 ? "" : ",").append(variant(null, String.valueOf(30 + i), null, "0"));
		}
		create(adminToken, withVariants("Cien", sb.append("]").toString()))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.variantCount").value(100));
	}

	@Test
	void ca5_optionsAreRequired() throws Exception {
		for (String v : List.of(variant(null, null, null, "0"), variant(null, "  ", "   ", "0"),
				"{\"minStock\":0}")) {
			create(adminToken, withVariants("Sin opciones", "[" + v + "]"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("variant.options_required"))
				.andExpect(jsonPath("$.detail").value("Indica la talla, el color o ambos."));
		}
		// Only a color, or only a size, is enough
		create(adminToken, withVariants("Solo color", "[" + variant(null, null, "Rojo", "0") + "]"))
			.andExpect(status().isCreated());
		create(adminToken, withVariants("Solo talla", "[" + variant(null, "Única", null, "0") + "]"))
			.andExpect(status().isCreated());
	}

	@Test
	void ca6_normalizationAndLengths() throws Exception {
		long id = idOf(create(adminToken, withVariants("Norm", "[" + variant(null, " m ", "  Rojo vivo ", "0") + ","
				+ variant(null, "  ", "Verde", "0") + "]"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.variants[?(@.color == 'Rojo vivo')].size").value(contains("M"))));
		assertEquals(1, count("select count(*) from product_variants where product_id = ? and color_key = 'verde' and size is null", id));
		assertEquals(1, count("select count(*) from product_variants where product_id = ? and color_key = 'rojo vivo' and size = 'M'", id));

		create(adminToken, withVariants("Largo", "[" + variant(null, "M", "Rojo", "0") + ","
				+ variant(null, "X".repeat(21), "C".repeat(31), "0") + "]"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors['variants[1].size']").exists())
			.andExpect(jsonPath("$.errors['variants[1].color']").exists());
		create(adminToken, withVariants("Limites", "[" + variant(null, "X".repeat(20), "C".repeat(30), "0") + "]"))
			.andExpect(status().isCreated());
		// Invalid SKU and minStock inside a variant: errors by indexed path
		create(adminToken, withVariants("Malo", "[" + variant("a b!", "M", null, "-1") + "]"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors['variants[0].sku']").exists())
			.andExpect(jsonPath("$.errors['variants[0].minStock']").value("debe ser mayor o igual que 0"));
	}

	@Test
	void ca7_duplicateOptionsAreConflictIgnoringCase() throws Exception {
		String name = "Dup " + unique("N");
		create(adminToken, withVariants(name, "[" + variant(null, "M", "Rojo", "0") + "," + variant(null, "M", "rojo", "0") + "]"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("variant.options_conflict"))
			.andExpect(jsonPath("$.detail").value("Este producto ya tiene una variante con las opciones M / rojo."));
		create(adminToken, withVariants(name, "[" + variant(null, "M", "Marrón", "0") + "," + variant(null, "m", "MARRÓN", "0") + "]"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("variant.options_conflict"));
		// Nothing was saved
		assertEquals(0, count("select count(*) from products where name = ?", name));
		// Same options without color / without size also collide
		create(adminToken, withVariants(name, "[" + variant(null, "M", null, "0") + "," + variant(null, "m", "  ", "0") + "]"))
			.andExpect(status().isConflict());
		// Accents alone do NOT make a duplicate (only the frontend warns)
		create(adminToken, withVariants(name, "[" + variant(null, "M", "Marron", "0") + "," + variant(null, "M", "Marrón", "0") + "]"))
			.andExpect(status().isCreated());
	}

	@Test
	void ca7_duplicateOrUsedSkuIsConflictAndNothingIsSaved() throws Exception {
		String name = "SkuDup " + unique("N");
		String sku = unique("DS");
		create(adminToken, withVariants(name, "[" + variant(sku, "M", null, "0") + "," + variant(sku.toLowerCase(), "L", null, "0") + "]"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"));
		assertEquals(0, count("select count(*) from products where name = ?", name));

		// SKU already used by a simple product, by a variant of another product, active or inactive
		String used = unique("USED");
		create(adminToken, simple("Simple con SKU", used, "0")).andExpect(status().isCreated());
		create(adminToken, withVariants(name, "[" + variant(used, "M", null, "0") + "]"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"));
		String vsku = unique("VSK");
		long p = idOf(create(adminToken, withVariants("Dueño", "[" + variant(vsku, "M", null, "0") + "]")));
		postNoBody(PRODUCTS + "/" + p + "/variants/" + firstVariantId(p) + "/deactivate", adminToken).andExpect(status().isOk());
		create(adminToken, simple("Otro", vsku, "0"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"));
		// Several variants without SKU are fine
		create(adminToken, withVariants(name, "[" + variant(null, "M", null, "0") + "," + variant(null, "L", null, "0") + "]"))
			.andExpect(status().isCreated());
	}

	// ---------------------------------------------------------------- manage variants (CA-8 .. CA-11)

	@Test
	void ca8_addVariantsReturnsTheWholeProductAndIsAllOrNothing() throws Exception {
		long id = idOf(create(adminToken, withVariants("Base", "[" + variant(null, "M", "Rojo", "0") + "]")));
		String sku = unique("ADD");
		postJson(PRODUCTS + "/" + id + "/variants", operatorToken, "{\"variants\":[" + variant(sku, "L", "Rojo", "1") + ","
				+ variant(null, "S", "Rojo", "0") + "]}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").value(id))
			.andExpect(jsonPath("$.variantCount").value(3))
			.andExpect(jsonPath("$.variants", hasSize(3)))
			.andExpect(jsonPath("$.variants[*].size").value(contains("S", "M", "L")));
		assertEquals(3, count("select count(*) from variant_stock s join product_variants v on v.id = s.variant_id where v.product_id = ?", id));

		// Duplicate against existing (case-insensitive) -> 409, and the valid one in the same request is NOT saved
		postJson(PRODUCTS + "/" + id + "/variants", adminToken, "{\"variants\":[" + variant(null, "XL", "Rojo", "0") + ","
				+ variant(null, "m", "ROJO", "0") + "]}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("variant.options_conflict"))
			.andExpect(jsonPath("$.detail").value("Este producto ya tiene una variante con las opciones M / ROJO."));
		// Duplicate against an INACTIVE existing one is also a conflict
		postNoBody(PRODUCTS + "/" + id + "/variants/" + variantIdBySize(id, "S") + "/deactivate", adminToken).andExpect(status().isOk());
		postJson(PRODUCTS + "/" + id + "/variants", adminToken, "{\"variants\":[" + variant(null, "S", "rojo", "0") + "]}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("variant.options_conflict"));
		// SKU already used
		postJson(PRODUCTS + "/" + id + "/variants", adminToken, "{\"variants\":[" + variant(sku, "XXL", "Rojo", "0") + "]}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"));
		// Options required, empty list, validation
		postJson(PRODUCTS + "/" + id + "/variants", adminToken, "{\"variants\":[" + variant(null, null, null, "0") + "]}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("variant.options_required"));
		postJson(PRODUCTS + "/" + id + "/variants", adminToken, "{\"variants\":[]}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.variants").exists());
		postJson(PRODUCTS + "/" + id + "/variants", adminToken, "{\"variants\":[" + variant(null, "X".repeat(21), null, "0") + "]}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors['variants[0].size']").exists());
		assertEquals(3, count("select count(*) from product_variants where product_id = ?", id));
		// Unknown product
		postJson(PRODUCTS + "/999999/variants", adminToken, "{\"variants\":[" + variant(null, "M", null, "0") + "]}")
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("product.not_found"));
	}

	@Test
	@SuppressWarnings("unchecked")
	void ca9_editVariantBumpsItsOwnVersion() throws Exception {
		long id = idOf(create(adminToken, withVariants("Edit", "[" + variant(unique("E1"), "M", "Rojo", "0") + ","
				+ variant(unique("E2"), "L", "Rojo", "0") + "]")));
		long m = variantIdBySize(id, "M");
		String newSku = unique("EN");
		putJson(PRODUCTS + "/" + id + "/variants/" + m, operatorToken, "{\"sku\":\"%s\",\"size\":\" xl \",\"color\":\"Azul\",\"minStock\":4,\"version\":0}"
			.formatted(newSku.toLowerCase()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.variants[?(@.id == %d)].version".formatted(m)).value(contains(1)))
			.andExpect(jsonPath("$.variants[?(@.id == %d)].size".formatted(m)).value(contains("XL")))
			.andExpect(jsonPath("$.variants[?(@.id == %d)].sku".formatted(m)).value(contains(newSku)))
			.andExpect(jsonPath("$.variants[?(@.id == %d)].minStock".formatted(m)).value(contains(4.0)));

		// Stale version
		putJson(PRODUCTS + "/" + id + "/variants/" + m, adminToken, "{\"sku\":null,\"size\":\"XL\",\"color\":\"Azul\",\"minStock\":4,\"version\":0}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("resource.version_conflict"));
		// Same options as the sibling (case-insensitive) -> conflict; keeping its own options is fine
		putJson(PRODUCTS + "/" + id + "/variants/" + m, adminToken, "{\"sku\":null,\"size\":\"L\",\"color\":\"rojo\",\"minStock\":4,\"version\":1}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("variant.options_conflict"));
		putJson(PRODUCTS + "/" + id + "/variants/" + m, adminToken, "{\"sku\":null,\"size\":\"XL\",\"color\":\"AZUL\",\"minStock\":4,\"version\":1}")
			.andExpect(status().isOk());
		// SKU of the sibling
		String siblingSku = ((List<String>) JsonPath.read(getProduct(id).andReturn().getResponse().getContentAsString(), "$.variants[?(@.size == 'L')].sku")).get(0);
		putJson(PRODUCTS + "/" + id + "/variants/" + m, adminToken, "{\"sku\":\"%s\",\"size\":\"XL\",\"color\":\"AZUL\",\"minStock\":4,\"version\":2}"
			.formatted(siblingSku))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.sku_conflict"));
		// Options required, version required
		putJson(PRODUCTS + "/" + id + "/variants/" + m, adminToken, "{\"sku\":null,\"size\":null,\"color\":\" \",\"minStock\":4,\"version\":2}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("variant.options_required"));
		putJson(PRODUCTS + "/" + id + "/variants/" + m, adminToken, "{\"size\":\"XL\",\"minStock\":4}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.version").value("es obligatorio"));
	}

	@Test
	void ca9_variantOfAnotherOrUnknownProductIsNotFound() throws Exception {
		long a = idOf(create(adminToken, withVariants("A", "[" + variant(null, "M", null, "0") + "]")));
		long b = idOf(create(adminToken, withVariants("B", "[" + variant(null, "M", null, "0") + "]")));
		long bVariant = firstVariantId(b);
		String body = "{\"sku\":null,\"size\":\"L\",\"color\":null,\"minStock\":0,\"version\":0}";
		putJson(PRODUCTS + "/" + a + "/variants/" + bVariant, adminToken, body)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("variant.not_found"))
			.andExpect(jsonPath("$.detail").value("No existe la variante " + bVariant + "."));
		putJson(PRODUCTS + "/" + a + "/variants/999999", adminToken, body)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("variant.not_found"));
		postNoBody(PRODUCTS + "/" + a + "/variants/" + bVariant + "/deactivate", adminToken)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("variant.not_found"));
		putJson(PRODUCTS + "/999999/variants/" + bVariant, adminToken, body)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("product.not_found"));
		// B is untouched
		getProduct(b).andExpect(jsonPath("$.variants[0].size").value("M")).andExpect(jsonPath("$.variants[0].version").value(0));
	}

	@Test
	void ca10_deactivateAndActivateAreIdempotentAndAdminOnly() throws Exception {
		long id = idOf(create(adminToken, withVariants("Toggle", "[" + variant(null, "M", null, "2") + ","
				+ variant(null, "L", null, "0") + "]")));
		long m = variantIdBySize(id, "M");
		jdbc.update("update variant_stock set on_hand = 7 where variant_id = ?", m);
		String url = PRODUCTS + "/" + id + "/variants/" + m;

		postNoBody(url + "/deactivate", operatorToken).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("auth.forbidden"));
		postNoBody(url + "/activate", operatorToken).andExpect(status().isForbidden());

		postNoBody(url + "/deactivate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.variants[?(@.id == %d)].active".formatted(m)).value(contains(false)))
			.andExpect(jsonPath("$.variants[?(@.id == %d)].stock.onHand".formatted(m)).value(contains(7.0)))
			.andExpect(jsonPath("$.variants[?(@.id == %d)].version".formatted(m)).value(contains(1)));
		// Idempotent: no new version
		postNoBody(url + "/deactivate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.variants[?(@.id == %d)].version".formatted(m)).value(contains(1)));
		// The aggregate still counts its units (CA-15)
		getProduct(id).andExpect(jsonPath("$.stock.onHand").value(7)).andExpect(jsonPath("$.variantCount").value(2));
		postNoBody(url + "/activate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.variants[?(@.id == %d)].active".formatted(m)).value(contains(true)))
			.andExpect(jsonPath("$.variants[?(@.id == %d)].version".formatted(m)).value(contains(2)));
		postNoBody(url + "/activate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.variants[?(@.id == %d)].version".formatted(m)).value(contains(2)));
	}

	@Test
	void ca10_deactivatingTheLastActiveVariantKeepsUnitsAndRaisesNoAlert() throws Exception {
		long id = idOf(create(adminToken, withVariants("Ultima", "[" + variant(null, "M", null, "5") + "]")));
		long v = firstVariantId(id);
		jdbc.update("update variant_stock set on_hand = 2 where variant_id = ?", v);
		getProduct(id).andExpect(jsonPath("$.lowStock").value(true));
		postNoBody(PRODUCTS + "/" + id + "/variants/" + v + "/deactivate", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.lowStock").value(false))
			.andExpect(jsonPath("$.variants[0].lowStock").value(false))
			.andExpect(jsonPath("$.stock.onHand").value(2));
		list("q=Ultima").andExpect(jsonPath("$.content[0].stock.onHand").value(2))
			.andExpect(jsonPath("$.content[0].lowStock").value(false));
	}

	@Test
	void ca11_variantsCannotBeDeleted() throws Exception {
		long id = idOf(create(adminToken, withVariants("NoBorrar", "[" + variant(null, "M", null, "0") + "]")));
		mvc.perform(delete(PRODUCTS + "/" + id + "/variants/" + firstVariantId(id)).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isMethodNotAllowed())
			.andExpect(jsonPath("$.code").value("request.method_not_allowed"));
	}

	// ---------------------------------------------------------------- convert (CA-12, CA-13, CA-13b)

	@Test
	void ca12_simpleToWithVariantsKeepsIdSkuThresholdAndStock() throws Exception {
		String sku = unique("CNV");
		long id = idOf(create(adminToken, simple("Convertible", sku, "3")));
		long variantId = firstVariantId(id);
		jdbc.update("update variant_stock set on_hand = 9, reserved = 2, average_cost = 4.5000, cost_currency = 'USD' where variant_id = ?", variantId);

		postJson(PRODUCTS + "/" + id + "/variants/enable", operatorToken, "{\"size\":\" m \",\"color\":\"Blanco\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.hasVariants").value(true))
			.andExpect(jsonPath("$.version").value(1))
			.andExpect(jsonPath("$.sku").doesNotExist())
			.andExpect(jsonPath("$.minStock").doesNotExist())
			.andExpect(jsonPath("$.variantCount").value(1))
			.andExpect(jsonPath("$.variants[0].id").value(variantId))
			.andExpect(jsonPath("$.variants[0].sku").value(sku))
			.andExpect(jsonPath("$.variants[0].size").value("M"))
			.andExpect(jsonPath("$.variants[0].color").value("Blanco"))
			.andExpect(jsonPath("$.variants[0].minStock").value(3))
			.andExpect(jsonPath("$.variants[0].stock.onHand").value(9))
			.andExpect(jsonPath("$.variants[0].stock.reserved").value(2))
			.andExpect(jsonPath("$.stock.available").value(7))
			.andExpect(jsonPath("$.stock.averageCost").value(4.5));
		assertEquals(1, count("select count(*) from product_variants where product_id = ? and color_key = 'blanco'", id));

		// Already with variants
		postJson(PRODUCTS + "/" + id + "/variants/enable", adminToken, "{\"size\":\"L\"}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.has_variants"));
	}

	@Test
	void ca12_enableNeedsOptionsAndAnExistingProduct() throws Exception {
		long id = idOf(create(adminToken, simple("SinOpciones", null, "0")));
		postJson(PRODUCTS + "/" + id + "/variants/enable", adminToken, "{}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("variant.options_required"));
		postJson(PRODUCTS + "/" + id + "/variants/enable", adminToken, "{\"size\":\"  \",\"color\":\" \"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("variant.options_required"));
		// Nothing changed
		getProduct(id).andExpect(jsonPath("$.hasVariants").value(false)).andExpect(jsonPath("$.version").value(0));
		postJson(PRODUCTS + "/999999/variants/enable", adminToken, "{\"size\":\"M\"}")
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("product.not_found"));
		postJson(PRODUCTS + "/" + id + "/variants/enable", adminToken, "{\"size\":\"" + "X".repeat(21) + "\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.size").exists());
	}

	@Test
	void ca13_withVariantsToSimpleOnlyWithOneVariant() throws Exception {
		String sku = unique("BACK");
		long id = idOf(create(adminToken, withVariants("Volver", "[" + variant(sku, "M", "Rojo", "2") + ","
				+ variant(null, "L", "Rojo", "0") + "]")));
		// More than one variant
		postNoBody(PRODUCTS + "/" + id + "/variants/disable", adminToken)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.has_multiple_variants"));
		// Down to one variant, which is inactive: it becomes simple and active
		long m = variantIdBySize(id, "M");
		long l = variantIdBySize(id, "L");
		postNoBody(PRODUCTS + "/" + id + "/variants/" + m + "/deactivate", adminToken).andExpect(status().isOk());
		jdbc.update("delete from variant_stock where variant_id = ?", l);
		jdbc.update("delete from product_variants where id = ?", l);
		jdbc.update("update variant_stock set on_hand = 6 where variant_id = ?", m);

		postNoBody(PRODUCTS + "/" + id + "/variants/disable", operatorToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.hasVariants").value(false))
			.andExpect(jsonPath("$.version").value(1))
			.andExpect(jsonPath("$.sku").value(sku))
			.andExpect(jsonPath("$.minStock").value(2))
			.andExpect(jsonPath("$.variantCount").value(1))
			.andExpect(jsonPath("$.variants[0].id").value(m))
			.andExpect(jsonPath("$.variants[0].size").doesNotExist())
			.andExpect(jsonPath("$.variants[0].color").doesNotExist())
			.andExpect(jsonPath("$.variants[0].active").value(true))
			.andExpect(jsonPath("$.stock.onHand").value(6));
		assertEquals(1, count("select count(*) from product_variants where product_id = ? and size is null and color_key is null and active = true", id));
		// Already simple
		postNoBody(PRODUCTS + "/" + id + "/variants/disable", adminToken)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("product.no_variants"));
		postNoBody(PRODUCTS + "/999999/variants/disable", adminToken).andExpect(status().isNotFound());
	}

	@Test
	void ca13b_variantOperationsDoNotMoveTheProductVersionButConversionsDo() throws Exception {
		long id = idOf(create(adminToken, withVariants("Versiones", "[" + variant(null, "M", "Rojo", "0") + "]")));
		String before = getProduct(id).andReturn().getResponse().getContentAsString();
		long m = firstVariantId(id);

		postJson(PRODUCTS + "/" + id + "/variants", adminToken, "{\"variants\":[" + variant(null, "L", "Rojo", "0") + "]}")
			.andExpect(status().isCreated());
		putJson(PRODUCTS + "/" + id + "/variants/" + m, adminToken, "{\"sku\":null,\"size\":\"M\",\"color\":\"Rojo\",\"minStock\":2,\"version\":0}")
			.andExpect(status().isOk());
		postNoBody(PRODUCTS + "/" + id + "/variants/" + m + "/deactivate", adminToken).andExpect(status().isOk());
		postNoBody(PRODUCTS + "/" + id + "/variants/" + m + "/activate", adminToken).andExpect(status().isOk());

		getProduct(id).andExpect(jsonPath("$.version").value((Integer) JsonPath.read(before, "$.version")))
			.andExpect(jsonPath("$.updatedAt").value((String) JsonPath.read(before, "$.updatedAt")));
		assertEquals(0L, jdbc.queryForObject("select version from products where id = ?", Long.class, id));

		// A PUT with the version held before those operations is NOT a false conflict
		putJson(id, adminToken, "{\"name\":\"Versiones 2\",\"categoryId\":%d,\"unit\":\"UNIT\",\"version\":0}".formatted(foodId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value(1));

		// Converting changes hasVariants: a form opened before it must get 409
		long lId = variantIdBySize(id, "L");
		postNoBody(PRODUCTS + "/" + id + "/variants/" + lId + "/deactivate", adminToken).andExpect(status().isOk());
		jdbc.update("delete from variant_stock where variant_id = ?", lId);
		jdbc.update("delete from product_variants where id = ?", lId);
		postNoBody(PRODUCTS + "/" + id + "/variants/disable", adminToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value(2));
		putJson(id, adminToken, "{\"name\":\"Versiones 3\",\"categoryId\":%d,\"unit\":\"UNIT\",\"minStock\":0,\"version\":1}".formatted(foodId))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("resource.version_conflict"));
		postJson(PRODUCTS + "/" + id + "/variants/enable", adminToken, "{\"size\":\"S\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value(3));
		putJson(id, adminToken, "{\"name\":\"Versiones 4\",\"categoryId\":%d,\"unit\":\"UNIT\",\"version\":2}".formatted(foodId))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("resource.version_conflict"));
	}

	@Test
	void putOfAProductWithVariantsRejectsProductLevelSkuAndMinStock() throws Exception {
		long id = idOf(create(adminToken, withVariants("PutVar", "[" + variant(null, "M", null, "0") + "]")));
		putJson(id, adminToken, "{\"name\":\"X\",\"sku\":\"AB-1\",\"categoryId\":%d,\"unit\":\"UNIT\",\"version\":0}".formatted(foodId))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.variant_fields_not_allowed"));
		putJson(id, adminToken, "{\"name\":\"X\",\"categoryId\":%d,\"unit\":\"UNIT\",\"minStock\":1,\"version\":0}".formatted(foodId))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("product.variant_fields_not_allowed"));
		putJson(id, adminToken, "{\"name\":\"Renombrado\",\"categoryId\":%d,\"unit\":\"UNIT\",\"version\":0}".formatted(foodId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Renombrado"))
			.andExpect(jsonPath("$.variants", hasSize(1)));
	}

	// ---------------------------------------------------------------- read (CA-14 .. CA-17)

	@Test
	void ca14_variantsAreSortedBySizeThenColor() throws Exception {
		String variants = "[" + String.join(",", variant(null, "L", "Rojo", "0"), variant(null, "38", "Rojo", "0"),
				variant(null, "M", "Rojo", "0"), variant(null, "XL", "Rojo", "0"), variant(null, "Única", "Rojo", "0"),
				variant(null, "S", "Rojo", "0"), variant(null, "36", "Rojo", "0")) + "]";
		long id = idOf(create(adminToken, withVariants("Orden", variants)));
		getProduct(id).andExpect(jsonPath("$.variants[*].size").value(contains("S", "M", "L", "XL", "36", "38", "ÚNICA")));

		String more = "[" + String.join(",", variant(null, "3XL", "Rojo", "0"), variant(null, "2XL", "Rojo", "0"),
				variant(null, "XXS", "Rojo", "0"), variant(null, "10.5", "Rojo", "0"), variant(null, "9", "Rojo", "0"),
				variant(null, "100", "Rojo", "0"), variant(null, null, "Rojo", "0"), variant(null, "ancha", "Rojo", "0"),
				variant(null, "Alta", "Rojo", "0"), variant(null, "S", "Azul", "0"), variant(null, "S", "verde", "0"),
				variant(null, "S", "Ámbar", "0"), variant(null, "S", null, "0")) + "]";
		postJson(PRODUCTS + "/" + id + "/variants", adminToken, "{\"variants\":" + more + "}").andExpect(status().isCreated());
		// canonical (XXS < S < M < L < XL < 2XL(=XXL) < 3XL(=XXXL)), numeric (9 < 10.5 < 36 < 38 < 100), the rest
		// alphabetically (ALTA < ANCHA < ÚNICA), no size last; same size: color alphabetical, colorless last
		List<String> sizes = JsonPath.read(getProduct(id).andReturn().getResponse().getContentAsString(), "$.variants[*].size");
		assertEquals(java.util.Arrays.asList("XXS", "S", "S", "S", "S", "S", "M", "L", "XL", "2XL", "3XL", "9", "10.5",
				"36", "38", "100", "ALTA", "ANCHA", "ÚNICA", null), sizes);
		List<String> smallColors = JsonPath.read(getProduct(id).andReturn().getResponse().getContentAsString(),
				"$.variants[?(@.size == 'S')].color");
		assertEquals(java.util.Arrays.asList("Ámbar", "Azul", "Rojo", "verde", null), smallColors);
	}

	@Test
	void ca15_aggregateIsWeightedOverAllVariantsActiveOrNot() throws Exception {
		long id = idOf(create(adminToken, withVariants("Agregado " + unique("AG"), "[" + variant(null, "M", null, "0") + ","
				+ variant(null, "L", null, "0") + "]")));
		long a = variantIdBySize(id, "M");
		long b = variantIdBySize(id, "L");
		// Both without units: no average cost
		getProduct(id).andExpect(jsonPath("$.stock.onHand").value(0)).andExpect(jsonPath("$.stock.averageCost").doesNotExist())
			.andExpect(jsonPath("$.stock.costCurrency").doesNotExist());

		jdbc.update("update variant_stock set on_hand = 10, reserved = 1, average_cost = 5.0000, cost_currency = 'USD' where variant_id = ?", a);
		jdbc.update("update variant_stock set on_hand = 30, reserved = 4, average_cost = 9.0000, cost_currency = 'USD' where variant_id = ?", b);
		postNoBody(PRODUCTS + "/" + id + "/variants/" + b + "/deactivate", adminToken).andExpect(status().isOk());

		// (10*5 + 30*9) / 40 = 8.0000: neither 14 (sum) nor 7 (plain mean)
		getProduct(id).andExpect(jsonPath("$.stock.onHand").value(40))
			.andExpect(jsonPath("$.stock.reserved").value(5))
			.andExpect(jsonPath("$.stock.available").value(35))
			.andExpect(jsonPath("$.stock.averageCost").value(8.0))
			.andExpect(jsonPath("$.stock.costCurrency").value("USD"));
		list("q=Agregado").andExpect(jsonPath("$.content[0].stock.onHand").value(40))
			.andExpect(jsonPath("$.content[0].stock.reserved").value(5))
			.andExpect(jsonPath("$.content[0].stock.available").value(35))
			.andExpect(jsonPath("$.content[0].stock.averageCost").value(8.0))
			.andExpect(jsonPath("$.content[0].stock.costCurrency").value("USD"))
			.andExpect(jsonPath("$.content[0].variantCount").value(2))
			.andExpect(jsonPath("$.content[0].hasVariants").value(true))
			.andExpect(jsonPath("$.content[0].sku").doesNotExist())
			.andExpect(jsonPath("$.content[0].minStock").doesNotExist())
			.andExpect(jsonPath("$.content[0].variants").doesNotExist());

		// A variant without cost does not dilute the weighted average (only variants with cost count)
		jdbc.update("update variant_stock set on_hand = 0, average_cost = null, cost_currency = null where variant_id = ?", b);
		jdbc.update("update variant_stock set on_hand = 3, average_cost = 4.3333, cost_currency = 'USD' where variant_id = ?", a);
		getProduct(id).andExpect(jsonPath("$.stock.averageCost").value(4.3333));

		// Both back to zero units with a recorded cost: null
		jdbc.update("update variant_stock set on_hand = 0, reserved = 0 where variant_id in (?, ?)", a, b);
		getProduct(id).andExpect(jsonPath("$.stock.onHand").value(0)).andExpect(jsonPath("$.stock.averageCost").doesNotExist());
	}

	@Test
	void ca15_weightedAverageRoundsHalfUpToFourDecimals() throws Exception {
		long id = idOf(create(adminToken, withVariants("Redondeo", "[" + variant(null, "M", null, "0") + ","
				+ variant(null, "L", null, "0") + "]")));
		jdbc.update("update variant_stock set on_hand = 1, average_cost = 1.0000, cost_currency = 'USD' where variant_id = ?", variantIdBySize(id, "M"));
		jdbc.update("update variant_stock set on_hand = 2, average_cost = 1.0001, cost_currency = 'USD' where variant_id = ?", variantIdBySize(id, "L"));
		// (1.0000 + 2.0002) / 3 = 1.000066.. -> 1.0001
		getProduct(id).andExpect(jsonPath("$.stock.averageCost").value(1.0001));
		jdbc.update("update variant_stock set on_hand = 1, average_cost = 1.0000 where variant_id = ?", variantIdBySize(id, "M"));
		jdbc.update("update variant_stock set on_hand = 1, average_cost = 1.0001 where variant_id = ?", variantIdBySize(id, "L"));
		// (1.0000 + 1.0001) / 2 = 1.00005 -> HALF_UP 1.0001
		getProduct(id).andExpect(jsonPath("$.stock.averageCost").value(1.0001));
	}

	@Test
	void ca15_lowStockCountsOnlyActiveVariantsAndTheListAgreesWithTheDetail() throws Exception {
		long id = idOf(create(adminToken, withVariants("Alerta " + unique("AL"), "[" + variant(null, "M", null, "5") + ","
				+ variant(null, "L", null, "5") + "]")));
		long m = variantIdBySize(id, "M");
		long l = variantIdBySize(id, "L");
		jdbc.update("update variant_stock set on_hand = 50 where variant_id = ?", m);
		jdbc.update("update variant_stock set on_hand = 5 where variant_id = ?", l);
		getProduct(id).andExpect(jsonPath("$.lowStock").value(true))
			.andExpect(jsonPath("$.variants[?(@.size == 'L')].lowStock").value(contains(true)))
			.andExpect(jsonPath("$.variants[?(@.size == 'M')].lowStock").value(contains(false)));
		list("q=Alerta").andExpect(jsonPath("$.content[0].lowStock").value(true));
		// The low variant is deactivated: no alert any more
		postNoBody(PRODUCTS + "/" + id + "/variants/" + l + "/deactivate", adminToken).andExpect(status().isOk());
		getProduct(id).andExpect(jsonPath("$.lowStock").value(false))
			.andExpect(jsonPath("$.variants[?(@.size == 'L')].lowStock").value(contains(false)));
		list("q=Alerta").andExpect(jsonPath("$.content[0].lowStock").value(false));
		// Back on, and the whole product inactive: no alert either
		postNoBody(PRODUCTS + "/" + id + "/variants/" + l + "/activate", adminToken).andExpect(status().isOk());
		postNoBody(PRODUCTS + "/" + id + "/deactivate", adminToken).andExpect(status().isOk());
		getProduct(id).andExpect(jsonPath("$.lowStock").value(false));
		list("q=Alerta").andExpect(jsonPath("$.content[0].lowStock").value(false));
	}

	@Test
	void ca16_searchFindsProductsBySkuOfAnyVariantAndOnlyOnce() throws Exception {
		String tag = "vq" + UUID.randomUUID().toString().substring(0, 6);
		long withTwo = idOf(create(adminToken, withVariants("Camisa", "[" + variant(tag.toUpperCase() + "-A", "M", null, "0") + ","
				+ variant(tag.toUpperCase() + "-B", "L", null, "0") + ","
				+ variant(unique("OTH"), "S", null, "0") + "]")));
		create(adminToken, simple("Simple " + tag, null, "0")).andExpect(status().isCreated());
		create(adminToken, withVariants("Sin relacion", "[" + variant(unique("NO"), "M", null, "0") + "]"))
			.andExpect(status().isCreated());
		list("q=" + tag).andExpect(jsonPath("$.totalElements").value(2))
			.andExpect(jsonPath("$.content[*].id").value(org.hamcrest.Matchers.hasItem((int) withTwo)));
		list("q=" + tag + "-b").andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.content[0].id").value(withTwo));
		// An inactive variant's SKU is still searchable
		list("q=" + tag + "-a&size=1").andExpect(jsonPath("$.totalElements").value(1));
	}

	@Test
	void ca17_sortBySkuIsRetired() throws Exception {
		list("sort=sku").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("request.invalid_sort"));
		list("sort=sku,desc").andExpect(status().isBadRequest());
		list("sort=name,asc").andExpect(status().isOk());
		list("sort=createdAt,desc").andExpect(status().isOk());
	}

	@Test
	void variantsAreAvailableInAnyProductType() throws Exception {
		// Not only clothing: variants are allowed in food and appliances too (HU-16 "Conceptos")
		create(adminToken, "{\"name\":\"Camiseta\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":true,\"variants\":[%s]}"
			.formatted(clothingId, variant(null, "M", "Blanco", "0")))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.type").value("CLOTHING"));
		create(adminToken, "{\"name\":\"Refresco\",\"categoryId\":%d,\"unit\":\"L\",\"hasVariants\":true,\"variants\":[%s]}"
			.formatted(foodId, variant(null, "2 L", "Cola", "0")))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.type").value("FOOD"));
	}

	// ---------------------------------------------------------------- permissions (CA-20)

	@Test
	void ca20_everyVariantEndpointRequiresAuthentication() throws Exception {
		String base = PRODUCTS + "/1/variants";
		mvc.perform(post(base).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("auth.unauthorized"));
		mvc.perform(put(base + "/1").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
		mvc.perform(post(base + "/1/deactivate")).andExpect(status().isUnauthorized());
		mvc.perform(post(base + "/1/activate")).andExpect(status().isUnauthorized());
		mvc.perform(post(base + "/enable").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
		mvc.perform(post(base + "/disable")).andExpect(status().isUnauthorized());
	}

	@Test
	void ca20_operatorCreatesEditsAndConvertsButCannotToggle() throws Exception {
		long id = idOf(create(operatorToken, withVariants("DeOperador", "[" + variant(null, "M", null, "0") + "]")));
		postJson(PRODUCTS + "/" + id + "/variants", operatorToken, "{\"variants\":[" + variant(null, "L", null, "0") + "]}")
			.andExpect(status().isCreated());
		long m = variantIdBySize(id, "M");
		putJson(PRODUCTS + "/" + id + "/variants/" + m, operatorToken, "{\"sku\":null,\"size\":\"M\",\"color\":\"Azul\",\"minStock\":1,\"version\":0}")
			.andExpect(status().isOk());
		postNoBody(PRODUCTS + "/" + id + "/variants/" + m + "/deactivate", operatorToken).andExpect(status().isForbidden());
		long simpleId = idOf(create(operatorToken, simple("SimpleOp", null, "0")));
		postJson(PRODUCTS + "/" + simpleId + "/variants/enable", operatorToken, "{\"size\":\"M\"}").andExpect(status().isOk());
		postNoBody(PRODUCTS + "/" + simpleId + "/variants/disable", operatorToken).andExpect(status().isOk());
	}

	@Test
	void englishMessagesForTheNewCodes() throws Exception {
		long id = idOf(create(adminToken, withVariants("EnglishVar", "[" + variant(null, "M", "Red", "0") + "]")));
		mvc.perform(post(PRODUCTS + "/" + id + "/variants").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"variants\":[" + variant(null, "m", "RED", "0") + "]}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("This product already has a variant with the options M / RED."));
		mvc.perform(post(PRODUCTS + "/" + id + "/variants/disable").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(status().isOk());
		mvc.perform(post(PRODUCTS + "/" + id + "/variants/disable").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("This product has no variants: it is a simple product."));
		mvc.perform(put(PRODUCTS + "/" + id + "/variants/999999").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"size\":\"M\",\"minStock\":0,\"version\":0}"))
			.andExpect(status().isConflict());
	}

	// ---------------------------------------------------------------- helpers

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
		return "{\"name\":\"%s\",\"sku\":%s,\"categoryId\":%d,\"unit\":\"UNIT\",\"minStock\":%s}".formatted(name, str(sku),
				foodId, minStock);
	}

	private static String withVariants(String name, String variantsJson) {
		return "{\"name\":\"%s\",\"categoryId\":%d,\"unit\":\"UNIT\",\"hasVariants\":true,\"variants\":%s}".formatted(name,
				foodId, variantsJson);
	}

	private int count(String sql, Object... args) {
		return jdbc.queryForObject(sql, Integer.class, args);
	}

	private ResultActions create(String token, String json) throws Exception {
		return mvc.perform(post(PRODUCTS).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private ResultActions putJson(long id, String token, String json) throws Exception {
		return putJson(PRODUCTS + "/" + id, token, json);
	}

	private ResultActions putJson(String url, String token, String json) throws Exception {
		return mvc.perform(put(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private ResultActions postJson(String url, String token, String json) throws Exception {
		return mvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private ResultActions postNoBody(String url, String token) throws Exception {
		return mvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private ResultActions getProduct(long id) throws Exception {
		return mvc.perform(get(PRODUCTS + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private ResultActions list(String query) throws Exception {
		return mvc.perform(get(PRODUCTS + "?" + query).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private long idOf(ResultActions created) throws Exception {
		Number id = JsonPath.read(created.andReturn().getResponse().getContentAsString(), "$.id");
		return id.longValue();
	}

	private long firstVariantId(long productId) throws Exception {
		Number id = JsonPath.read(getProduct(productId).andReturn().getResponse().getContentAsString(), "$.variants[0].id");
		return id.longValue();
	}

	private long variantIdBySize(long productId, String size) throws Exception {
		List<Number> ids = JsonPath.read(getProduct(productId).andReturn().getResponse().getContentAsString(),
				"$.variants[?(@.size == '" + size + "')].id");
		return ids.get(0).longValue();
	}

}
