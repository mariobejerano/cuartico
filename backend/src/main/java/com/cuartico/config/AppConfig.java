package com.cuartico.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class AppConfig {

	/** Reloj inyectable: en los tests se puede reemplazar para simular el paso del tiempo. */
	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}

}
