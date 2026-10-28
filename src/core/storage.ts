import type { HealthStatus } from "./provider";
import type { Lead, SavedLead } from "./lead";
import type { Search } from "./search";
import type { CrmSettings, LeadUpdate, Task } from "./crm";
import type { Client, Project } from "./clients";
import type { Expense } from "./finance";
import type { DocTemplate, Document } from "./documents";
import type { Message } from "./messages";

/** Copia de seguridad completa, independiente del almacenamiento. */
export interface Backup {
  app: "leads-scraping";
  version: 1;
  exportedAt: string;
  searches: Search[];
  /** Resultados de búsqueda. */
  results: Lead[];
  /** Leads guardados (incluye los de la papelera). */
  leads: SavedLead[];
  /** Etapas, etiquetas y preferencias (desde la fase 2). */
  settings?: CrmSettings;
  /** Tareas (desde la fase 4). */
  tasks?: Task[];
  /** Clientes y proyectos. */
  clients?: Client[];
  projects?: Project[];
  /** Gastos (Finanzas). */
  expenses?: Expense[];
  /** Propuestas, contratos y facturas, y sus plantillas. */
  documents?: Document[];
  docTemplates?: DocTemplate[];
  /** Mensajes con clientes y notas internas. */
  messages?: Message[];
}

export interface ImportSummary {
  searches: number;
  results: number;
  leads: number;
}

/**
 * Almacenamiento de la app. Tres conjuntos de datos:
 *   - búsquedas (historial),
 *   - resultados de cada búsqueda (lo que devuelve el scraper),
 *   - leads guardados (tu CRM), con papelera.
 *
 * Implementaciones: json-file (ficheros locales) y mongodb. Para otra base de
 * datos, crea un módulo que cumpla esta interfaz.
 */
export interface LeadStore {
  health(): Promise<HealthStatus>;

  // ── Búsquedas ──
  listSearches(): Promise<Search[]>;
  getSearch(id: string): Promise<Search | undefined>;
  createSearch(search: Search): Promise<void>;
  updateSearch(id: string, patch: Partial<Search>): Promise<Search | undefined>;
  /** Borra la búsqueda y sus resultados (no toca los leads guardados). */
  deleteSearch(id: string): Promise<void>;

  // ── Resultados ──
  /** Guarda resultados deduplicando dentro de la búsqueda. Devuelve cuántos eran nuevos. */
  addLeads(searchId: string, leads: Lead[]): Promise<number>;
  /** Resultados de una búsqueda, o de todas (sin duplicados) si no se indica. */
  listLeads(searchId?: string): Promise<Lead[]>;

  // ── Leads guardados ──
  /** Crea o actualiza (por `key`). Si estaba en la papelera, lo restaura. */
  saveLeads(leads: SavedLead[]): Promise<{ created: number; updated: number }>;
  listSavedLeads(opts?: { trash?: boolean }): Promise<SavedLead[]>;
  /** Claves de los leads guardados (fuera de la papelera), para marcar "ya guardado". */
  savedKeys(): Promise<string[]>;
  trashLeads(ids: string[], purgeAt: Date): Promise<number>;
  restoreLeads(ids: string[]): Promise<number>;
  /** Borra definitivamente de la papelera. Sin ids, la vacía entera. */
  purgeLeads(ids?: string[]): Promise<number>;
  /** Borra los que ya pasaron su fecha de purga. */
  purgeExpired(now?: Date): Promise<number>;
  getSavedLead(id: string): Promise<SavedLead | undefined>;
  /** Aplica cambios del CRM (etapa, etiquetas, color, notas, no contactar) a uno o varios leads. */
  updateLeads(ids: string[], update: LeadUpdate): Promise<number>;
  /** Mueve todos los leads de una etapa a otra (al borrar una etapa). */
  reassignStage(from: string, to: string): Promise<number>;
  /** Quita una etiqueta de todos los leads (al borrarla). */
  removeTag(tagId: string): Promise<number>;

  // ── Tareas ──
  /** Todas las tareas, o las de un lead, cliente o proyecto. Ordenadas por fecha. */
  listTasks(opts?: { leadId?: string; clientId?: string; projectId?: string }): Promise<Task[]>;
  createTask(task: Task): Promise<void>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;

  // ── Clientes y proyectos ──
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  /** Crea o reemplaza (por id). */
  putClient(client: Client): Promise<void>;
  deleteClient(id: string): Promise<void>;
  listProjects(opts?: { clientId?: string }): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  putProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // ── Gastos (Finanzas) ──
  listExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  /** Crea o reemplaza (por id). */
  putExpense(expense: Expense): Promise<void>;
  deleteExpense(id: string): Promise<void>;

  // ── Documentos (propuestas, contratos y facturas) ──
  listDocuments(opts?: { clientId?: string }): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  /** Crea o reemplaza (por id). Las reglas de inmutabilidad están en server/documents.ts. */
  putDocument(doc: Document): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  listDocTemplates(): Promise<DocTemplate[]>;
  putDocTemplate(t: DocTemplate): Promise<void>;
  deleteDocTemplate(id: string): Promise<void>;

  // ── Mensajes ──
  listMessages(opts?: { clientId?: string }): Promise<Message[]>;
  /** Crea o reemplaza (por id). */
  putMessages(messages: Message[]): Promise<void>;
  deleteMessages(opts: { clientId?: string; id?: string }): Promise<void>;

  // ── Ajustes del CRM ──
  getSettings(): Promise<CrmSettings>;
  saveSettings(settings: CrmSettings): Promise<void>;

  // ── Datos internos de los módulos (claves, suscripciones…) ──
  /** Valor guardado por un módulo; no forma parte de la copia de seguridad. */
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  /** Lee, modifica y guarda un valor de forma atómica respecto a esta app. */
  updateMeta<T>(key: string, fn: (current: T | undefined) => T): Promise<T>;

  // ── Copia de seguridad ──
  exportAll(): Promise<Backup>;
  /** Añade lo que no exista (no sobrescribe nada). */
  importAll(backup: Backup): Promise<ImportSummary>;
}

export interface StorageModule {
  id: string;
  label: string;
  create(): LeadStore;
}

export function defineStorage(s: StorageModule): StorageModule {
  return s;
}

export function isBackup(v: unknown): v is Backup {
  const b = v as Backup;
  return (
    !!b && b.app === "leads-scraping" && b.version === 1 &&
    Array.isArray(b.searches) && Array.isArray(b.results) && Array.isArray(b.leads)
  );
}
