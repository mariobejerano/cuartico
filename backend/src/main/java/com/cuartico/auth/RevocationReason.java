package com.cuartico.auth;

/** Por qué se revocó un refresh token (columna {@code revoked_reason}, máx. 20 caracteres). */
public enum RevocationReason {

	/** Se usó para renovar la sesión (rotación normal). */
	ROTATED,
	/** Era el sucesor no entregado de un token rotado y se reintentó dentro de la gracia. */
	SUPERSEDED,
	LOGOUT,
	PASSWORD_CHANGE,
	PASSWORD_RESET,
	USER_DISABLED,
	/** Se presentó un token ya revocado fuera de la gracia: se asume robo. */
	REUSE_DETECTED

}
