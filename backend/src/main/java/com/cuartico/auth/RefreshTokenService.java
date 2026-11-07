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

	/** Resultado de consumir un refresh token: el usuario y el refresh token nuevo (en claro). */
	public record Rotation(User user, String refreshToken) {
	}

	/** Crea un refresh token (login) y devuelve el valor en claro (es la única vez que se conoce). */
	@Transactional
	public String issue(User user) {
		return create(user, clock.instant()).raw();
	}

	private Created create(User user, Instant now) {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		RefreshToken saved = repository
			.save(new RefreshToken(hash(raw), user, now.plus(props.jwt().refreshTokenTtl()), now));
		return new Created(saved, raw);
	}

	private record Created(RefreshToken token, String raw) {
	}

	/**
	 * Valida y consume un refresh token (reglas normativas en HU-01 CA-28..33 y ADR-001).
	 * <p>
	 * Bloqueo pesimista (SELECT ... FOR UPDATE) siempre en el orden presentado -> sucesor, y las
	 * decisiones se toman con los datos leídos después de obtener cada bloqueo. {@code noRollbackFor}:
	 * si detectamos reutilización, la revocación masiva debe guardarse aunque luego lancemos el 401.
	 */
	@Transactional(noRollbackFor = ApiException.class)
	public Rotation consume(String raw) {
		Instant now = clock.instant();
		RefreshToken presented = repository.findByTokenHash(hash(raw))
			.orElseThrow(() -> ApiException.unauthorized("auth.refresh_invalid"));
		User user = presented.getUser();

		if (!presented.isRevoked()) {
			// Camino normal
			if (presented.isExpired(now)) {
				throw ApiException.unauthorized("auth.refresh_expired");
			}
			if (!user.isActive()) {
				throw ApiException.unauthorized("auth.user_disabled");
			}
			presented.revoke(now, RevocationReason.ROTATED);
			Created next = create(user, now);
			presented.setReplacedById(next.token().getId());
			return new Rotation(user, next.raw());
		}

		RefreshToken successor = graceSuccessor(presented, user, now);
		if (successor == null) {
			log.warn("Refresh token reuse detected for '{}': revoking all of their sessions", user.getUsername());
			repository.revokeAllByUser(user, now, RevocationReason.REUSE_DETECTED);
			throw ApiException.unauthorized("auth.refresh_invalid");
		}
		// Gracia: el sucesor nunca entregado queda inutilizado y se emite un par nuevo. El revoked_at del
		// presentado no cambia, así que los reintentos encadenados no alargan la ventana.
		successor.revoke(now, RevocationReason.SUPERSEDED);
		Created next = create(user, now);
		presented.setReplacedById(next.token().getId());
		log.warn("Refresh token grace applied for '{}': replayed token accepted within {}", user.getUsername(),
				props.jwt().refreshReuseGrace());
		return new Rotation(user, next.raw());
	}

	/** Devuelve el sucesor (ya bloqueado) si el token revocado cumple todas las condiciones de la gracia; si no, null. */
	private RefreshToken graceSuccessor(RefreshToken presented, User user, Instant now) {
		boolean eligible = presented.getRevokedReason() == RevocationReason.ROTATED
				&& !now.isAfter(presented.getRevokedAt().plus(props.jwt().refreshReuseGrace()))
				&& now.isBefore(presented.getExpiresAt())
				&& user.isActive()
				&& presented.getReplacedById() != null;
		if (!eligible) {
			return null;
		}
		return repository.findByIdForUpdate(presented.getReplacedById()).filter(s -> !s.isRevoked()).orElse(null);
	}

	/** Logout. Con bloqueo, para no pisar ROTATED/replaced_by_id en una carrera con un refresh. */
	@Transactional
	public void revoke(String raw) {
		repository.findByTokenHash(hash(raw)).ifPresent(t -> t.revoke(clock.instant(), RevocationReason.LOGOUT));
	}

	@Transactional
	public void revokeAll(User user, RevocationReason reason) {
		repository.revokeAllByUser(user, clock.instant(), reason);
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
