// Thin typed wrappers around the TorxFlow backend REST API.
// All calls go through authFetch() so the Identity Platform token is attached.

import { authFetch } from "@/lib/auth";
import { classifyApiUrl } from "@/lib/inventoryClassify";

function base(): string {
  return classifyApiUrl().replace(/\/$/, "");
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* leave null */
  }
  if (!res.ok) {
    const detail = (data as { detail?: string })?.detail || text.slice(0, 200);
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return data as T;
}

export interface StuckImage {
  position: number;
  gcs_uri: string;
}

export interface GoldenSet {
  id: string;
  name: string;
  categories: string[];
  max_per_category: number;
  stuck_images: StuckImage[];
  created_at?: number;
  updated_at?: number;
}

export type GoldenSetInput = Omit<GoldenSet, "id" | "created_at" | "updated_at">;

export async function listGoldenSets(): Promise<GoldenSet[]> {
  return json<GoldenSet[]>(await authFetch(`${base()}/api/golden-sets`));
}

export async function createGoldenSet(body: GoldenSetInput): Promise<GoldenSet> {
  return json<GoldenSet>(
    await authFetch(`${base()}/api/golden-sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function updateGoldenSet(id: string, body: GoldenSetInput): Promise<GoldenSet> {
  return json<GoldenSet>(
    await authFetch(`${base()}/api/golden-sets/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteGoldenSet(id: string): Promise<void> {
  await json<unknown>(
    await authFetch(`${base()}/api/golden-sets/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}

export async function duplicateGoldenSet(id: string): Promise<GoldenSet> {
  return json<GoldenSet>(
    await authFetch(`${base()}/api/golden-sets/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
    }),
  );
}

export interface FeedbackInput {
  rating?: number;
  issue?: string;
  note?: string;
}

export async function submitRunFeedback(runId: string, body: FeedbackInput): Promise<{ id: string }> {
  return json<{ id: string }>(
    await authFetch(`${base()}/api/runs/${encodeURIComponent(runId)}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function submitGeneralFeedback(message: string, topic?: string): Promise<{ id: string }> {
  return json<{ id: string }>(
    await authFetch(`${base()}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, topic }),
    }),
  );
}
