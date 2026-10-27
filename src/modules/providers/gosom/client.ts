/**
 * Cliente mínimo de la REST API de gosom/google-maps-scraper en modo web.
 * Docs: http://localhost:8080/api/docs (con el servicio levantado).
 */

export type GosomJobStatus = "pending" | "working" | "ok" | "failed";

export interface GosomJob {
  ID: string;
  Name: string;
  Date: string;
  Status: GosomJobStatus;
}

export interface GosomCreateJob {
  name: string;
  keywords: string[];
  lang: string;
  depth: number;
  email: boolean;
  extra_reviews: boolean;
  /** Segundos. */
  max_time: number;
  zoom?: number;
  proxies?: string[];
}

export class GosomError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "GosomError";
  }
}

export class GosomClient {
  constructor(private baseUrl: string) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...init.headers },
        cache: "no-store",
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      throw new GosomError(
        `No se puede conectar con gosom en ${this.baseUrl}. ¿Está levantado el contenedor? (docker compose up -d)`,
      );
    }
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { message?: string };
        detail = body.message ?? "";
      } catch {
        /* sin cuerpo JSON */
      }
      throw new GosomError(`gosom respondió ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
    }
    return res;
  }

  async ping(signal?: AbortSignal): Promise<void> {
    await this.request("/api/v1/jobs", { signal });
  }

  async createJob(job: GosomCreateJob, signal?: AbortSignal): Promise<string> {
    const res = await this.request("/api/v1/jobs", {
      method: "POST",
      body: JSON.stringify(job),
      signal,
    });
    const body = (await res.json()) as { id: string };
    return body.id;
  }

  async getJob(id: string, signal?: AbortSignal): Promise<GosomJob> {
    const res = await this.request(`/api/v1/jobs/${encodeURIComponent(id)}`, { signal });
    return (await res.json()) as GosomJob;
  }

  async downloadCsv(id: string, signal?: AbortSignal): Promise<string> {
    const res = await this.request(`/api/v1/jobs/${encodeURIComponent(id)}/download`, { signal });
    return res.text();
  }

  async deleteJob(id: string): Promise<void> {
    await this.request(`/api/v1/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}
