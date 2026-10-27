import { promises as fs } from "node:fs";
import path from "node:path";
import { defineStorage, type LeadStore } from "@/core/storage";
import { dedupeLeads, leadDedupeKey, type Lead } from "@/core/lead";
import type { Search } from "@/core/search";

/**
 * Almacenamiento en ficheros JSON dentro de DATA_DIR (por defecto ./data).
 *   data/searches.json
 *   data/leads/<searchId>.json
 * Sin dependencias ni servicios: ideal para uso local.
 */

class JsonFileStore implements LeadStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private dir: string) {}

  private get searchesFile() {
    return path.join(this.dir, "searches.json");
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
}

export default defineStorage({
  id: "json-file",
  create: () =>
    new JsonFileStore(
      process.env.DATA_DIR
        ? path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR)
        : path.join(/*turbopackIgnore: true*/ process.cwd(), "data"),
    ),
});
