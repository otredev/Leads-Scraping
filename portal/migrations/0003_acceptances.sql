-- Aceptaciones de propuestas y contratos hechas por los clientes en el portal.
-- Una por versión enviada (sent_at): si reabres y vuelves a enviar el documento, se pide de nuevo.
CREATE TABLE IF NOT EXISTS acceptances (
  client_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  name TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  PRIMARY KEY (client_id, doc_id, sent_at)
);
