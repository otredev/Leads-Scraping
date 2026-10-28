-- Aceptación de las políticas (aviso legal y privacidad) por cliente y versión de los textos.
CREATE TABLE IF NOT EXISTS consents (
  client_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  PRIMARY KEY (client_id, version)
);

-- Mensajes entre el cliente y tú. seq ordena y sirve de cursor para que tu app los recoja.
CREATE TABLE IF NOT EXISTS messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('client', 'admin')),
  body TEXT NOT NULL,
  project_id TEXT,
  project_name TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_client ON messages (client_id, seq);

-- Última vez que el cliente abrió sus mensajes (para el "Visto" en tu app).
CREATE TABLE IF NOT EXISTS message_seen (
  client_id TEXT PRIMARY KEY,
  seen_at TEXT NOT NULL
);
