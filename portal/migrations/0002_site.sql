-- Datos comunes del portal (marca y datos legales) que publica tu app.
CREATE TABLE IF NOT EXISTS site (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
