package com.cuartico.auth;

import java.time.Instant;
import java.util.Optional;

import com.cuartico.user.User;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

	Optional<RefreshToken> findByTokenHash(String tokenHash);

	@Modifying
	@Query("update RefreshToken t set t.revokedAt = :now where t.user = :user and t.revokedAt is null")
	int revokeAllByUser(User user, Instant now);

	@Modifying
	@Query("delete from RefreshToken t where t.expiresAt < :before")
	int deleteExpiredBefore(Instant before);

}
