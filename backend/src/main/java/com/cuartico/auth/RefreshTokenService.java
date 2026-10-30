package com.cuartico.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

import com.cuartico.common.ApiException;
import com.cuartico.config.AppProperties;
import com.cuartico.user.User;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refresh tokens opacos (aleatorios, no JWT) con rotación:
 * <ol>
 * <li>Cada uso de un refresh token lo revoca y entrega uno nuevo.</li>
 * <li>Si llega un token ya revocado, alguien lo robó y lo reutilizó: se revocan todas las
 * sesiones de ese usuario (detección de reutilización).</li>
 * </ol>
 */
@Service
public class RefreshTokenService {

	private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);

	private static final SecureRandom RANDOM = new SecureRandom();

	private final RefreshTokenRepository repository;

	private final AppProperties props;

	private final Clock clock;

	public RefreshTokenService(RefreshTokenRepository repository, AppProperties props, Clock clock) {
		this.repository = repository;
		this.props = props;
		this.clock = clock;
	}

	/** Crea un refresh token y devuelve el valor en claro (es la única vez que se conoce). */
	@Transactional
	public String issue(User user) {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		Instant now = clock.instant();
		repository.save(new RefreshToken(hash(raw), user, now.plus(props.jwt().refreshTokenTtl()), now));
		return raw;
	}

	/**
	 * Valida y consume un refresh token. Devuelve el usuario dueño si es válido.
	 * <p>
	 * {@code noRollbackFor}: si detectamos reutilización, la revocación masiva debe guardarse
	 * aunque luego lancemos el 401.
	 */
	@Transactional(noRollbackFor = ApiException.class)
	public User consume(String raw) {
		Instant now = clock.instant();
		RefreshToken token = repository.findByTokenHash(hash(raw))
			.orElseThrow(() -> ApiException.unauthorized("auth.refresh_invalid"));
		User user = token.getUser();
		if (token.isRevoked()) {
			log.warn("Refresh token reuse detected for '{}': revoking all of their sessions",
					user.getUsername());
			repository.revokeAllByUser(user, now);
			throw ApiException.unauthorized("auth.refresh_invalid");
		}
		if (token.isExpired(now)) {
			throw ApiException.unauthorized("auth.refresh_expired");
		}
		if (!user.isActive()) {
			throw ApiException.unauthorized("auth.user_disabled");
		}
		token.revoke(now);
		return user;
	}

	@Transactional
	public void revoke(String raw) {
		repository.findByTokenHash(hash(raw)).ifPresent(t -> t.revoke(clock.instant()));
	}

	@Transactional
	public void revokeAll(User user) {
		repository.revokeAllByUser(user, clock.instant());
	}

	@Transactional
	public int purgeExpired() {
		return repository.deleteExpiredBefore(clock.instant());
	}

	static String hash(String raw) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException(ex);
		}
	}

}
