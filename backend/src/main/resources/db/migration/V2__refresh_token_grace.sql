-- Ventana de gracia del refresh token (HU-01 CA-28..33, ADR-001).
-- Los tokens revocados antes de esta migración quedan con revoked_reason = NULL: nunca tienen gracia.
ALTER TABLE refresh_tokens ADD COLUMN revoked_reason VARCHAR(20);
ALTER TABLE refresh_tokens ADD COLUMN replaced_by_id BIGINT REFERENCES refresh_tokens (id) ON DELETE SET NULL;

-- PostgreSQL no indexa las claves foráneas automáticamente (lo necesita el ON DELETE SET NULL de la limpieza nocturna)
CREATE INDEX idx_refresh_tokens_replaced_by ON refresh_tokens (replaced_by_id);
