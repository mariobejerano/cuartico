package com.cuartico.auth;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import com.cuartico.config.AppProperties;
import com.cuartico.config.SecurityConfig;
import com.cuartico.user.User;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** Emite los JWT de acceso (vida corta, no se guardan en base de datos). */
@Service
public class AccessTokenService {

	private final JwtEncoder encoder;

	private final AppProperties props;

	private final Clock clock;

	public AccessTokenService(JwtEncoder encoder, AppProperties props, Clock clock) {
		this.encoder = encoder;
		this.props = props;
		this.clock = clock;
	}

	public String issue(User user) {
		Instant now = clock.instant();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer(props.jwt().issuer())
			.subject(user.getUsername())
			.issuedAt(now)
			.expiresAt(now.plus(props.jwt().accessTokenTtl()))
			.claim("uid", user.getId())
			.claim("name", user.getFullName())
			.claim(SecurityConfig.ROLES_CLAIM, List.of(user.getRole().name()))
			.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
	}

	public long ttlSeconds() {
		return props.jwt().accessTokenTtl().toSeconds();
	}

}
