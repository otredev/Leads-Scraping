import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** Contraseñas y códigos de recuperación con scrypt (sal aleatoria). Formato: scrypt$N$r$p$sal$hash */

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(secret: string, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => scryptCb(secret, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(secret.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifySecret(secret: string, stored: string | undefined): Promise<boolean> {
  const parts = stored?.split("$");
  if (!parts || parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(secret.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Para fichas de sesión y enlaces (ya son aleatorios y largos: basta SHA-256). */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Código de recuperación legible: 4 grupos de 5 (sin letras que se confundan). */
export function recoveryCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join("")).join("-");
}

/** Normaliza lo que escribe el usuario (minúsculas, sin espacios ni guiones). */
export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
