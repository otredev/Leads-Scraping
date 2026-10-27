-- Un registro por cliente con su último snapshot publicado.
-- El token del enlace nunca se guarda: solo su hash SHA-256.
CREATE TABLE IF NOT EXISTS portals (
  client_id      TEXT PRIMARY KEY,
  token_hash     TEXT NOT NULL UNIQUE,
  snapshot       TEXT NOT NULL,
  published_at   TEXT NOT NULL,
  last_viewed_at TEXT,
  views          INTEGER NOT NULL DEFAULT 0
);
