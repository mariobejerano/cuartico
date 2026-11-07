package com.cuartico.auth;

import java.time.Instant;
import java.util.Optional;

import com.cuartico.user.User;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

	/** Busca por hash <b>con bloqueo de escritura</b> (SELECT ... FOR UPDATE). Solo se usa para consumir/revocar. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	Optional<RefreshToken> findByTokenHash(String tokenHash);

	/** Busca por id con bloqueo de escritura (el sucesor, siempre después del presentado). */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select t from RefreshToken t where t.id = :id")
	Optional<RefreshToken> findByIdForUpdate(Long id);

	@Modifying(flushAutomatically = true)
	@Query("update RefreshToken t set t.revokedAt = :now, t.revokedReason = :reason "
			+ "where t.user = :user and t.revokedAt is null")
	int revokeAllByUser(User user, Instant now, RevocationReason reason);

	@Modifying
	@Query("delete from RefreshToken t where t.expiresAt < :before")
	int deleteExpiredBefore(Instant before);

}
