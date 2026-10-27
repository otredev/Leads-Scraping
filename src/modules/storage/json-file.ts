import { promises as fs } from "node:fs";
import path from "node:path";
import { defineStorage, type LeadStore } from "@/core/storage";
import { randomUUID } from "node:crypto";
import { dedupeLeads, leadDedupeKey, normalizeSaved, pickLeadData, type Lead, type SavedLead } from "@/core/lead";
import { applyLeadUpdate, mergeSettings, withDefaults, type CrmSettings, type LeadUpdate, type Task } from "@/core/crm";
import { compareTasks } from "@/core/calendar";
import type { Backup, ImportSummary } from "@/core/storage";
import type { Search } from "@/core/search";

/**
 * Almacenamiento en ficheros JSON dentro de DATA_DIR (por defecto ./data).
 *   data/searches.json
 *   data/leads/<searchId>.json   (resultados de cada búsqueda)
 *   data/saved-leads.json        (leads guardados, incluida la papelera)
 *   data/settings.json           (etapas, etiquetas, plantillas y preferencias)
 *   data/tasks.json              (tareas de seguimiento)
 * Sin dependencias ni servicios: ideal para uso local y pruebas.
 */

class JsonFileStore implements LeadStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private dir: string) {}

  private get searchesFile() {
    return path.join(this.dir, "searches.json");
  }

  private get tasksFile() {
    return path.join(this.dir, "tasks.json");
  }

  private get settingsFile() {
    return path.join(this.dir, "settings.json");
  }

  private get savedFile() {
    return path.join(this.dir, "saved-leads.json");
  }

  private leadsFile(searchId: string) {
    return path.join(this.dir, "leads", `${searchId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
  }

  /** Serializa las escrituras para evitar condiciones de carrera. */
  private lock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async read<T>(file: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw err;
    }
  }

  private async write(file: string, data: unknown) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data), "utf8");
    try {
      await fs.rename(tmp, file);
    } catch {
      // En Windows el rename puede fallar si otro proceso tiene el fichero abierto.
      await fs.writeFile(file, JSON.stringify(data), "utf8");
      await fs.rm(tmp, { force: true });
    }
  }

  async health() {
    try {
      await fs.mkdir(this.dir, { recursive: true });
      return { ok: true, message: `Ficheros en ${this.dir}` };
    } catch (err) {
      return { ok: false, message: `No se puede escribir en ${this.dir}: ${(err as Error).message}` };
    }
  }

  async listSearches() {
    const all = await this.read<Search[]>(this.searchesFile, []);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getSearch(id: string) {
    return (await this.read<Search[]>(this.searchesFile, [])).find((s) => s.id === id);
  }

  createSearch(search: Search) {
    return this.lock(async () => {
      const all = await this.read<Search[]>(this.searchesFile, []);
      all.push(search);
      await this.write(this.searchesFile, all);
    });
  }

  updateSearch(id: string, patch: Partial<Search>) {
    return this.lock(async () => {
      const all = await this.read<Search[]>(this.searchesFile, []);
      const i = all.findIndex((s) => s.id === id);
      if (i === -1) return undefined;
      all[i] = { ...all[i], ...patch, id, updatedAt: new Date().toISOString() };
      await this.write(this.searchesFile, all);
      return all[i];
    });
  }

  deleteSearch(id: string) {
    return this.lock(async () => {
      const all = await this.read<Search[]>(this.searchesFile, []);
      await this.write(
        this.searchesFile,
        all.filter((s) => s.id !== id),
      );
      await fs.rm(this.leadsFile(id), { force: true });
    });
  }

  addLeads(searchId: string, leads: Lead[]) {
    return this.lock(async () => {
      const file = this.leadsFile(searchId);
      const existing = await this.read<Lead[]>(file, []);
      const seen = new Set(existing.map(leadDedupeKey));
      let added = 0;
      for (const lead of leads) {
        const key = leadDedupeKey(lead);
        if (seen.has(key)) continue;
        seen.add(key);
        existing.push(lead);
        added++;
      }
      if (added > 0) await this.write(file, existing);
      return added;
    });
  }

  async listLeads(searchId?: string) {
    if (searchId) return this.read<Lead[]>(this.leadsFile(searchId), []);
    const searches = await this.listSearches();
    const all = await Promise.all(searches.map((s) => this.read<Lead[]>(this.leadsFile(s.id), [])));
    return dedupeLeads(all.flat());
  }

  // ── Leads guardados ──

  private async readSaved() {
    return (await this.read<SavedLead[]>(this.savedFile, [])).map(normalizeSaved);
  }

  saveLeads(leads: SavedLead[]) {
    return this.lock(async () => {
      const all = await this.readSaved();
      const byKey = new Map(all.map((l, i) => [l.key, i]));
      let created = 0;
      let updated = 0;
      for (const lead of leads) {
        const i = byKey.get(lead.key);
        if (i === undefined) {
          byKey.set(lead.key, all.length);
          all.push(lead);
          created++;
        } else {
          const prev = all[i];
          all[i] = {
            ...prev,
            ...pickLeadData(lead),
            searchIds: [...new Set([...prev.searchIds, ...lead.searchIds])],
            updatedAt: lead.updatedAt,
            deletedAt: undefined,
            purgeAt: undefined,
          };
          updated++;
        }
      }
      await this.write(this.savedFile, all);
      return { created, updated };
    });
  }

  async listSavedLeads(opts: { trash?: boolean } = {}) {
    await this.purgeExpired();
    const all = await this.readSaved();
    return all
      .filter((l) => Boolean(l.deletedAt) === Boolean(opts.trash))
      .sort((a, b) => (opts.trash ? (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "") : b.savedAt.localeCompare(a.savedAt)));
  }

  async savedKeys() {
    return (await this.readSaved()).filter((l) => !l.deletedAt).map((l) => l.key);
  }

  private mutateSaved(ids: string[], fn: (l: SavedLead) => SavedLead) {
    return this.lock(async () => {
      const set = new Set(ids);
      const all = await this.readSaved();
      let n = 0;
      const next = all.map((l) => {
        if (!set.has(l.id)) return l;
        n++;
        return fn(l);
      });
      if (n) await this.write(this.savedFile, next);
      return n;
    });
  }

  trashLeads(ids: string[], purgeAt: Date) {
    const now = new Date().toISOString();
    return this.mutateSaved(ids, (l) =>
      l.deletedAt ? l : { ...l, deletedAt: now, purgeAt: purgeAt.toISOString() },
    );
  }

  restoreLeads(ids: string[]) {
    return this.mutateSaved(ids, (l) => ({ ...l, deletedAt: undefined, purgeAt: undefined }));
  }

  private removeSaved(pred: (l: SavedLead) => boolean) {
    return this.lock(async () => {
      const all = await this.readSaved();
      const keep = all.filter((l) => !pred(l));
      if (keep.length !== all.length) await this.write(this.savedFile, keep);
      return all.length - keep.length;
    });
  }

  purgeLeads(ids?: string[]) {
    const set = ids && new Set(ids);
    return this.removeSaved((l) => Boolean(l.deletedAt) && (!set || set.has(l.id)));
  }

  purgeExpired(now = new Date()) {
    const iso = now.toISOString();
    return this.removeSaved((l) => Boolean(l.purgeAt) && (l.purgeAt as string) <= iso);
  }

  async getSavedLead(id: string) {
    return (await this.readSaved()).find((l) => l.id === id);
  }

  updateLeads(ids: string[], update: LeadUpdate) {
    const now = new Date().toISOString();
    return this.mutateSaved(ids, (l) => ({ ...applyLeadUpdate(l, update, now, randomUUID), updatedAt: now }));
  }

  reassignStage(from: string, to: string) {
    return this.lock(async () => {
      const all = await this.readSaved();
      let n = 0;
      const next = all.map((l) => (l.stage === from ? (n++, { ...l, stage: to }) : l));
      if (n) await this.write(this.savedFile, next);
      return n;
    });
  }

  removeTag(tagId: string) {
    return this.lock(async () => {
      const all = await this.readSaved();
      let n = 0;
      const next = all.map((l) => (l.tags.includes(tagId) ? (n++, { ...l, tags: l.tags.filter((t) => t !== tagId) }) : l));
      if (n) await this.write(this.savedFile, next);
      return n;
    });
  }

  // ── Tareas ──

  async listTasks(opts: { leadId?: string } = {}) {
    const all = await this.read<Task[]>(this.tasksFile, []);
    return all.filter((t) => !opts.leadId || t.leadId === opts.leadId).sort(compareTasks);
  }

  createTask(task: Task) {
    return this.lock(async () => {
      const all = await this.read<Task[]>(this.tasksFile, []);
      all.push(task);
      await this.write(this.tasksFile, all);
    });
  }

  updateTask(id: string, patch: Partial<Task>) {
    return this.lock(async () => {
      const all = await this.read<Task[]>(this.tasksFile, []);
      const i = all.findIndex((t) => t.id === id);
      if (i === -1) return undefined;
      all[i] = { ...all[i], ...patch, id };
      await this.write(this.tasksFile, all);
      return all[i];
    });
  }

  deleteTask(id: string) {
    return this.lock(async () => {
      const all = await this.read<Task[]>(this.tasksFile, []);
      await this.write(this.tasksFile, all.filter((t) => t.id !== id));
    });
  }

  // ── Ajustes del CRM ──

  async getSettings() {
    return withDefaults(await this.read<Partial<CrmSettings> | undefined>(this.settingsFile, undefined));
  }

  saveSettings(settings: CrmSettings) {
    return this.lock(() => this.write(this.settingsFile, settings));
  }

  // ── Copia de seguridad ──

  async exportAll(): Promise<Backup> {
    const searches = await this.listSearches();
    const results = (await Promise.all(searches.map((s) => this.read<Lead[]>(this.leadsFile(s.id), [])))).flat();
    return {
      app: "leads-scraping",
      version: 1,
      exportedAt: new Date().toISOString(),
      searches,
      results,
      leads: await this.readSaved(),
      settings: await this.getSettings(),
      tasks: await this.listTasks(),
    };
  }

  async importAll(backup: Backup): Promise<ImportSummary> {
    const summary: ImportSummary = { searches: 0, results: 0, leads: 0 };
    const existing = new Set((await this.listSearches()).map((s) => s.id));
    for (const s of backup.searches) {
      if (existing.has(s.id)) continue;
      await this.createSearch(s);
      summary.searches++;
    }
    const bySearch = new Map<string, Lead[]>();
    for (const r of backup.results) bySearch.set(r.searchId, [...(bySearch.get(r.searchId) ?? []), r]);
    for (const [searchId, leads] of bySearch) summary.results += await this.addLeads(searchId, leads);
    summary.leads = await this.lock(async () => {
      const all = await this.readSaved();
      const keys = new Set(all.map((l) => l.key));
      const fresh = backup.leads.filter((l) => !keys.has(l.key));
      if (fresh.length) await this.write(this.savedFile, [...all, ...fresh]);
      return fresh.length;
    });
    if (backup.settings) await this.saveSettings(mergeSettings(await this.getSettings(), backup.settings));
    if (backup.tasks?.length) {
      await this.lock(async () => {
        const all = await this.read<Task[]>(this.tasksFile, []);
        const ids = new Set(all.map((t) => t.id));
        await this.write(this.tasksFile, [...all, ...backup.tasks!.filter((t) => !ids.has(t.id))]);
      });
    }
    return summary;
  }
}

export default defineStorage({
  id: "json-file",
  label: "Ficheros JSON locales",
  create: () =>
    new JsonFileStore(
      process.env.DATA_DIR
        ? path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR)
        : path.join(/*turbopackIgnore: true*/ process.cwd(), "data"),
    ),
});
