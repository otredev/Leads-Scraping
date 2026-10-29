import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { MongoClient } from "mongodb";
import { getStorageModule } from "../registry";

/**
 * Cuentas de usuario y sesiones. Se guardan aparte de los datos de cada cuenta:
 *   - ficheros JSON: DATA_DIR/_accounts/accounts.json
 *   - MongoDB: base de datos <MONGODB_DB>_accounts, documento "accounts"
 * Todo cabe en un documento (pocas cuentas); las escrituras van en cola.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  /** Código de recuperación (hash): se muestra una sola vez al crearlo. */
  recoveryHash: string;
  /** "" para la primera cuenta (los datos que ya había), "u_…" para las demás. */
  dataKey: string;
  /** Token para conectar Claude (MCP) a esta cuenta (hash). */
  mcpTokenHash?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Session {
  /** Identificador público (para listarla y cerrarla). */
  id: string;
  /** SHA-256 de la ficha de la cookie (la ficha en claro nunca se guarda). */
  tokenHash: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent?: string;
  ip?: string;
}

export interface PasswordReset {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}

export interface Accounts {
  users: User[];
  sessions: Session[];
  resets: PasswordReset[];
}

const empty = (): Accounts => ({ users: [], sessions: [], resets: [] });

interface Backend {
  read(): Promise<Accounts>;
  write(data: Accounts): Promise<void>;
}

// ── Ficheros JSON ──

function fileBackend(): Backend {
  const root = process.env.DATA_DIR ? path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR) : path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
  const file = path.join(root, "_accounts", "accounts.json");
  return {
    async read() {
      try {
        return { ...empty(), ...(JSON.parse(await fs.readFile(file, "utf8")) as Accounts) };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return empty();
        throw err;
      }
    },
    async write(data) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data), { encoding: "utf8", mode: 0o600 });
      try {
        await fs.rename(tmp, file);
      } catch {
        await fs.writeFile(file, JSON.stringify(data), { encoding: "utf8", mode: 0o600 });
        await fs.rm(tmp, { force: true });
      }
    },
  };
}

// ── MongoDB ──

const g = globalThis as unknown as { __accountsMongo?: Promise<MongoClient>; __accountsQueue?: Promise<unknown> };

function mongoBackend(): Backend {
  const collection = async () => {
    const { MongoClient } = await import("mongodb");
    g.__accountsMongo ??= new MongoClient(process.env.MONGODB_URI ?? "", { serverSelectionTimeoutMS: 8_000, appName: "leads-scraping" }).connect();
    const client = await g.__accountsMongo.catch((err) => {
      g.__accountsMongo = undefined;
      throw err;
    });
    return client.db(`${process.env.MONGODB_DB || "leads_scraping"}_accounts`).collection<{ _id: string } & Accounts>("accounts");
  };
  return {
    async read() {
      const doc = await (await collection()).findOne({ _id: "accounts" });
      if (!doc) return empty();
      const { _id, ...rest } = doc;
      void _id;
      return { ...empty(), ...rest };
    },
    async write(data) {
      await (await collection()).replaceOne({ _id: "accounts" }, data, { upsert: true });
    },
  };
}

const backend = () => (getStorageModule().id === "mongodb" ? mongoBackend() : fileBackend());

export function readAccounts(): Promise<Accounts> {
  return backend().read();
}

/** Lee, cambia y guarda en cola (sin pisar cambios simultáneos dentro del proceso). */
export function updateAccounts<T>(fn: (data: Accounts) => T | Promise<T>): Promise<T> {
  const run = (g.__accountsQueue ?? Promise.resolve()).then(async () => {
    const b = backend();
    const data = await b.read();
    const now = Date.now();
    // De paso, se olvidan las sesiones y enlaces caducados.
    data.sessions = data.sessions.filter((s) => Date.parse(s.expiresAt) > now);
    data.resets = data.resets.filter((r) => Date.parse(r.expiresAt) > now);
    const result = await fn(data);
    await b.write(data);
    return result;
  });
  g.__accountsQueue = run.catch(() => undefined);
  return run;
}
