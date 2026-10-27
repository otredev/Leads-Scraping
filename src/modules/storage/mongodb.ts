import { randomUUID } from "node:crypto";
import { MongoClient, type AnyBulkWriteOperation, type Db, type UpdateFilter } from "mongodb";
import { applyLeadUpdate, mergeSettings, withDefaults, type CrmSettings, type LeadUpdate } from "@/core/crm";
import { defineStorage, type Backup, type ImportSummary, type LeadStore } from "@/core/storage";
import { dedupeLeads, leadDedupeKey, normalizeLead, normalizeSaved, pickLeadData, type Lead, type SavedLead } from "@/core/lead";
import type { Search } from "@/core/search";

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
 *   settings  etapas, etiquetas y preferencias del CRM (documento "crm")
 *
 * La papelera usa un índice TTL sobre `purgeAt`: MongoDB borra solo los
 * documentos caducados. Además se purgan desde la app por si el servidor no
 * admite TTL.
 */

type Doc<T> = Omit<T, "id"> & { _id: string };
type ResultDoc = Doc<Lead> & { key: string };
type SavedDoc = Omit<Doc<SavedLead>, "deletedAt" | "purgeAt"> & { deletedAt?: Date; purgeAt?: Date };

const g = globalThis as unknown as { __mongo?: { uri: string; client: Promise<MongoClient> }; __mongoIndexes?: Promise<void> };

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
    const d = c.db(process.env.MONGODB_DB || "leads_scraping");
    g.__mongoIndexes ??= ensureIndexes(d).catch((e) => {
      g.__mongoIndexes = undefined;
      throw e;
    });
    await g.__mongoIndexes;
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
  try {
    await d.collection("leads").createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 });
  } catch {
    /* algunos servidores compatibles no admiten TTL: se purga desde la app */
  }
}

const searches = async () => (await db()).collection<Doc<Search>>("searches");
const results = async () => (await db()).collection<ResultDoc>("results");
const leads = async () => (await db()).collection<SavedDoc>("leads");
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
    if (u.addNote || u.updateNote || u.deleteNote) {
      let n = 0;
      for (const id of ids) {
        const doc = await col.findOne({ _id: id });
        if (!doc) continue;
        const next = applyLeadUpdate(savedFromDoc(doc), u, now, randomUUID);
        await col.updateOne({ _id: id }, { $set: { notes: next.notes, updatedAt: now } });
        n++;
      }
      if (!u.stage && u.color === undefined && !u.addTags && !u.removeTags && u.doNotContact === undefined) return n;
    }

    // Resto: una sola operación masiva.
    const set: Record<string, unknown> = { updatedAt: now };
    const unset: Record<string, ""> = {};
    if (u.stage) set.stage = u.stage;
    if (u.color === null) unset.color = "";
    else if (u.color) set.color = u.color;
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
    return summary;
  }
}

export default defineStorage({
  id: "mongodb",
  label: "MongoDB",
  create: () => new MongoStore(),
});

