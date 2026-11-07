package com.cuartico.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.cuartico.user.Role;
import com.cuartico.user.User;
import com.cuartico.user.UserRepository;
import com.cuartico.user.UserService;
import com.cuartico.user.dto.UserDtos.ChangePasswordRequest;
import com.cuartico.user.dto.UserDtos.UpdateUserRequest;
import com.jayway.jsonpath.JsonPath;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Ventana de gracia del refresh token (HU-01 CA-28 a CA-33, ADR-001) con un reloj controlable.
 * Cada test crea su propio usuario para no interferir con los demás (la base es compartida).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RefreshGraceIntegrationTests {

	private static final String PASSWORD = "Grace123!test";

	private static final AtomicInteger SEQ = new AtomicInteger();

	/** Reloj mutable y seguro entre hilos. */
	static class MutableClock extends Clock {

		private volatile Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);

		void set(Instant instant) {
			this.now = instant;
		}

		void advance(Duration d) {
			this.now = now.plus(d);
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return now;
		}

	}

	@TestConfiguration
	static class ClockConfig {

		@Bean
		@Primary
		MutableClock testClock() {
			return new MutableClock();
		}

	}

	@Autowired
	MockMvc mvc;

	@Autowired
	MutableClock clock;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	@Autowired
	UserService userService;

	@Autowired
	PasswordEncoder encoder;

	private User user;

	@BeforeEach
	void setUp() {
		clock.set(Instant.now().truncatedTo(ChronoUnit.SECONDS));
		user = newUser("grace");
	}

	@AfterEach
	void tearDown() {
		clock.set(Instant.now().truncatedTo(ChronoUnit.SECONDS));
	}

	// CA-28
	@Test
	void replayWithinGraceIssuesNewPairAndSupersedesSuccessor() throws Exception {
		String r1 = login();
		String otherSession = login();
		Instant rotatedAt = clock.instant();
		String r2 = refresh(r1, 200);

		clock.advance(Duration.ofSeconds(60));
		String r3 = refresh(r1, 200);

		assertThat(r3).isNotEqualTo(r2);
		assertThat(row(r2).get("revoked_reason")).isEqualTo("SUPERSEDED");
		assertThat(row(r1).get("replaced_by_id")).isEqualTo(row(r3).get("id"));
		assertThat(row(r1).get("revoked_reason")).isEqualTo("ROTATED");
		assertThat(revokedAt(r1)).isEqualTo(rotatedAt);
		assertThat(row(r3).get("revoked_at")).isNull();
		// ninguna otra sesión se revoca
		assertThat(row(otherSession).get("revoked_at")).isNull();
		refresh(otherSession, 200);
	}

	// CA-28 / CA-29: el límite de 120 s es inclusivo
	@Test
	void graceBoundaryIsInclusiveAt120Seconds() throws Exception {
		String r1 = login();
		refresh(r1, 200);
		clock.advance(Duration.ofSeconds(120));
		refresh(r1, 200);
	}

	// CA-29
	@Test
	void replayAfterGraceIsReuseAndRevokesAllSessions() throws Exception {
		String r1 = login();
		String otherSession = login();
		String r2 = refresh(r1, 200);
		clock.advance(Duration.ofSeconds(121));

		refresh(r1, 401);

		assertThat(row(r2).get("revoked_reason")).isEqualTo("REUSE_DETECTED");
		assertThat(row(otherSession).get("revoked_reason")).isEqualTo("REUSE_DETECTED");
		assertThat(row(r1).get("revoked_reason")).isEqualTo("ROTATED");
		assertThat(unrevoked()).isZero();
	}

	// CA-30
	@Test
	void doubleReplayWithinGraceKeepsOnlyLastTokenAndWindowDoesNotGrow() throws Exception {
		String r1 = login();
		refresh(r1, 200);
		clock.advance(Duration.ofSeconds(60));
		String r3 = refresh(r1, 200);
		clock.advance(Duration.ofSeconds(50)); // 110 s desde la primera rotación
		String r4 = refresh(r1, 200);

		assertThat(row(r3).get("revoked_reason")).isEqualTo("SUPERSEDED");
		assertThat(row(r1).get("replaced_by_id")).isEqualTo(row(r4).get("id"));
		assertThat(unrevoked()).isEqualTo(1);
		assertThat(row(r4).get("revoked_at")).isNull();

		clock.advance(Duration.ofSeconds(11)); // 121 s desde la primera rotación
		refresh(r1, 401);
		assertThat(unrevoked()).isZero();
	}

	// CA-31a
	@Test
	void successorAlreadyRotatedMakesReplayAReuse() throws Exception {
		String r1 = login();
		String r2 = refresh(r1, 200);
		String r3 = refresh(r2, 200);
		clock.advance(Duration.ofSeconds(30));

		refresh(r1, 401);

		assertThat(row(r3).get("revoked_reason")).isEqualTo("REUSE_DETECTED");
		assertThat(unrevoked()).isZero();
	}

	// CA-31b
	@Test
	void presentingASupersededTokenIsReuse() throws Exception {
		String r1 = login();
		String r2 = refresh(r1, 200);
		clock.advance(Duration.ofSeconds(10));
		String r3 = refresh(r1, 200);

		refresh(r2, 401);

		assertThat(row(r3).get("revoked_reason")).isEqualTo("REUSE_DETECTED");
		assertThat(unrevoked()).isZero();
	}

	// CA-32
	@Test
	void disablingUserAfterRotationBlocksGrace() throws Exception {
		String r1 = login();
		String r2 = refresh(r1, 200);
		clock.advance(Duration.ofSeconds(30));
		userService.update(user.getId(), new UpdateUserRequest("Grace", Role.OPERATOR, false), "otro");

		refresh(r1, 401);

		assertThat(row(r2).get("revoked_reason")).isEqualTo("USER_DISABLED");
		assertThat(unrevoked()).isZero();
	}

	@Test
	void passwordChangeAfterRotationBlocksGrace() throws Exception {
		String r1 = login();
		String r2 = refresh(r1, 200);
		clock.advance(Duration.ofSeconds(30));
		userService.changeOwnPassword(user.getUsername(), new ChangePasswordRequest(PASSWORD, "Nueva123!pass"));

		refresh(r1, 401);

		assertThat(row(r2).get("revoked_reason")).isEqualTo("PASSWORD_CHANGE");
		assertThat(unrevoked()).isZero();
	}

	@Test
	void passwordResetAfterRotationBlocksGrace() throws Exception {
		String r1 = login();
		String r2 = refresh(r1, 200);
		clock.advance(Duration.ofSeconds(30));
		userService.resetPassword(user.getId(), "Reset123!pass");

		refresh(r1, 401);

		assertThat(row(r2).get("revoked_reason")).isEqualTo("PASSWORD_RESET");
		assertThat(unrevoked()).isZero();
	}

	@Test
	void logoutOfSuccessorAfterRotationBlocksGrace() throws Exception {
		String r1 = login();
		String r2 = refresh(r1, 200);
		clock.advance(Duration.ofSeconds(30));
		logout(r2);

		refresh(r1, 401);

		assertThat(row(r2).get("revoked_reason")).isEqualTo("LOGOUT");
		assertThat(unrevoked()).isZero();
	}

	@Test
	void logoutOfAnAlreadyRotatedTokenKeepsRotatedStateAndLink() throws Exception {
		String r1 = login();
		String r2 = refresh(r1, 200);
		Object replacedBy = row(r1).get("replaced_by_id");
		clock.advance(Duration.ofSeconds(5));

		logout(r1);

		assertThat(row(r1).get("revoked_reason")).isEqualTo("ROTATED");
		assertThat(row(r1).get("replaced_by_id")).isEqualTo(replacedBy);
		assertThat(row(r2).get("revoked_at")).isNull();
	}

	@Test
	void expiredPresentedTokenHasNoGrace() throws Exception {
		String r1 = login();
		clock.advance(Duration.ofDays(7).minusSeconds(30));
		String r2 = refresh(r1, 200); // r1 aún vigente
		clock.advance(Duration.ofSeconds(60)); // r1 caducó, pero sigue dentro de los 120 s desde la rotación

		refresh(r1, 401);

		assertThat(row(r2).get("revoked_reason")).isEqualTo("REUSE_DETECTED");
		assertThat(unrevoked()).isZero();
	}

	// CA-33a: dos peticiones simultáneas con el mismo R1 válido se serializan: 200 las dos y queda un solo token vivo
	@Test
	void concurrentRequestsWithSameTokenAreSerialized() throws Exception {
		for (int i = 0; i < 5; i++) {
			user = newUser("grace-c");
			String r1 = login();
			List<Integer> statuses = runConcurrently(r1, r1);
			assertThat(statuses).containsExactly(200, 200);
			assertThat(unrevoked()).isEqualTo(1);
		}
	}

	// CA-33b: R1 (dentro de la gracia) y R2 a la vez: uno gana (200) y el otro dispara la revocación total
	@Test
	void concurrentOldTokenAndSuccessorNeverLeaveTwoLiveChains() throws Exception {
		for (int i = 0; i < 5; i++) {
			user = newUser("grace-d");
			String r1 = login();
			String r2 = refresh(r1, 200);
			clock.advance(Duration.ofSeconds(10));
			List<Integer> statuses = runConcurrently(r1, r2);
			assertThat(statuses).containsExactlyInAnyOrder(200, 401);
			assertThat(unrevoked()).isZero();
		}
	}

	/** Lanza dos refresh a la vez (misma puerta de salida) y devuelve los estados HTTP. */
	private List<Integer> runConcurrently(String first, String second) throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			CountDownLatch ready = new CountDownLatch(2);
			CountDownLatch go = new CountDownLatch(1);
			List<Future<Integer>> futures = new ArrayList<>();
			for (String token : List.of(first, second)) {
				futures.add(pool.submit(() -> {
					ready.countDown();
					go.await();
					return mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
							.content(json(token)))
						.andReturn()
						.getResponse()
						.getStatus();
				}));
			}
			ready.await();
			go.countDown();
			List<Integer> statuses = new ArrayList<>();
			for (Future<Integer> f : futures) {
				statuses.add(f.get(20, TimeUnit.SECONDS));
			}
			return statuses;
		}
		finally {
			pool.shutdownNow();
		}
	}

	// --- helpers ---

	private User newUser(String prefix) {
		return users.save(new User(prefix + SEQ.incrementAndGet(), encoder.encode(PASSWORD), "Grace", Role.OPERATOR));
	}

	private String login() throws Exception {
		MvcResult result = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(user.getUsername(), PASSWORD)))
			.andReturn();
		assertThat(result.getResponse().getStatus()).isEqualTo(200);
		return JsonPath.read(result.getResponse().getContentAsString(), "$.refreshToken");
	}

	/** Llama a /refresh, comprueba el estado esperado y devuelve el refresh nuevo (null si fue 401). */
	private String refresh(String token, int expectedStatus) throws Exception {
		MvcResult result = mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
				.content(json(token)))
			.andReturn();
		assertThat(result.getResponse().getStatus()).isEqualTo(expectedStatus);
		String body = result.getResponse().getContentAsString();
		if (expectedStatus == 401) {
			assertThat((String) JsonPath.read(body, "$.code")).isEqualTo("auth.refresh_invalid");
			return null;
		}
		return JsonPath.read(body, "$.refreshToken");
	}

	private void logout(String token) throws Exception {
		mvc.perform(post("/api/v1/auth/logout").contentType(MediaType.APPLICATION_JSON).content(json(token)))
			.andExpect(status().isNoContent());
	}

	private Map<String, Object> row(String rawToken) {
		return jdbc.queryForMap("select * from refresh_tokens where token_hash = ?", RefreshTokenService.hash(rawToken));
	}

	private Instant revokedAt(String rawToken) {
		Object value = row(rawToken).get("revoked_at");
		return value instanceof Timestamp ts ? ts.toInstant() : ((OffsetDateTime) value).toInstant();
	}

	private int unrevoked() {
		return jdbc.queryForObject("select count(*) from refresh_tokens where user_id = ? and revoked_at is null",
				Integer.class, user.getId());
	}

	private static String json(String token) {
		return "{\"refreshToken\":\"%s\"}".formatted(token);
	}

}
