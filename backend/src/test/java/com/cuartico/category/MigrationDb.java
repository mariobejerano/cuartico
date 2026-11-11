package com.cuartico.category;

import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * Throw-away database for migration tests with seeded legacy data. It uses the database the build is
 * configured for: the SPRING_DATASOURCE_URL/_USERNAME/_PASSWORD variables (the CI job against real
 * PostgreSQL) or, by default, an in-memory H2 like application-test.yml. On PostgreSQL every test gets
 * its own schema, dropped on close, so it cannot disturb the tests that share the main schema.
 */
final class MigrationDb implements AutoCloseable {

	private static final String H2_OPTIONS = ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1";

	private final DriverManagerDataSource ds;

	private final JdbcTemplate admin;

	private final String schema;

	private MigrationDb(DriverManagerDataSource ds, JdbcTemplate admin, String schema) {
		this.ds = ds;
		this.admin = admin;
		this.schema = schema;
	}

	static MigrationDb create(String name) {
		String id = name.replaceAll("[^A-Za-z0-9]", "_") + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
		String url = System.getenv("SPRING_DATASOURCE_URL");
		if (url == null || url.isBlank()) {
			return new MigrationDb(new DriverManagerDataSource("jdbc:h2:mem:migration_" + id + H2_OPTIONS, "sa", ""), null,
					null);
		}
		String user = System.getenv("SPRING_DATASOURCE_USERNAME");
		String password = System.getenv("SPRING_DATASOURCE_PASSWORD");
		JdbcTemplate admin = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
		String schema = "mig_" + id.toLowerCase();
		admin.execute("create schema " + schema);
		String scoped = url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema;
		return new MigrationDb(new DriverManagerDataSource(scoped, user, password), admin, schema);
	}

	JdbcTemplate jdbc() {
		return new JdbcTemplate(ds);
	}

	/** Runs the migrations up to {@code target} (a version) or all of them when it is null. */
	void migrate(String target) {
		var cfg = Flyway.configure().dataSource(ds).locations("classpath:db/migration");
		if (target != null) {
			cfg.target(target);
		}
		cfg.load().migrate();
	}

	@Override
	public void close() {
		if (admin != null) {
			admin.execute("drop schema " + schema + " cascade");
		}
	}

}
