import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { MongoClient, type AnyBulkWriteOperation, type Db, type UpdateFilter } from "mongodb";
import { applyLeadUpdate, mergeSettings, withDefaults, type CrmSettings, type LeadUpdate, type Task } from "@/core/crm";
import { compareTasks } from "@/core/calendar";
import { normalizeProject, type Client, type Project } from "@/core/clients";
import { defineStorage, type Backup, type ImportSummary, type LeadStore } from "@/core/storage";
import { dedupeLeads, leadDedupeKey, normalizeLead, normalizeSaved, pickLeadData, type Lead, type SavedLead } from "@/core/lead";
import type { Search } from "@/core/search";
import type { Expense } from "@/core/finance";
import type { DocTemplate, Document } from "@/core/documents";
import type { Message } from "@/core/messages";

/**
 * Almacenamiento en MongoDB (Atlas o local).
 *
 *   MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/
 *   MONGODB_DB=leads_scraping            (opcional)
 *
 * Colecciones:
 *   searches  historial de búsquedas
 *   results   resultados de cada búsqueda (único por búsqueda + negocio)
 *   leads     leads guardados (único por negocio), con papelera
 *   settings  etapas, etiquetas, plantillas y preferencias (documento "crm")
 *   tasks     tareas de seguimiento de los leads
 *
 * Cada cuenta tiene su propia base de datos: la primera usa MONGODB_DB y las
 * demás MONGODB_DB_<cuenta> (p. ej. leads_scraping_u_1a2b3c4d5e6f).
 *
 * La papelera usa un índice TTL sobre `purgeAt`: MongoDB borra solo los
 * documentos caducados. Además se purgan desde la app por si el servidor no
 * admite TTL.
 */

type Doc<T> = Omit<T, "id"> & { _id: string };
type ResultDoc = Doc<Lead> & { key: string };
type SavedDoc = Omit<Doc<SavedLead>, "deletedAt" | "purgeAt"> & { deletedAt?: Date; purgeAt?: Date };

const g = globalThis as unknown as {
  __mongo?: { uri: string; client: Promise<MongoClient> };
  __mongoIndexes?: Map<string, Promise<void>>;
  __mongoScope?: AsyncLocalStorage<string>;
};
/** Base de datos de la cuenta con la que se llamó al almacenamiento (ver scoped()). */
const scope = (g.__mongoScope ??= new AsyncLocalStorage<string>());
const indexes = (g.__mongoIndexes ??= new Map());

const baseName = () => process.env.MONGODB_DB || "leads_scraping";
/** "" → la base principal; "u_…" → la de esa cuenta. */
export const dbNameFor = (tenant: string) => (tenant ? `${baseName()}_${tenant}` : baseName());

function uri() {
  return process.env.MONGODB_URI ?? "";
}

function client(): Promise<MongoClient> {
  const u = uri();
  if (!u) throw new Error("Falta MONGODB_URI en .env.local");
  if (/<db_password>|<password>/i.test(u)) {
    throw new Error("MONGODB_URI aún tiene <db_password>: sustitúyelo por tu contraseña en .env.local");
  }
  if (!g.__mongo || g.__mongo.uri !== u) {
    const c = new MongoClient(u, { serverSelectionTimeoutMS: 8_000, appName: "leads-scraping" });
    const p = c.connect();
    // Si la conexión falla, permitir reintentar en la siguiente petición.
    p.catch(() => {
      if (g.__mongo?.client === p) g.__mongo = undefined;
    });
    g.__mongo = { uri: u, client: p };
  }
  return g.__mongo.client;
}

/** Traduce los errores típicos de Atlas a algo accionable. */
function friendly(err: unknown): Error {
  const msg = (err as Error)?.message ?? String(err);
  if (/bad auth|authentication failed/i.test(msg)) return new Error("MongoDB rechazó el usuario o la contraseña de MONGODB_URI.");
  if (/ENOTFOUND|querySrv/i.test(msg)) return new Error("No se encuentra el servidor de MongoDB. Revisa la URL del cluster en MONGODB_URI.");
  if (/Server selection timed out|ETIMEDOUT|ECONNREFUSED/i.test(msg))
    return new Error(
      "No se pudo conectar a MongoDB. Si usas Atlas, añade tu IP en Network Access (o 0.0.0.0/0 para cualquier IP).",
    );
  return err instanceof Error ? err : new Error(msg);
}

async function db(): Promise<Db> {
  try {
    const c = await client();
    const name = dbNameFor(scope.getStore() ?? "");
    const d = c.db(name);
    if (!indexes.has(name))
      indexes.set(
        name,
        ensureIndexes(d).catch((e) => {
          indexes.delete(name);
          throw e;
        }),
      );
    await indexes.get(name);
    return d;
  } catch (err) {
    throw friendly(err);
  }
}

async function ensureIndexes(d: Db) {
  await d.collection("searches").createIndex({ createdAt: -1 });
  await d.collection("results").createIndex({ searchId: 1, key: 1 }, { unique: true });
  await d.collection("leads").createIndex({ key: 1 }, { unique: true });
  await d.collection("leads").createIndex({ deletedAt: 1 });
  await d.collection("leads").createIndex({ stage: 1 });
  await d.collection("leads").createIndex({ tags: 1 });
  await d.collection("tasks").createIndex({ leadId: 1 });
  await d.collection("tasks").createIndex({ dueAt: 1 });
  await d.collection("tasks").createIndex({ clientId: 1 });
  await d.collection("projects").createIndex({ clientId: 1 });
  try {
    await d.collection("leads").createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 });
  } catch {
    /* algunos servidores compatibles no admiten TTL: se purga desde la app */
  }
}

const searches = async () => (await db()).collection<Doc<Search>>("searches");
const results = async () => (await db()).collection<ResultDoc>("results");
const leads = async () => (await db()).collection<SavedDoc>("leads");
const tasks = async () => (await db()).collection<Doc<Task>>("tasks");
const clientsCol = async () => (await db()).collection<Doc<Client>>("clients");
const projectsCol = async () => (await db()).collection<Doc<Project>>("projects");
const expensesCol = async () => (await db()).collection<Doc<Expense>>("expenses");
const documentsCol = async () => (await db()).collection<Doc<Document>>("documents");
const docTemplatesCol = async () => (await db()).collection<Doc<DocTemplate>>("doc_templates");
const messagesCol = async () => (await db()).collection<Doc<Message>>("messages");
let metaQueue: Promise<unknown> = Promise.resolve();
const metaCol = async () => (await db()).collection<{ _id: string; value: unknown }>("meta");
const settingsCol = async () => (await db()).collection<{ _id: string } & Partial<CrmSettings>>("settings");

function fromDoc<T>(doc: Doc<T> | null | undefined): T | undefined {
  if (!doc) return undefined;
  const { _id, ...rest } = doc as Doc<T> & Record<string, unknown>;
  return { ...(rest as object), id: _id } as T;
}

function stripKey(doc: ResultDoc): Lead {
  const { key: _key, ...rest } = doc;
  void _key;
  return normalizeLead(fromDoc<Lead>(rest as Doc<Lead>) as Lead);
}

function savedFromDoc(doc: SavedDoc): SavedLead {
  const lead = fromDoc<SavedLead>(doc as unknown as Doc<SavedLead>) as SavedLead & { deletedAt?: unknown; purgeAt?: unknown };
  return {
    ...normalizeSaved(lead as SavedLead),
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : undefined,
    purgeAt: doc.purgeAt ? doc.purgeAt.toISOString() : undefined,
  };
}

function savedToDoc(lead: SavedLead): SavedDoc {
  const { id, deletedAt, purgeAt, ...rest } = lead;
  return {
    ...rest,
    _id: id,
    ...(deletedAt ? { deletedAt: new Date(deletedAt) } : {}),
    ...(purgeAt ? { purgeAt: new Date(purgeAt) } : {}),
  };
}

/** Elimina claves undefined: MongoDB las guardaría como null. */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

class MongoStore implements LeadStore {
  async health() {
    try {
      await (await db()).command({ ping: 1 });
      const host = uri().replace(/^mongodb(\+srv)?:\/\//, "").replace(/^[^@/]*@/, "").replace(/[/?].*$/, "");
      return { ok: true, message: `Conectado a ${host}` };
    } catch (err) {
      return { ok: false, message: friendly(err).message };
    }
  }

  // ── Búsquedas ──

  async listSearches() {
    const docs = await (await searches()).find().sort({ createdAt: -1 }).toArray();
    return docs.map((d) => fromDoc<Search>(d) as Search);
  }

  async getSearch(id: string) {
    return fromDoc<Search>(await (await searches()).findOne({ _id: id }));
  }

  async createSearch(search: Search) {
    const { id, ...rest } = search;
    await (await searches()).insertOne(clean({ ...rest, _id: id }) as Doc<Search>);
  }

  async updateSearch(id: string, patch: Partial<Search>) {
    const { id: _ignored, ...rest } = patch;
    void _ignored;
    const set = clean({ ...rest, updatedAt: new Date().toISOString() });
    const unset: Record<string, ""> = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v === undefined).map(([k]) => [k, ""] as const),
    );
    const doc = await (await searches()).findOneAndUpdate(
      { _id: id },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { returnDocument: "after" },
    );
    return fromDoc<Search>(doc);
  }

  async deleteSearch(id: string) {
    await (await results()).deleteMany({ searchId: id });
    await (await searches()).deleteOne({ _id: id });
  }

  // ── Resultados ──

  async addLeads(searchId: string, list: Lead[]) {
    if (!list.length) return 0;
    const ops: AnyBulkWriteOperation<ResultDoc>[] = list.map((lead) => {
      const { id, ...rest } = lead;
      const key = leadDedupeKey(lead);
      return {
        updateOne: {
          filter: { searchId, key },
          update: { $setOnInsert: clean({ ...rest, searchId, key, _id: id }) as ResultDoc },
          upsert: true,
        },
      };
    });
    const res = await (await results()).bulkWrite(ops, { ordered: false });
    return res.upsertedCount;
  }

  async listLeads(searchId?: string) {
    const col = await results();
    const docs = await col.find(searchId ? { searchId } : {}).toArray();
    const list = docs.map(stripKey);
    return searchId ? list : dedupeLeads(list);
  }

  // ── Leads guardados ──

  async saveLeads(list: SavedLead[]) {
    if (!list.length) return { created: 0, updated: 0 };
    const ops: AnyBulkWriteOperation<SavedDoc>[] = list.map((lead) => ({
      updateOne: {
        filter: { key: lead.key },
        update: {
          $set: clean({ ...pickLeadData(lead), updatedAt: lead.updatedAt }) as Partial<SavedDoc>,
          $unset: { deletedAt: "", purgeAt: "" },
          $addToSet: { searchIds: { $each: lead.searchIds } },
          $setOnInsert: {
            _id: lead.id,
            key: lead.key,
            savedAt: lead.savedAt,
            searchId: lead.searchId,
            stage: lead.stage,
            tags: lead.tags ?? [],
            notes: lead.notes ?? [],
          },
        },
        upsert: true,
      },
    }));
    const res = await (await leads()).bulkWrite(ops, { ordered: false });
    return { created: res.upsertedCount, updated: res.matchedCount };
  }

  async listSavedLeads(opts: { trash?: boolean } = {}) {
    await this.purgeExpired();
    const col = await leads();
    const docs = await col
      .find(opts.trash ? { deletedAt: { $exists: true } } : { deletedAt: { $exists: false } })
      .sort(opts.trash ? { deletedAt: -1 } : { savedAt: -1 })
      .toArray();
    return docs.map(savedFromDoc);
  }

  async savedKeys() {
    const docs = await (await leads()).find({ deletedAt: { $exists: false } }, { projection: { key: 1 } }).toArray();
    return docs.map((d) => d.key);
  }

  async trashLeads(ids: string[], purgeAt: Date) {
    const res = await (await leads()).updateMany(
      { _id: { $in: ids }, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date(), purgeAt } },
    );
    return res.modifiedCount;
  }

  async restoreLeads(ids: string[]) {
    const res = await (await leads()).updateMany({ _id: { $in: ids } }, { $unset: { deletedAt: "", purgeAt: "" } });
    return res.modifiedCount;
  }

  async purgeLeads(ids?: string[]) {
    const res = await (await leads()).deleteMany(
      ids ? { _id: { $in: ids }, deletedAt: { $exists: true } } : { deletedAt: { $exists: true } },
    );
    return res.deletedCount;
  }

  async purgeExpired(now = new Date()) {
    const res = await (await leads()).deleteMany({ purgeAt: { $lte: now } });
    return res.deletedCount;
  }

  async getSavedLead(id: string) {
    const doc = await (await leads()).findOne({ _id: id });
    return doc ? savedFromDoc(doc) : undefined;
  }

  async updateLeads(ids: string[], u: LeadUpdate) {
    if (!ids.length) return 0;
    const col = await leads();
    const now = new Date().toISOString();

    // Notas: lectura-modificación-escritura (son siempre de un solo lead).
    if (u.addNote || u.updateNote || u.deleteNote || u.logContact) {
      let n = 0;
      for (const id of ids) {
        const doc = await col.findOne({ _id: id });
        if (!doc) continue;
        const next = applyLeadUpdate(savedFromDoc(doc), u, now, randomUUID);
        await col.updateOne(
          { _id: id },
          { $set: { notes: next.notes, contacts: next.contacts ?? [], ...(next.lastContactAt ? { lastContactAt: next.lastContactAt } : {}), updatedAt: now } },
        );
        n++;
      }
      if (!u.stage && u.color === undefined && !u.addTags && !u.removeTags && u.doNotContact === undefined && u.pageUrl === undefined) return n;
    }

    // Resto: una sola operación masiva.
    const set: Record<string, unknown> = { updatedAt: now };
    const unset: Record<string, ""> = {};
    if (u.stage) set.stage = u.stage;
    if (u.color === null) unset.color = "";
    else if (u.color) set.color = u.color;
    if (u.pageUrl === null) unset.pageUrl = "";
    else if (u.pageUrl) set.pageUrl = u.pageUrl;
    if (u.doNotContact === false) unset.doNotContact = "";
    else if (u.doNotContact) {
      set.doNotContact = {
        at: now,
        ...(typeof u.doNotContact === "string" && u.doNotContact.trim() ? { reason: u.doNotContact.trim() } : {}),
      };
    }
    const update: UpdateFilter<SavedDoc> = { $set: set as Partial<SavedDoc> };
    if (Object.keys(unset).length) update.$unset = unset;
    if (u.addTags?.length) update.$addToSet = { tags: { $each: u.addTags } } as UpdateFilter<SavedDoc>["$addToSet"];
    let res = await col.updateMany({ _id: { $in: ids } }, update);
    // MongoDB no permite $addToSet y $pull sobre el mismo campo a la vez.
    // Un $pull por etiqueta: compatible con servidores que no admiten $pull + $in.
    for (const tag of u.removeTags ?? []) {
      res = await col.updateMany({ _id: { $in: ids } }, { $pull: { tags: tag } } as UpdateFilter<SavedDoc>);
    }
    return res.matchedCount;
  }

  async reassignStage(from: string, to: string) {
    const res = await (await leads()).updateMany({ stage: from }, { $set: { stage: to } });
    return res.modifiedCount;
  }

  async removeTag(tagId: string) {
    const res = await (await leads()).updateMany({ tags: tagId }, {
      $pull: { tags: tagId },
    } as UpdateFilter<SavedDoc>);
    return res.modifiedCount;
  }

  // ── Tareas ──

  async listTasks(opts: { leadId?: string; clientId?: string; projectId?: string } = {}) {
    const filter = clean({ leadId: opts.leadId, clientId: opts.clientId, projectId: opts.projectId });
    const docs = await (await tasks()).find(filter).toArray();
    return docs.map((d) => fromDoc<Task>(d) as Task).sort(compareTasks);
  }

  async createTask(task: Task) {
    const { id, ...rest } = task;
    await (await tasks()).insertOne(clean({ ...rest, _id: id }) as Doc<Task>);
  }

  async updateTask(id: string, patch: Partial<Task>) {
    const { id: _ignored, ...rest } = patch;
    void _ignored;
    const unset: Record<string, ""> = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v === undefined).map(([k]) => [k, ""] as const),
    );
    const doc = await (await tasks()).findOneAndUpdate(
      { _id: id },
      { $set: clean(rest), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { returnDocument: "after" },
    );
    return fromDoc<Task>(doc);
  }

  async deleteTask(id: string) {
    await (await tasks()).deleteOne({ _id: id });
  }

  // ── Ajustes del CRM ──

  async getSettings() {
    const doc = await (await settingsCol()).findOne({ _id: "crm" });
    if (!doc) return withDefaults(undefined);
    const { _id: _ignored, ...rest } = doc;
    void _ignored;
    return withDefaults(rest);
  }

  async saveSettings(settings: CrmSettings) {
    await (await settingsCol()).replaceOne({ _id: "crm" }, { ...settings }, { upsert: true });
  }

  // ── Clientes y proyectos ──

  async listClients() {
    const docs = await (await clientsCol()).find().toArray();
    return docs.map((d) => fromDoc<Client>(d)!).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  async getClient(id: string) {
    return fromDoc<Client>(await (await clientsCol()).findOne({ _id: id }));
  }

  async putClient(client: Client) {
    const { id, ...rest } = client;
    await (await clientsCol()).replaceOne({ _id: id }, clean(rest) as Doc<Client>, { upsert: true });
  }

  async deleteClient(id: string) {
    await (await clientsCol()).deleteOne({ _id: id });
  }

  async listProjects(opts: { clientId?: string } = {}) {
    const docs = await (await projectsCol()).find(opts.clientId ? { clientId: opts.clientId } : {}).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => normalizeProject(fromDoc<Project>(d)!));
  }

  async getProject(id: string) {
    const p = fromDoc<Project>(await (await projectsCol()).findOne({ _id: id }));
    return p && normalizeProject(p);
  }

  async putProject(project: Project) {
    const { id, ...rest } = project;
    await (await projectsCol()).replaceOne({ _id: id }, clean(rest) as Doc<Project>, { upsert: true });
  }

  async deleteProject(id: string) {
    await (await projectsCol()).deleteOne({ _id: id });
  }

  // ── Gastos ──

  async listExpenses() {
    const docs = await (await expensesCol()).find().sort({ date: -1 }).toArray();
    return docs.map((d) => fromDoc<Expense>(d)!);
  }

  async getExpense(id: string) {
    return fromDoc<Expense>(await (await expensesCol()).findOne({ _id: id }));
  }

  async putExpense(expense: Expense) {
    const { id, ...rest } = expense;
    await (await expensesCol()).replaceOne({ _id: id }, clean(rest) as Doc<Expense>, { upsert: true });
  }

  async deleteExpense(id: string) {
    await (await expensesCol()).deleteOne({ _id: id });
  }

  // ── Documentos ──

  async listDocuments(opts: { clientId?: string } = {}) {
    const docs = await (await documentsCol()).find(opts.clientId ? { clientId: opts.clientId } : {}).sort({ date: -1, createdAt: -1 }).toArray();
    return docs.map((d) => fromDoc<Document>(d)!);
  }

  async getDocument(id: string) {
    return fromDoc<Document>(await (await documentsCol()).findOne({ _id: id }));
  }

  async putDocument(doc: Document) {
    const { id, ...rest } = doc;
    await (await documentsCol()).replaceOne({ _id: id }, clean(rest) as Doc<Document>, { upsert: true });
  }

  async deleteDocument(id: string) {
    await (await documentsCol()).deleteOne({ _id: id });
  }

  async listDocTemplates() {
    const docs = await (await docTemplatesCol()).find().toArray();
    return docs.map((d) => fromDoc<DocTemplate>(d)!).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  async putDocTemplate(t: DocTemplate) {
    const { id, ...rest } = t;
    await (await docTemplatesCol()).replaceOne({ _id: id }, clean(rest) as Doc<DocTemplate>, { upsert: true });
  }

  async deleteDocTemplate(id: string) {
    await (await docTemplatesCol()).deleteOne({ _id: id });
  }

  // ── Mensajes ──

  async listMessages(opts: { clientId?: string } = {}) {
    const docs = await (await messagesCol()).find(opts.clientId ? { clientId: opts.clientId } : {}).sort({ createdAt: 1 }).toArray();
    return docs.map((d) => fromDoc<Message>(d)!);
  }

  async putMessages(messages: Message[]) {
    if (!messages.length) return;
    await (await messagesCol()).bulkWrite(
      messages.map(({ id, ...rest }) => ({ replaceOne: { filter: { _id: id }, replacement: clean(rest) as Doc<Message>, upsert: true } })),
      { ordered: false },
    );
  }

  async deleteMessages(opts: { clientId?: string; id?: string }) {
    if (opts.id) await (await messagesCol()).deleteOne({ _id: opts.id });
    else if (opts.clientId) await (await messagesCol()).deleteMany({ clientId: opts.clientId });
  }

  // ── Datos internos de los módulos ──

  async getMeta<T>(key: string) {
    const doc = await (await metaCol()).findOne({ _id: key });
    return doc?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown) {
    await (await metaCol()).replaceOne({ _id: key }, { value }, { upsert: true });
  }

  /** Lectura-modificación-escritura serializada en este proceso (suficiente para una sola instancia). */
  updateMeta<T>(key: string, fn: (current: T | undefined) => T): Promise<T> {
    const run = async () => {
      const next = fn(await this.getMeta<T>(key));
      await this.setMeta(key, next);
      return next;
    };
    const p = metaQueue.then(run, run);
    metaQueue = p.catch(() => undefined);
    return p;
  }

  // ── Copia de seguridad ──

  async exportAll(): Promise<Backup> {
    const [s, r, l] = await Promise.all([
      this.listSearches(),
      (await results()).find().toArray(),
      (await leads()).find().toArray(),
    ]);
    return {
      app: "leads-scraping",
      version: 1,
      exportedAt: new Date().toISOString(),
      searches: s,
      results: r.map(stripKey),
      leads: l.map(savedFromDoc),
      settings: await this.getSettings(),
      tasks: await this.listTasks(),
      clients: await this.listClients(),
      projects: await this.listProjects(),
      expenses: await this.listExpenses(),
      documents: await this.listDocuments(),
      docTemplates: await this.listDocTemplates(),
      messages: await this.listMessages(),
    };
  }

  async importAll(backup: Backup): Promise<ImportSummary> {
    const summary: ImportSummary = { searches: 0, results: 0, leads: 0 };

    if (backup.searches.length) {
      const res = await (await searches()).bulkWrite(
        backup.searches.map(({ id, ...rest }) => ({
          updateOne: { filter: { _id: id }, update: { $setOnInsert: clean(rest) as Doc<Search> }, upsert: true },
        })),
        { ordered: false },
      );
      summary.searches = res.upsertedCount;
    }

    const bySearch = new Map<string, Lead[]>();
    for (const r of backup.results) bySearch.set(r.searchId, [...(bySearch.get(r.searchId) ?? []), r]);
    for (const [searchId, list] of bySearch) summary.results += await this.addLeads(searchId, list);

    if (backup.leads.length) {
      const res = await (await leads()).bulkWrite(
        backup.leads.map((l) => {
          const { _id, ...doc } = savedToDoc(l);
          return {
            updateOne: {
              filter: { key: l.key },
              update: { $setOnInsert: { ...clean(doc), _id } as SavedDoc },
              upsert: true,
            },
          };
        }),
        { ordered: false },
      );
      summary.leads = res.upsertedCount;
    }
    if (backup.settings) await this.saveSettings(mergeSettings(await this.getSettings(), backup.settings));
    if (backup.tasks?.length) {
      await (await tasks()).bulkWrite(
        backup.tasks.map(({ id, ...rest }) => ({
          updateOne: { filter: { _id: id }, update: { $setOnInsert: clean(rest) as Doc<Task> }, upsert: true },
        })),
        { ordered: false },
      );
    }
    for (const [col, list] of [
      [await clientsCol(), backup.clients ?? []],
      [await projectsCol(), backup.projects ?? []],
      [await expensesCol(), backup.expenses ?? []],
      [await documentsCol(), backup.documents ?? []],
      [await docTemplatesCol(), backup.docTemplates ?? []],
      [await messagesCol(), backup.messages ?? []],
    ] as const) {
      if (!list.length) continue;
      await (col as Awaited<ReturnType<typeof clientsCol>>).bulkWrite(
        list.map(({ id, ...rest }) => ({
          updateOne: { filter: { _id: id }, update: { $setOnInsert: clean(rest) as Doc<Client> }, upsert: true },
        })),
        { ordered: false },
      );
    }
    return summary;
  }
}

/** Cada llamada al almacenamiento se ejecuta con la base de datos de su cuenta. */
function scoped(store: MongoStore, tenant: string): LeadStore {
  return new Proxy(store, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? (...args: unknown[]) => scope.run(tenant, () => value.apply(target, args)) : value;
    },
  });
}

export default defineStorage({
  id: "mongodb",
  label: "MongoDB",
  create: (tenant = "") => scoped(new MongoStore(), tenant),
  async destroy(tenant) {
    const c = await client();
    await c.db(dbNameFor(tenant)).dropDatabase();
    indexes.delete(dbNameFor(tenant));
  },
});

