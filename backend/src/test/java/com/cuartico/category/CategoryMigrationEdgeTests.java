package com.cuartico.category;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.cuartico.testsupport.MigrationDb;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * QA (Vera): V4 with the awkward legacy data of CA-22 that the main migration test does not cover:
 * every alias, empty and blank text, padding, mixed case, and an empty products table.
 */
class CategoryMigrationEdgeTests {

	private MigrationDb db;

	@AfterEach
	void dropDb() {
		if (db != null) {
			db.close();
		}
	}

	@Test
	void everyAliasGoesToItsRootAndBlankTextGoesToFood() {
		db = MigrationDb.create("migration-edge");
		db.migrate("3");
		JdbcTemplate jdbc = db.jdbc();
		String[][] cases = {
				{ "alimento", "Alimentos" }, { "COMIDA", "Alimentos" }, { "Food", "Alimentos" },
				{ "calzado", "Ropa" }, { "Zapatos", "Ropa" }, { "CLOTHING", "Ropa" },
				{ "electrodomésticos", "Electrodomésticos" }, { "ELECTRODOMESTICOS", "Electrodomésticos" },
				{ "Appliances", "Electrodomésticos" }, { "electrodoméstico", "Electrodomésticos" },
				{ "Aseo y Hogar", "Aseo y hogar" }, { "Personal Care & Home", "Aseo y hogar" },
				{ "higiene", "Aseo y hogar" }, { "Aseo Personal", "Aseo y hogar" }, { "HOGAR", "Aseo y hogar" },
				{ "   ", "Alimentos" }, { "", "Alimentos" }, { "  limpieza  ", "Aseo y hogar" } };
		for (int i = 0; i < cases.length; i++) {
			jdbc.update("""
					insert into products (name, unit, category, min_stock, active, version, created_at, updated_at)
					values (?, 'UNIT', ?, 0, true, 0, current_timestamp, current_timestamp)
					""", "p" + i, cases[i][0]);
			jdbc.update("insert into product_stock (product_id, on_hand, reserved, updated_at) "
					+ "select id, 0, 0, current_timestamp from products where name = ?", "p" + i);
		}
		db.migrate(null);
		for (int i = 0; i < cases.length; i++) {
			String root = jdbc.queryForObject("""
					select r.name from products p join categories c on c.id = p.category_id
					join categories r on r.id = coalesce(c.parent_id, c.id) where p.name = ?
					""", String.class, "p" + i);
			assertEquals(cases[i][1], root, "text '" + cases[i][0].strip() + "'");
		}
		// No alias text created a subcategory: only the four roots exist
		assertEquals(4, jdbc.queryForObject("select count(*) from categories", Integer.class));
		assertEquals(cases.length, jdbc.queryForObject("select count(*) from products", Integer.class));
	}

	@Test
	void emptyDatabaseMigratesAndHasTheFourRoots() {
		db = MigrationDb.create("migration-empty");
		db.migrate(null);
		JdbcTemplate jdbc = db.jdbc();
		assertEquals(4, jdbc.queryForObject("select count(*) from categories where parent_id is null and active", Integer.class));
		assertEquals(0, jdbc.queryForObject("select count(*) from products", Integer.class));
	}

	@Test
	void textMatchingASubcategoryNameKeepsPaddingAndAccentsOutOfTheKey() {
		db = MigrationDb.create("migration-key");
		db.migrate("3");
		JdbcTemplate jdbc = db.jdbc();
		// "Lacteos" and "Lácteos" are different texts (no accent folding, by design); "  LÁCTEOS " is the second
		String[] texts = { "Lacteos", "Lácteos", "  LÁCTEOS ", "Bebidas   Frías" };
		for (int i = 0; i < texts.length; i++) {
			jdbc.update("""
					insert into products (name, unit, category, min_stock, active, version, created_at, updated_at)
					values (?, 'UNIT', ?, 0, true, 0, current_timestamp, current_timestamp)
					""", "k" + i, texts[i]);
			jdbc.update("insert into product_stock (product_id, on_hand, reserved, updated_at) "
					+ "select id, 0, 0, current_timestamp from products where name = ?", "k" + i);
		}
		db.migrate(null);
		assertEquals(3, jdbc.queryForObject("select count(*) from categories where depth = 2", Integer.class));
		assertEquals(jdbc.queryForObject("select category_id from products where name = 'k1'", Long.class),
				jdbc.queryForObject("select category_id from products where name = 'k2'", Long.class));
	}

}
