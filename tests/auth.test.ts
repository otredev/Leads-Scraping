import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  changePassword,
  closeSessions,
  deleteAccount,
  listSessions,
  login,
  recoverWithCode,
  register,
  updateProfile,
} from "@/server/auth/service";
import { authenticate } from "@/server/auth/session";
import { handle } from "@/server/http";
import { getStore } from "@/server/registry";
import { createClient } from "@/server/clients";
import { account, cookieOf, request } from "./helpers";

const auth = async (cookie: string) => authenticate(request("/", { cookie }));

describe("cuentas", () => {
  it("la primera cuenta se queda con los datos que ya había; las demás empiezan vacías", async () => {
    const ana = await account("Ana");
    expect(ana.user.dataKey).toBe("");
    const bruno = await account("Bruno");
    expect(bruno.user.dataKey).toMatch(/^u_[0-9a-f]{12}$/);
  });

  it("valida email, contraseña y aceptación, y no repite emails", async () => {
    const r = (body: object) => register(request("/api/auth/register"), { name: "Eva", email: "eva@example.com", password: "una frase larga 2026", accept: true, ...body });
    await expect(r({ email: "no-es-email" })).rejects.toMatchObject({ status: 400 });
    await expect(r({ password: "corta" })).rejects.toMatchObject({ status: 400 });
    await expect(r({ password: "12345678abc" })).rejects.toMatchObject({ status: 400 });
    await expect(r({ accept: false })).rejects.toMatchObject({ status: 400 });
    await r({});
    await expect(r({ email: "EVA@example.com" })).rejects.toMatchObject({ status: 409 });
  });

  it("no guarda contraseñas ni códigos en claro", async () => {
    const c = await account("Clara");
    const file = readFileSync(path.join(process.env.DATA_DIR!, "_accounts", "accounts.json"), "utf8");
    expect(file).not.toContain(c.password);
    expect(file).not.toContain(c.recoveryCode);
    expect(file).not.toContain(c.cookie.split("=")[1]);
    expect(file).toContain("scrypt$");
  });

  it("inicia sesión sin distinguir mayúsculas y rechaza contraseñas incorrectas", async () => {
    const d = await account("Dani");
    await expect(login(request("/api/auth/login"), { email: d.email, password: "otra cosa" })).rejects.toMatchObject({ status: 401 });
    await expect(login(request("/api/auth/login"), { email: "nadie@example.com", password: "x" })).rejects.toMatchObject({ status: 401 });
    const ok = await login(request("/api/auth/login"), { email: ` ${d.email.toUpperCase()} `.trim(), password: d.password });
    expect((await auth(cookieOf(ok.cookie)))?.user.id).toBe(d.user.id);
  });

  it("limita los intentos de inicio de sesión", async () => {
    const tries = Array.from({ length: 9 }, () => login(request("/api/auth/login", { ip: "10.9.9.9" }), { email: "victima@example.com", password: "x" }).catch((e) => e.status));
    expect(await Promise.all(tries)).toContain(429);
  });
});

describe("sesiones", () => {
  it("lista, cierra una o todas las demás", async () => {
    const f = await account("Fer");
    const second = cookieOf((await login(request("/"), { email: f.email, password: f.password })).cookie);
    const me = (await auth(f.cookie))!;
    const sessions = await listSessions(me);
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    expect(await closeSessions(me, { others: true })).toEqual({ closed: 1 });
    expect(await auth(second)).toBeUndefined();
    expect(await auth(f.cookie)).toBeDefined();
  });

  it("cambiar la contraseña cierra las demás sesiones", async () => {
    const g = await account("Gala");
    const other = cookieOf((await login(request("/"), { email: g.email, password: g.password })).cookie);
    const me = (await auth(g.cookie))!;
    await expect(changePassword(me, { currentPassword: "mal", newPassword: "nueva frase larga 2027" })).rejects.toMatchObject({ status: 401 });
    await changePassword(me, { currentPassword: g.password, newPassword: "nueva frase larga 2027" });
    expect(await auth(other)).toBeUndefined();
    expect(await auth(g.cookie)).toBeDefined();
    await expect(login(request("/"), { email: g.email, password: g.password })).rejects.toMatchObject({ status: 401 });
    await login(request("/"), { email: g.email, password: "nueva frase larga 2027" });
  });

  it("cambiar el email pide la contraseña y no deja quitárselo a otra cuenta", async () => {
    const h = await account("Hugo");
    await account("Irene");
    const me = (await auth(h.cookie))!;
    await expect(updateProfile(me, { email: "hugo2@example.com" })).rejects.toMatchObject({ status: 401 });
    await expect(updateProfile(me, { email: "irene@example.com", currentPassword: h.password })).rejects.toMatchObject({ status: 409 });
    const user = await updateProfile(me, { name: "Hugo Pérez", email: "hugo2@example.com", currentPassword: h.password });
    expect(user).toMatchObject({ name: "Hugo Pérez", email: "hugo2@example.com" });
  });
});

describe("recuperar la contraseña", () => {
  it("con el código: admite minúsculas y espacios, da uno nuevo y el anterior deja de valer", async () => {
    const j = await account("Julia");
    await expect(recoverWithCode(request("/"), { email: j.email, code: "AAAAA-BBBBB-CCCCC-DDDDD", newPassword: "recuperada 2028 larga" })).rejects.toMatchObject({ status: 401 });
    const res = await recoverWithCode(request("/"), { email: j.email, code: j.recoveryCode.toLowerCase().replace(/-/g, " "), newPassword: "recuperada 2028 larga" });
    expect(res.recoveryCode).not.toBe(j.recoveryCode);
    expect(await auth(j.cookie)).toBeUndefined(); // cierra las sesiones anteriores
    await expect(recoverWithCode(request("/"), { email: j.email, code: j.recoveryCode, newPassword: "otra 2029 larga" })).rejects.toMatchObject({ status: 401 });
    await login(request("/"), { email: j.email, password: "recuperada 2028 larga" });
  });
});

describe("datos por cuenta", () => {
  it("cada cuenta solo ve sus clientes y ajustes", async () => {
    const a = await account("Kike");
    const b = await account("Luna");
    await a.run(() => createClient({ name: "Cliente de Kike" }));
    await b.run(() => createClient({ name: "Cliente de Luna" }));
    const namesA = (await a.run(() => getStore().listClients())).map((c) => c.name);
    const namesB = (await b.run(() => getStore().listClients())).map((c) => c.name);
    expect(namesA).toContain("Cliente de Kike");
    expect(namesA).not.toContain("Cliente de Luna");
    expect(namesB).toEqual(["Cliente de Luna"]);
    expect(existsSync(path.join(process.env.DATA_DIR!, "users", b.user.dataKey))).toBe(true);
  });

  it("sin cuenta no hay datos", () => {
    expect(() => getStore()).toThrow(/Inicia sesión/);
  });

  it("eliminar la cuenta borra sus datos y su acceso", async () => {
    const m = await account("Mario");
    await m.run(() => createClient({ name: "Para borrar" }));
    const me = (await auth(m.cookie))!;
    await expect(deleteAccount(me, { currentPassword: m.password, confirm: "otro@example.com" })).rejects.toMatchObject({ status: 400 });
    await deleteAccount(me, { currentPassword: m.password, confirm: m.email });
    expect(existsSync(path.join(process.env.DATA_DIR!, "users", m.user.dataKey))).toBe(false);
    expect(await auth(m.cookie)).toBeUndefined();
    await expect(login(request("/"), { email: m.email, password: m.password })).rejects.toMatchObject({ status: 401 });
  });
});

describe("API protegida (handle)", () => {
  const route = handle<[Request]>(async () => Response.json({ clients: (await getStore().listClients()).map((c) => c.name) }));

  it("sin sesión responde 401", async () => {
    expect((await route(request("/api/clients"))).status).toBe(401);
  });

  it("bloquea peticiones de otras webs", async () => {
    const n = await account("Nora");
    const res = await route(request("/api/clients", { method: "POST", cookie: n.cookie, headers: { origin: "https://evil.example" }, body: "{}" }));
    expect(res.status).toBe(403);
  });

  it("con sesión, responde con los datos de esa cuenta", async () => {
    const o = await account("Olga");
    await o.run(() => createClient({ name: "Cliente de Olga" }));
    const res = await route(request("/api/clients", { cookie: o.cookie }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clients: ["Cliente de Olga"] });
  });

  it("no hay datos de otras cuentas en la carpeta de usuarios equivocada", () => {
    for (const dir of readdirSync(path.join(process.env.DATA_DIR!, "users"))) expect(dir).toMatch(/^u_[0-9a-f]{12}$/);
  });
});
