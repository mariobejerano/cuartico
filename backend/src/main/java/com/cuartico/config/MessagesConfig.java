package com.cuartico.config;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/**
 * Internacionalización de los mensajes al usuario: {@code messages_es.properties} (por defecto) y
 * {@code messages_en.properties}. El idioma sale de {@code Accept-Language}; cualquier otro -> es.
 */
@Configuration
public class MessagesConfig {

	public static final Locale DEFAULT_LOCALE = Locale.forLanguageTag("es");

	@Bean
	MessageSource messageSource() {
		ResourceBundleMessageSource source = new ResourceBundleMessageSource();
		source.setBasename("messages");
		source.setDefaultEncoding(StandardCharsets.UTF_8.name());
		// No depender del idioma del sistema operativo del servidor
		source.setFallbackToSystemLocale(false);
		source.setDefaultLocale(DEFAULT_LOCALE);
		return source;
	}

	/** El nombre "localeResolver" es el que busca DispatcherServlet. */
	@Bean
	LocaleResolver localeResolver() {
		AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
		resolver.setSupportedLocales(List.of(DEFAULT_LOCALE, Locale.ENGLISH));
		resolver.setDefaultLocale(DEFAULT_LOCALE);
		return resolver;
	}

}
