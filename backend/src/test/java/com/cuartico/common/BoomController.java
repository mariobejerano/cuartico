package com.cuartico.common;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoint solo para tests: lanza una excepción inesperada para comprobar el 500 genérico. */
@RestController
@Profile("test")
class BoomController {

	@GetMapping("/api/v1/test/boom")
	String boom() {
		throw new IllegalStateException("secret internal detail");
	}

}
