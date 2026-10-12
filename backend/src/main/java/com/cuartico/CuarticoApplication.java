package com.cuartico;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class CuarticoApplication {

	public static void main(String[] args) {
		SpringApplication.run(CuarticoApplication.class, args);
	}

}
