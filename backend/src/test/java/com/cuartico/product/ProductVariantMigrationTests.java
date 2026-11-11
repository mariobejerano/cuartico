package com.cuartico.product;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.cuartico.testsupport.MigrationDb;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * HU-16 CA-18 and CA-19: V5 on a database that already has products and stock (Flyway target 4), like staging
 * (2 products with a product_stock row and the root categories created by V4). Uses {@link MigrationDb}, so under
 * the PostgreSQL job of the CI it runs in its own schema of the real database.
 */
class ProductVariantMigrationTests {

	private MigrationDb db;

	@AfterEach
	void dropDb() {
		if (db != null) {
			db.close();
		}
	}

	@Test
	void v5GivesEveryExistingProductItsHiddenVariantWithItsStock() {
		db = MigrationDb.create("variants");
		db.migrate("4");
		JdbcTemplate jdbc = db.jdbc();
		// Staging-like data plus awkward cases: no SKU, fractional threshold, inactive product, cost recorded
		insertProduct(jdbc, "Arroz", "ARR-001", "5.000", true, "admin");
		insertProduct(jdbc, "Frijoles", "FRI-001", "2.000", true, "operador");
		insertProduct(jdbc, "Sin SKU", null, "2.500", true, null);
		insertProduct(jdbc, "Inactivo", "INA-001", "0.000", false, "admin");
		insertProduct(jdbc, "Sin fila de stock", "NOS-001", "1.000", true, "admin");
		jdbc.update("insert into product_stock (product_id, on_hand, reserved, average_cost, cost_currency, updated_at) "
				+ "select id, 12.500, 2.250, 3.1234, 'USD', timestamp with time zone '2026-11-01 10:00:00+00' from products where name = 'Arroz'");
		jdbc.update("insert into product_stock (product_id, on_hand, reserved, updated_at) "
				+ "select id, 0, 0, current_timestamp from products where name = 'Frijoles'");
		jdbc.update("insert into product_stock (product_id, on_hand, reserved, updated_at) "
				+ "select id, 7, 0, current_timestamp from products where name in ('Sin SKU', 'Inactivo')");
		int products = count(jdbc, "select count(*) from products");
		Map<String, Object> arrozBefore = jdbc.queryForMap(
				"select id, name, sale_price, unit, category_id, active, version from products where name = 'Arroz'");

		db.migrate(null);

		// CA-18: same number of products, variants and stock rows; every product simple
		assertEquals(products, count(jdbc, "select count(*) from products"));
		assertEquals(products, count(jdbc, "select count(*) from product_variants"));
		assertEquals(products, count(jdbc, "select count(*) from variant_stock"));
		assertEquals(0, count(jdbc, "select count(*) from products where has_variants = true"));
		assertEquals(arrozBefore, jdbc.queryForMap(
				"select id, name, sale_price, unit, category_id, active, version from products where name = 'Arroz'"));

		// The old SKU and threshold moved to the variant; no size, no color, active, version 0, audit copied
		Map<String, Object> arroz = jdbc.queryForMap("select v.sku, v.min_stock, v.size, v.color, v.color_key, v.active, v.version, "
				+ "v.created_by, v.updated_by from product_variants v join products p on p.id = v.product_id where p.name = 'Arroz'");
		assertEquals("ARR-001", arroz.get("sku"));
		assertEquals(0, new BigDecimal("5").compareTo((BigDecimal) arroz.get("min_stock")));
		assertEquals(null, arroz.get("size"));
		assertEquals(null, arroz.get("color"));
		assertEquals(null, arroz.get("color_key"));
		assertEquals(true, arroz.get("active"));
		assertEquals(0L, ((Number) arroz.get("version")).longValue());
		assertEquals("admin", arroz.get("created_by"));
		assertEquals("admin", arroz.get("updated_by"));
		assertEquals(null, jdbc.queryForObject(
				"select v.sku from product_variants v join products p on p.id = v.product_id where p.name = 'Sin SKU'", String.class));
		assertEquals(0, new BigDecimal("2.5").compareTo(jdbc.queryForObject(
				"select v.min_stock from product_variants v join products p on p.id = v.product_id where p.name = 'Sin SKU'",
				BigDecimal.class)));
		// The activation of the product rules: the variant of an inactive product is active
		assertEquals(1, count(jdbc, "select count(*) from product_variants v join products p on p.id = v.product_id "
				+ "where p.name = 'Inactivo' and v.active = true and p.active = false"));

		// The stock moved with its values (including cost); a missing product_stock row became zeros
		Map<String, Object> stock = jdbc.queryForMap("select s.on_hand, s.reserved, s.average_cost, s.cost_currency from variant_stock s "
				+ "join product_variants v on v.id = s.variant_id join products p on p.id = v.product_id where p.name = 'Arroz'");
		assertEquals(0, new BigDecimal("12.5").compareTo((BigDecimal) stock.get("on_hand")));
		assertEquals(0, new BigDecimal("2.25").compareTo((BigDecimal) stock.get("reserved")));
		assertEquals(0, new BigDecimal("3.1234").compareTo((BigDecimal) stock.get("average_cost")));
		assertEquals("USD", stock.get("cost_currency"));
		assertEquals(2, count(jdbc, "select count(*) from variant_stock s join product_variants v on v.id = s.variant_id "
				+ "join products p on p.id = v.product_id where s.on_hand = 7"));
		assertEquals(1, count(jdbc, "select count(*) from variant_stock s join product_variants v on v.id = s.variant_id "
				+ "join products p on p.id = v.product_id where p.name = 'Sin fila de stock' and s.on_hand = 0 "
				+ "and s.reserved = 0 and s.average_cost is null"));

		// Old structures are gone
		assertEquals(0, count(jdbc, "select count(*) from information_schema.tables where table_schema = current_schema() "
				+ "and table_name = 'product_stock'"));
		for (String column : List.of("sku", "min_stock")) {
			assertEquals(0, count(jdbc, "select count(*) from information_schema.columns where table_schema = current_schema() "
					+ "and table_name = 'products' and column_name = '" + column + "'"));
		}
		assertEquals(1, count(jdbc, "select count(*) from information_schema.columns where table_schema = current_schema() "
				+ "and table_name = 'products' and column_name = 'has_variants'"));

		// CA-19: reconciliation
		assertEquals(0, count(jdbc, "select count(*) from products p where not exists "
				+ "(select 1 from product_variants v where v.product_id = p.id)"));
		assertEquals(0, count(jdbc, "select count(*) from product_variants v where "
				+ "(select count(*) from variant_stock s where s.variant_id = v.id) <> 1"));
		assertEquals(0, count(jdbc, "select count(*) from variant_stock s where not exists "
				+ "(select 1 from product_variants v where v.id = s.variant_id)"));
	}

	@Test
	void v5ConstraintsWorkOnTheMigratedSchema() {
		db = MigrationDb.create("variants-constraints");
		db.migrate("4");
		JdbcTemplate jdbc = db.jdbc();
		insertProduct(jdbc, "Uno", "UNO-1", "0.000", true, "admin");
		insertProduct(jdbc, "Dos", "DOS-1", "0.000", true, "admin");
		db.migrate(null);
		long uno = jdbc.queryForObject("select id from products where name = 'Uno'", Long.class);

		// SKU is unique across all variants of all products
		assertThrows(DataIntegrityViolationException.class, () -> insertVariant(jdbc, uno, "DOS-1", "M", "Rojo"));
		// (product, size, color_key) is unique, treating NULL as a value (NULLS NOT DISTINCT) and ignoring the case of the color
		insertVariant(jdbc, uno, null, "M", "Rojo");
		assertThrows(DataIntegrityViolationException.class, () -> insertVariant(jdbc, uno, null, "M", "rojo"));
		assertThrows(DataIntegrityViolationException.class, () -> insertVariant(jdbc, uno, null, null, null));
		insertVariant(jdbc, uno, null, "L", "Rojo");
		insertVariant(jdbc, uno, null, null, "Azul");
		assertThrows(DataIntegrityViolationException.class, () -> insertVariant(jdbc, uno, null, null, " AZUL "));
		// Several SKU-less variants are fine
		insertVariant(jdbc, uno, null, "S", "Rojo");
		assertEquals(5, count(jdbc, "select count(*) from product_variants where product_id = " + uno));
	}

	@Test
	void v5OnAnEmptyDatabaseKeepsTheRootCategories() {
		db = MigrationDb.create("variants-empty");
		db.migrate(null);
		JdbcTemplate jdbc = db.jdbc();
		assertEquals(0, count(jdbc, "select count(*) from product_variants"));
		assertEquals(4, count(jdbc, "select count(*) from categories where parent_id is null"));
	}

	private static void insertProduct(JdbcTemplate jdbc, String name, String sku, String minStock, boolean active,
			String author) {
		jdbc.update("""
				insert into products (name, sku, unit, category_id, sale_price, sale_price_currency, min_stock, active, version,
				                      created_at, updated_at, created_by, updated_by)
				values (?, ?, 'UNIT', (select id from categories where name = 'Alimentos'), 5.00, 'USD', ?, ?, 0,
				        current_timestamp, current_timestamp, ?, ?)
				""", name, sku, new BigDecimal(minStock), active, author, author);
	}

	private static void insertVariant(JdbcTemplate jdbc, long productId, String sku, String size, String color) {
		jdbc.update("""
				insert into product_variants (product_id, sku, size, color, color_key, min_stock, active, version, created_at, updated_at)
				values (?, ?, ?, ?, lower(trim(cast(? as varchar(30)))), 0, true, 0, current_timestamp, current_timestamp)
				""", productId, sku, size, color, color);
	}

	private static int count(JdbcTemplate jdbc, String sql) {
		return jdbc.queryForObject(sql, Integer.class);
	}

}
