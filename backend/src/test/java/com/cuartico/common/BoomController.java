package com.cuartico.common;

import org.springframework.context.annotation.Profile;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints solo para tests: lanzan excepciones para comprobar los manejadores globales. */
@RestController
@Profile("test")
class BoomController {

	@GetMapping("/api/v1/test/boom")
	String boom() {
		throw new IllegalStateException("secret internal detail");
	}

	@GetMapping("/api/v1/test/optimistic-lock")
	String optimisticLock() {
		throw new ObjectOptimisticLockingFailureException("Product", 1L);
	}

}
