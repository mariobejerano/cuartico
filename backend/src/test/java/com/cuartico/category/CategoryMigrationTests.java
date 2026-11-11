package com.cuartico.category;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;

import com.cuartico.testsupport.MigrationDb;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/** HU-15 CA-22: V4 migrates the old free-text products.category with data seeded before it (Flyway target 3). */
class CategoryMigrationTests {

	private MigrationDb db;

	@AfterEach
	void dropDb() {
		if (db != null) {
			db.close();
		}
	}

	@Test
	void v4MapsOldTextToRootsAndSubcategories() {
		db = MigrationDb.create("main");
		db.migrate("3");

		JdbcTemplate jdbc = db.jdbc();
		String[] texts = { "alimentos", "ROPA", "Aseo", "Limpieza", "Granos", "granos", "Lácteos", "LÁCTEOS", null,
				"  Zapatos ", "Electrodomestico" };
		for (int i = 0; i < texts.length; i++) {
			jdbc.update("""
					insert into products (name, unit, category, sale_price, sale_price_currency, min_stock, active, version,
					                      created_at, updated_at)
					values (?, 'UNIT', ?, 5.00, 'USD', 1, true, 0, current_timestamp, current_timestamp)
					""", "p" + i, texts[i]);
			jdbc.update("insert into product_stock (product_id, on_hand, reserved, updated_at) "
					+ "select id, 3, 1, current_timestamp from products where name = ?", "p" + i);
		}
		Map<String, Object> before = jdbc.queryForMap("select id, sale_price, unit from products where name = 'p4'");

		db.migrate(null);

		assertEquals(4, jdbc.queryForObject("select count(*) from categories where parent_id is null", Integer.class));
		assertEquals("Alimentos", rootOf(jdbc, 0));
		assertEquals("Ropa", rootOf(jdbc, 1));
		assertEquals("Aseo y hogar", rootOf(jdbc, 2));
		assertEquals("Aseo y hogar", rootOf(jdbc, 3));
		assertEquals("Ropa", rootOf(jdbc, 9));
		assertEquals("Electrodomésticos", rootOf(jdbc, 10));
		assertEquals("OTHER", jdbc.queryForObject(
				"select c.product_type from products p join categories c on c.id = p.category_id where p.name = 'p2'",
				String.class));

		// Same text with different case -> ONE subcategory under Alimentos; no text -> Alimentos itself
		Long granos = categoryId(jdbc, 4);
		assertEquals(granos, categoryId(jdbc, 5));
		Long lacteos = categoryId(jdbc, 6);
		assertEquals(lacteos, categoryId(jdbc, 7));
		assertEquals(2, jdbc.queryForObject(
				"select count(*) from categories where depth = 2 and parent_id = (select id from categories where name = 'Alimentos')",
				Integer.class));
		assertEquals("Alimentos", rootOf(jdbc, 8));
		assertEquals(2, jdbc.queryForObject("select depth from categories where id = ?", Integer.class, granos));
		// The name is the MIN of the group (uppercase sorts first); the key is the lower-cased one
		assertEquals("Granos", jdbc.queryForObject("select name from categories where id = ?", String.class, granos));
		assertEquals("LÁCTEOS", jdbc.queryForObject("select name from categories where id = ?", String.class, lacteos));
		assertEquals("lácteos", jdbc.queryForObject("select name_key from categories where id = ?", String.class, lacteos));
		assertEquals("FOOD", jdbc.queryForObject("select product_type from categories where id = ?", String.class, lacteos));

		// Seeded roots carry both names and 'system' as author
		assertEquals("Personal care & home", jdbc.queryForObject(
				"select name_en from categories where name = 'Aseo y hogar'", String.class));
		assertEquals("system", jdbc.queryForObject("select created_by from categories where name = 'Ropa'", String.class));

		// Products keep id, price and stock; the old column is gone and the new one is NOT NULL
		Map<String, Object> after = jdbc.queryForMap("select id, sale_price, unit from products where name = 'p4'");
		assertEquals(before, after);
		assertEquals(texts.length, jdbc.queryForObject("select count(*) from variant_stock where on_hand = 3", Integer.class));
		assertEquals(0, jdbc.queryForObject(
				"select count(*) from information_schema.columns where table_schema = current_schema() and table_name = 'products' and column_name = 'category'",
				Integer.class));
		assertEquals("NO", jdbc.queryForObject(
				"select is_nullable from information_schema.columns where table_schema = current_schema() and table_name = 'products' and column_name = 'category_id'",
				String.class));
		assertEquals(0, jdbc.queryForObject(
				"select count(*) from information_schema.tables where table_schema = current_schema() and table_name = 'category_alias_tmp'", Integer.class));

		// The key written by the migration collides with the one the application writes (same function)
		List<Long> same = jdbc.queryForList(
				"select id from categories where name_key = lower(trim('  lácteos')) and depth = 2", Long.class);
		assertEquals(1, same.size());
	}

	private static String rootOf(JdbcTemplate jdbc, int index) {
		return jdbc.queryForObject("""
				select r.name from products p join categories c on c.id = p.category_id
				join categories r on r.id = coalesce(c.parent_id, c.id)
				where p.name = ?
				""", String.class, "p" + index);
	}

	private static Long categoryId(JdbcTemplate jdbc, int index) {
		return jdbc.queryForObject("select category_id from products where name = ?", Long.class, "p" + index);
	}

}
