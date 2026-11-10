package com.cuartico.category;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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

/** HU-15: category management API (acceptance criteria CA-1 .. CA-12, CA-23, CA-24). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CategoryIntegrationTests {

	private static final String CATEGORIES = "/api/v1/categories";

	private static String adminToken;

	private static String operatorToken;

	@Autowired
	MockMvc mvc;

	@BeforeAll
	static void tokens(@Autowired MockMvc mvc) throws Exception {
		adminToken = CategoryFixtures.login(mvc, "admin", "Admin123!test");
		mvc.perform(post("/api/v1/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"username":"cat_operator","password":"Oper12345!","fullName":"Category Operator","role":"OPERATOR"}
						"""))
			.andExpect(status().isCreated());
		operatorToken = CategoryFixtures.login(mvc, "cat_operator", "Oper12345!");
	}

	// ---------------------------------------------------------------- CA-1 seeded roots

	@Test
	void migrationSeedsFourActiveRoots() throws Exception {
		MvcResult r = list("").andExpect(status().isOk()).andReturn();
		String json = r.getResponse().getContentAsString();
		assertRoot(json, "Alimentos", "Food", "FOOD");
		assertRoot(json, "Ropa", "Clothing", "CLOTHING");
		assertRoot(json, "Electrodomésticos", "Appliances", "APPLIANCE");
		assertRoot(json, "Aseo y hogar", "Personal care & home", "OTHER");
	}

	private static void assertRoot(String json, String name, String nameEn, String type) {
		List<Object> found = JsonPath.read(json,
				"$[?(@.parentId == null && @.name == '" + name + "' && @.nameEn == '" + nameEn
						+ "' && @.productType == '" + type + "' && @.active == true && @.depth == 1 && @.path == '"
						+ name + "')]");
		Assertions.assertEquals(1, found.size(), name);
	}

	// ---------------------------------------------------------------- CA-2 root

	@Test
	void adminCreatesRootWith201AndExactShape() throws Exception {
		String name = unique("Raiz");
		MvcResult r = createRaw(adminToken,
				"{\"name\":\"  %s  \",\"nameEn\":\"  Root  \",\"productType\":\"CLOTHING\"}".formatted(name))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.parentId").doesNotExist())
			.andExpect(jsonPath("$.name").value(name))
			.andExpect(jsonPath("$.nameEn").value("Root"))
			.andExpect(jsonPath("$.productType").value("CLOTHING"))
			.andExpect(jsonPath("$.depth").value(1))
			.andExpect(jsonPath("$.active").value(true))
			.andExpect(jsonPath("$.version").value(0))
			.andExpect(jsonPath("$.path").value(name))
			.andExpect(jsonPath("$.pathEn").value("Root"))
			.andExpect(jsonPath("$.productCount").value(0))
			.andExpect(jsonPath("$.createdBy").value("admin"))
			.andExpect(jsonPath("$.createdAt").isNotEmpty())
			.andReturn();
		int id = JsonPath.read(r.getResponse().getContentAsString(), "$.id");
		Assertions.assertTrue(r.getResponse().getHeader("Location").endsWith(CATEGORIES + "/" + id));

		// A blank nameEn becomes null and the English path falls back to the Spanish name
		String other = unique("Raiz");
		createRaw(adminToken, "{\"name\":\"%s\",\"nameEn\":\"   \",\"productType\":\"OTHER\"}".formatted(other))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.nameEn").doesNotExist())
			.andExpect(jsonPath("$.pathEn").value(other));
	}

	@Test
	void rootWithoutTypeIs400TypeRequired() throws Exception {
		createRaw(adminToken, "{\"name\":\"%s\"}".formatted(unique("SinTipo")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("category.type_required"))
			.andExpect(jsonPath("$.detail").value("Indica el tipo de producto de la categoría raíz."));
		mvc.perform(post(CATEGORIES).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"%s\"}".formatted(unique("NoType"))))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("Choose the product type of the root category."));
	}

	// ---------------------------------------------------------------- CA-3 / CA-4 / CA-5 children

	@Test
	void childInheritsTypeAndBuildsPath() throws Exception {
		String rootName = unique("Padre");
		long root = createRoot(rootName, "Parent", "APPLIANCE");
		createRaw(adminToken, "{\"name\":\"Granos\",\"nameEn\":\"Grains\",\"parentId\":%d}".formatted(root))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.parentId").value(root))
			.andExpect(jsonPath("$.depth").value(2))
			.andExpect(jsonPath("$.productType").value("APPLIANCE"))
			.andExpect(jsonPath("$.path").value(rootName + " › Granos"))
			.andExpect(jsonPath("$.pathEn").value("Parent › Grains"));
		// No English name on the child: that level falls back to the Spanish name
		createRaw(adminToken, "{\"name\":\"Sin ingles\",\"parentId\":%d}".formatted(root))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.pathEn").value("Parent › Sin ingles"));
	}

	@Test
	void sendingTheTypeOnAChildIsRejectedEvenIfItMatches() throws Exception {
		long root = createRoot(unique("Padre"), null, "FOOD");
		createRaw(adminToken, "{\"name\":\"Hijo\",\"parentId\":%d,\"productType\":\"FOOD\"}".formatted(root))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("category.type_inherited"));
		createRaw(adminToken, "{\"name\":\"Hijo\",\"parentId\":%d,\"productType\":\"CLOTHING\"}".formatted(root))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("category.type_inherited"));
	}

	@Test
	void depthIsLimitedToThreeLevels() throws Exception {
		long l1 = createRoot(unique("N1"), null, "FOOD");
		long l2 = createChild(l1, "N2");
		long l3 = createChild(l2, "N3");
		createRaw(adminToken, "{\"name\":\"N4\",\"parentId\":%d}".formatted(l3))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("category.max_depth"))
			.andExpect(jsonPath("$.detail").value("Las categorías admiten como máximo 3 niveles."));
		fetch(l3).andExpect(jsonPath("$.depth").value(3));
	}

	@Test
	void invalidParentIs404OrConflict() throws Exception {
		createRaw(adminToken, "{\"name\":\"Huerfano\",\"parentId\":999999}")
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("category.not_found"))
			.andExpect(jsonPath("$.detail").value("No existe la categoría 999999."));

		long root = createRoot(unique("Inactivo"), null, "FOOD");
		action(root, "deactivate", adminToken).andExpect(status().isOk());
		createRaw(adminToken, "{\"name\":\"Hijo\",\"parentId\":%d}".formatted(root))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("category.parent_inactive"));
	}

	// ---------------------------------------------------------------- CA-6 unique name

	@Test
	void siblingNamesAreUniqueIgnoringCaseAndSpaces() throws Exception {
		long food = createRoot(unique("Comida"), null, "FOOD");
		long clothes = createRoot(unique("Vestido"), null, "CLOTHING");
		createRaw(adminToken, "{\"name\":\"Granos\",\"parentId\":%d}".formatted(food)).andExpect(status().isCreated());

		createRaw(adminToken, "{\"name\":\"  granos \",\"parentId\":%d}".formatted(food))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("category.name_conflict"))
			.andExpect(jsonPath("$.detail").value("Ya existe una categoría llamada «granos» en este nivel."));
		mvc.perform(post(CATEGORIES).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"GRANOS\",\"parentId\":%d}".formatted(food)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("A category named “GRANOS” already exists at this level."));
		// The same name under another parent is fine
		createRaw(adminToken, "{\"name\":\"Granos\",\"parentId\":%d}".formatted(clothes)).andExpect(status().isCreated());
	}

	@Test
	void rootNamesAreUniqueToo() throws Exception {
		String name = unique("Unica");
		createRoot(name, null, "FOOD");
		createRaw(adminToken, "{\"name\":\"%s\",\"productType\":\"CLOTHING\"}".formatted(name.toUpperCase()))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("category.name_conflict"));
		// Seeded root, case-insensitive
		createRaw(adminToken, "{\"name\":\"ALIMENTOS\",\"productType\":\"FOOD\"}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("category.name_conflict"));
	}

	@Test
	void accentedNamesCollideInTheirOwnCaseButNotWithoutAccent() throws Exception {
		long root = createRoot(unique("Padre"), null, "FOOD");
		createRaw(adminToken, "{\"name\":\"Lácteos\",\"parentId\":%d}".formatted(root)).andExpect(status().isCreated());
		createRaw(adminToken, "{\"name\":\"LÁCTEOS\",\"parentId\":%d}".formatted(root))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("category.name_conflict"));
		// LOWER does not strip accents: allowed by the API on purpose (the frontend warns)
		createRaw(adminToken, "{\"name\":\"Lacteos\",\"parentId\":%d}".formatted(root)).andExpect(status().isCreated());
	}

	@Test
	void inactiveCategoriesStillCountForNameConflicts() throws Exception {
		long root = createRoot(unique("Padre"), null, "FOOD");
		long child = createChild(root, "Vieja");
		action(child, "deactivate", adminToken).andExpect(status().isOk());
		createRaw(adminToken, "{\"name\":\"vieja\",\"parentId\":%d}".formatted(root))
			.andExpect(status().isConflict());
		// The unique name key does not collide with the English name
		createRaw(adminToken, "{\"name\":\"Otra\",\"nameEn\":\"Vieja\",\"parentId\":%d}".formatted(root))
			.andExpect(status().isCreated());
	}

	@Test
	void simultaneousCreatesWithSameNameGiveOne201AndOne409() throws Exception {
		long root = createRoot(unique("Carrera"), null, "FOOD");
		String json = "{\"name\":\"Duplicada\",\"parentId\":%d}".formatted(root);
		String rootJson = "{\"name\":\"%s\",\"productType\":\"FOOD\"}".formatted(unique("RaizCarrera"));
		for (String body : List.of(json, rootJson)) {
			CountDownLatch start = new CountDownLatch(1);
			ExecutorService pool = Executors.newFixedThreadPool(2);
			try {
				List<Future<Integer>> results = new ArrayList<>();
				for (int i = 0; i < 2; i++) {
					results.add(pool.submit(() -> {
						start.await();
						return mvc.perform(post(CATEGORIES).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
								.contentType(MediaType.APPLICATION_JSON)
								.content(body))
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
				Assertions.assertTrue(statuses.contains(201), statuses.toString());
				Assertions.assertTrue(statuses.contains(409), statuses.toString());
			}
			finally {
				pool.shutdownNow();
			}
		}
	}

	// ---------------------------------------------------------------- CA-7 validation

	@Test
	void nameValidationAndNormalization() throws Exception {
		createRaw(adminToken, "{\"name\":\"   \",\"productType\":\"FOOD\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.name").value("no puede estar vacío"));
		createRaw(adminToken, "{\"productType\":\"FOOD\"}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.name").exists());
		createRaw(adminToken, "{\"name\":\"%s\",\"productType\":\"FOOD\"}".formatted("x".repeat(61)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.name").exists());
		createRaw(adminToken, "{\"name\":\"ok\",\"nameEn\":\"%s\",\"productType\":\"FOOD\"}".formatted("x".repeat(61)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.nameEn").exists());
		// 60 characters is the maximum
		createRaw(adminToken, "{\"name\":\"%s\",\"nameEn\":\"%s\",\"productType\":\"FOOD\"}"
			.formatted("n".repeat(59) + UUID.randomUUID().toString().charAt(0), "e".repeat(60)))
			.andExpect(status().isCreated());
		// Unknown enum value
		createRaw(adminToken, "{\"name\":\"Tipo\",\"productType\":\"FRUIT\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.productType").value("valor no válido"));
		mvc.perform(post(CATEGORIES).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
				.header(HttpHeaders.ACCEPT_LANGUAGE, "en")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"\",\"productType\":\"FOOD\"}"))
			.andExpect(jsonPath("$.errors.name").value("must not be blank"));
	}

	// ---------------------------------------------------------------- CA-8 rename

	@Test
	void renameBumpsVersionAndPathsFollow() throws Exception {
		long root = createRoot(unique("Vieja"), "Old", "FOOD");
		long child = createChild(root, "Hijo");
		String newName = unique("Nueva");
		rename(root, adminToken, "{\"name\":\" %s \",\"nameEn\":\"New\",\"version\":0}".formatted(newName))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value(newName))
			.andExpect(jsonPath("$.nameEn").value("New"))
			.andExpect(jsonPath("$.version").value(1))
			.andExpect(jsonPath("$.updatedBy").value("admin"))
			.andExpect(jsonPath("$.productType").value("FOOD"));
		fetch(child).andExpect(jsonPath("$.path").value(newName + " › Hijo"))
			.andExpect(jsonPath("$.pathEn").value("New › Hijo"));

		// A stale version is a conflict and changes nothing
		rename(root, adminToken, "{\"name\":\"Otra\",\"version\":0}").andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("resource.version_conflict"));
		fetch(root).andExpect(jsonPath("$.name").value(newName));
		rename(root, adminToken, "{\"name\":\"Otra\"}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.version").value("es obligatorio"));
	}

	@Test
	void renameCannotMoveOrChangeTypeAndIgnoresCaseOnItself() throws Exception {
		long other = createRoot(unique("Otro"), null, "CLOTHING");
		long root = createRoot(unique("Raiz"), null, "FOOD");
		long child = createChild(root, "Hijo");
		rename(child, adminToken, "{\"name\":\"HIJO\",\"version\":0,\"parentId\":%d,\"productType\":\"CLOTHING\"}"
			.formatted(other))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("HIJO"))
			.andExpect(jsonPath("$.parentId").value(root))
			.andExpect(jsonPath("$.productType").value("FOOD"));
	}

	@Test
	void renamingToASiblingsNameIsAConflict() throws Exception {
		long root = createRoot(unique("Raiz"), null, "FOOD");
		createRaw(adminToken, "{\"name\":\"Arroz\",\"parentId\":%d}".formatted(root)).andExpect(status().isCreated());
		long other = createChild(root, "Otra");
		rename(other, adminToken, "{\"name\":\" arroz \",\"version\":0}").andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("category.name_conflict"));
		fetch(other).andExpect(jsonPath("$.version").value(0));
	}

	@Test
	void unknownIdIs404() throws Exception {
		fetch(999999).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("category.not_found"));
		rename(999999, adminToken, "{\"name\":\"X\",\"version\":0}").andExpect(status().isNotFound());
		action(999999, "deactivate", adminToken).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("category.not_found"));
		action(999999, "activate", adminToken).andExpect(status().isNotFound());
		mvc.perform(get(CATEGORIES + "/abc").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"));
	}

	// ---------------------------------------------------------------- CA-9 / CA-10 activate and deactivate

	@Test
	void deactivateAndActivateAreIdempotent() throws Exception {
		long root = createRoot(unique("Toggle"), null, "FOOD");
		action(root, "deactivate", adminToken).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false))
			.andExpect(jsonPath("$.version").value(1));
		action(root, "deactivate", adminToken).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false))
			.andExpect(jsonPath("$.version").value(1));
		action(root, "activate", adminToken).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true))
			.andExpect(jsonPath("$.version").value(2));
		action(root, "activate", adminToken).andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value(2));
	}

	@Test
	void cannotDeactivateWithActiveChildrenButCanOnceTheyAreInactive() throws Exception {
		long root = createRoot(unique("Padre"), null, "FOOD");
		long child = createChild(root, "Hijo");
		action(root, "deactivate", adminToken).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("category.has_active_children"))
			.andExpect(jsonPath("$.detail").value("No se puede desactivar: tiene subcategorías activas."));
		fetch(root).andExpect(jsonPath("$.active").value(true));

		action(child, "deactivate", adminToken).andExpect(status().isOk());
		action(root, "deactivate", adminToken).andExpect(status().isOk());
	}

	@Test
	void cannotReactivateUnderAnInactiveParent() throws Exception {
		long root = createRoot(unique("Padre"), null, "FOOD");
		long child = createChild(root, "Hijo");
		action(child, "deactivate", adminToken).andExpect(status().isOk());
		action(root, "deactivate", adminToken).andExpect(status().isOk());

		action(child, "activate", adminToken).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("category.parent_inactive"));
		action(root, "activate", adminToken).andExpect(status().isOk());
		action(child, "activate", adminToken).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true));
	}

	@Test
	void simultaneousDeactivationsAreBothOk() throws Exception {
		long root = createRoot(unique("Carrera"), null, "FOOD");
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			List<Future<Integer>> results = new ArrayList<>();
			for (int i = 0; i < 2; i++) {
				results.add(pool.submit(() -> {
					start.await();
					return mvc.perform(post(CATEGORIES + "/" + root + "/deactivate")
							.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
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
		fetch(root).andExpect(jsonPath("$.active").value(false)).andExpect(jsonPath("$.version").value(1));
	}

	// ---------------------------------------------------------------- CA-11 no delete

	@Test
	void deleteIsMethodNotAllowed() throws Exception {
		long root = createRoot(unique("NoBorrar"), null, "FOOD");
		mvc.perform(delete(CATEGORIES + "/" + root).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isMethodNotAllowed())
			.andExpect(jsonPath("$.code").value("request.method_not_allowed"));
	}

	// ---------------------------------------------------------------- CA-12 list

	@Test
	void listIsFlatSortedByPathIgnoringCaseWithActiveFilter() throws Exception {
		String tag = unique("ZZlist");
		long root = createRoot(tag, null, "FOOD");
		createRaw(adminToken, "{\"name\":\"beta\",\"parentId\":%d}".formatted(root)).andExpect(status().isCreated());
		createRaw(adminToken, "{\"name\":\"Alfa\",\"parentId\":%d}".formatted(root)).andExpect(status().isCreated());
		long gone = createChild(root, "Zeta");
		action(gone, "deactivate", adminToken).andExpect(status().isOk());

		list("").andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.path =~ /" + tag + ".*/)].name").value(contains(tag, "Alfa", "beta", "Zeta")));
		list("?active=true")
			.andExpect(jsonPath("$[?(@.path =~ /" + tag + ".*/)].name").value(contains(tag, "Alfa", "beta")));
		list("?active=false")
			.andExpect(jsonPath("$[?(@.path =~ /" + tag + ".*/)].name").value(contains("Zeta")))
			.andExpect(jsonPath("$[*].active").value(org.hamcrest.Matchers.not(hasItem(true))));
		list("?active=quizas").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("validation.failed"))
			.andExpect(jsonPath("$.errors.active").value("valor no válido"));
	}

	@Test
	void listCarriesProductCountOfDirectProductsOnly() throws Exception {
		long root = createRoot(unique("Conteo"), null, "FOOD");
		long child = createChild(root, "Hijo");
		for (int i = 0; i < 2; i++) {
			createProduct("Prod " + i, root);
		}
		createProduct("En el hijo", child);
		long inactive = createProduct("Inactivo", child);
		mvc.perform(post("/api/v1/products/" + inactive + "/deactivate")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
			.andExpect(status().isOk());

		// Direct products only, active and inactive, no descendants
		fetch(root).andExpect(jsonPath("$.productCount").value(2));
		fetch(child).andExpect(jsonPath("$.productCount").value(2));
		list("").andExpect(jsonPath("$[?(@.id == " + root + ")].productCount").value(contains(2)));
	}

	// ---------------------------------------------------------------- CA-23 / CA-24 permissions

	@Test
	void everyEndpointRequiresAuthentication() throws Exception {
		mvc.perform(get(CATEGORIES)).andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("auth.unauthorized"));
		mvc.perform(get(CATEGORIES + "/1")).andExpect(status().isUnauthorized());
		mvc.perform(post(CATEGORIES).contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(put(CATEGORIES + "/1").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(post(CATEGORIES + "/1/deactivate")).andExpect(status().isUnauthorized());
		mvc.perform(post(CATEGORIES + "/1/activate")).andExpect(status().isUnauthorized());
	}

	@Test
	void operatorReadsButCannotWrite() throws Exception {
		long root = createRoot(unique("Lectura"), null, "FOOD");
		mvc.perform(get(CATEGORIES).header(HttpHeaders.AUTHORIZATION, "Bearer " + operatorToken))
			.andExpect(status().isOk());
		mvc.perform(get(CATEGORIES + "/" + root).header(HttpHeaders.AUTHORIZATION, "Bearer " + operatorToken))
			.andExpect(status().isOk());

		createRaw(operatorToken, "{\"name\":\"%s\",\"productType\":\"FOOD\"}".formatted(unique("Op")))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("auth.forbidden"));
		rename(root, operatorToken, "{\"name\":\"Cambio\",\"version\":0}").andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("auth.forbidden"));
		action(root, "deactivate", operatorToken).andExpect(status().isForbidden());
		action(root, "activate", operatorToken).andExpect(status().isForbidden());
		fetch(root).andExpect(jsonPath("$.active").value(true)).andExpect(jsonPath("$.version").value(0));
	}

	@Test
	void locationHeaderIsPresent() throws Exception {
		createRaw(adminToken, "{\"name\":\"%s\",\"productType\":\"OTHER\"}".formatted(unique("Loc")))
			.andExpect(status().isCreated())
			.andExpect(header().exists(HttpHeaders.LOCATION));
	}

	// ---------------------------------------------------------------- helpers

	private static String unique(String prefix) {
		return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
	}

	private ResultActions createRaw(String token, String json) throws Exception {
		return mvc.perform(post(CATEGORIES).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private long createRoot(String name, String nameEn, String type) throws Exception {
		String json = "{\"name\":\"%s\",\"nameEn\":%s,\"productType\":\"%s\"}".formatted(name,
				nameEn == null ? "null" : "\"" + nameEn + "\"", type);
		return idOf(createRaw(adminToken, json));
	}

	private long createChild(long parentId, String name) throws Exception {
		return idOf(createRaw(adminToken, "{\"name\":\"%s\",\"parentId\":%d}".formatted(name, parentId)));
	}

	private long createProduct(String name, long categoryId) throws Exception {
		return idOf(mvc.perform(post("/api/v1/products").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"%s\",\"categoryId\":%d,\"unit\":\"UNIT\",\"minStock\":0}".formatted(name,
					categoryId))));
	}

	private static long idOf(ResultActions created) throws Exception {
		return ((Number) JsonPath.read(created.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),
				"$.id")).longValue();
	}

	private ResultActions fetch(long id) throws Exception {
		return mvc.perform(get(CATEGORIES + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private ResultActions list(String query) throws Exception {
		return mvc.perform(get(CATEGORIES + query).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken));
	}

	private ResultActions rename(long id, String token, String json) throws Exception {
		return mvc.perform(put(CATEGORIES + "/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private ResultActions action(long id, String action, String token) throws Exception {
		return mvc.perform(post(CATEGORIES + "/" + id + "/" + action).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

}
