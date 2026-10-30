package com.cuartico.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.TreeSet;

import org.junit.jupiter.api.Test;

/** Todos los códigos deben existir en es y en en, y ninguno puede estar vacío. */
class MessageBundlesTests {

	@Test
	void bothBundlesHaveTheSameNonEmptyKeys() throws Exception {
		Properties es = load("/messages_es.properties");
		Properties en = load("/messages_en.properties");
		assertEquals(new TreeSet<>(es.stringPropertyNames()), new TreeSet<>(en.stringPropertyNames()));
		for (String key : es.stringPropertyNames()) {
			assertFalse(es.getProperty(key).isBlank(), "empty es: " + key);
			assertFalse(en.getProperty(key).isBlank(), "empty en: " + key);
		}
	}

	private Properties load(String path) throws Exception {
		Properties p = new Properties();
		try (var in = new InputStreamReader(getClass().getResourceAsStream(path), StandardCharsets.UTF_8)) {
			p.load(in);
		}
		return p;
	}

}
