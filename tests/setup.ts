import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

// Datos en una carpeta temporal y sin servicios externos (portal, MongoDB, email).
const dir = mkdtempSync(path.join(tmpdir(), "leads-tests-"));
process.env.DATA_DIR = dir;
process.env.STORAGE = "json-file";
process.env.REMINDERS = "off";
process.env.TZ = "Europe/Madrid";
for (const key of ["MONGODB_URI", "PORTAL_URL", "PORTAL_SECRET", "MCP_TOKEN", "REGISTRATION", "RESEND_API_KEY", "EMAIL_FROM", "APP_URL"]) delete process.env[key];

afterAll(() => rmSync(dir, { recursive: true, force: true }));
