package com.cuartico.auth;

import java.time.Instant;

import com.cuartico.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Refresh token persistido. Solo guardamos el hash SHA-256: si alguien lee la base de datos no
 * puede usar los tokens.
 */
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 64)
	private String tokenHash;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id")
	private User user;

	@Column(nullable = false)
	private Instant expiresAt;

	private Instant revokedAt;

	@Enumerated(EnumType.STRING)
	@Column(length = 20)
	private RevocationReason revokedReason;

	/** Sucesor vigente (el token emitido al rotar este); es un id simple para no cargarlo sin querer. */
	private Long replacedById;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected RefreshToken() {
		// JPA
	}

	public RefreshToken(String tokenHash, User user, Instant expiresAt, Instant now) {
		this.tokenHash = tokenHash;
		this.user = user;
		this.expiresAt = expiresAt;
		this.createdAt = now;
	}

	public Long getId() {
		return id;
	}

	public Instant getRevokedAt() {
		return revokedAt;
	}

	public RevocationReason getRevokedReason() {
		return revokedReason;
	}

	public Long getReplacedById() {
		return replacedById;
	}

	public void setReplacedById(Long replacedById) {
		this.replacedById = replacedById;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public User getUser() {
		return user;
	}

	public boolean isRevoked() {
		return revokedAt != null;
	}

	public boolean isExpired(Instant now) {
		return !now.isBefore(expiresAt);
	}

	/** Revoca con su motivo; si ya estaba revocado no cambia nada (conserva fecha y motivo). */
	public void revoke(Instant now, RevocationReason reason) {
		if (revokedAt == null) {
			revokedAt = now;
			revokedReason = reason;
		}
	}

}
