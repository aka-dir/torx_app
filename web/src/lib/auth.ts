// Identity Platform (GCP) sign-in + token management.
// No Firebase SDK: we talk to the REST endpoint directly and cache the
// ID token + refresh token in localStorage.

// Skip login page entirely: "/" → /sorter, no Bearer (backend: SKIP_AUTH=1).
const SKIP_AUTH =
  import.meta.env.VITE_SKIP_AUTH === "true" || import.meta.env.VITE_SKIP_AUTH === "1";

// During `npm run dev`, use the old demo login + plain fetch unless you set this:
const USE_IDP_IN_DEV =
  import.meta.env.VITE_USE_IDP_IN_DEV === "true" || import.meta.env.VITE_USE_IDP_IN_DEV === "1";

/** `vite` dev server only: demo login UI, no Bearer on /api (pair with backend SKIP_AUTH=1). */
export const isLocalDemoAuth = !import.meta.env.PROD && !USE_IDP_IN_DEV;

function apiCallsWithoutBearer(): boolean {
  return SKIP_AUTH || isLocalDemoAuth;
}

const API_KEY = (import.meta.env.VITE_IDP_API_KEY as string | undefined)?.trim() || "";
const TENANT_ID = (import.meta.env.VITE_IDP_TENANT_ID as string | undefined)?.trim() || "";

const LS_TOKEN = "torxflow.idToken";
const LS_REFRESH = "torxflow.refreshToken";
const LS_EXP = "torxflow.tokenExp";
const LS_EMAIL = "torxflow.email";

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export type LoginResult = { idToken: string; refreshToken: string; email: string };

export async function signIn(email: string, password: string): Promise<LoginResult> {
  if (apiCallsWithoutBearer()) {
    localStorage.setItem(LS_EMAIL, email || "dev@local");
    return { idToken: "", refreshToken: "", email: email || "dev@local" };
  }
  if (!API_KEY) throw new Error("VITE_IDP_API_KEY is not configured");
  const body: Record<string, unknown> = { email, password, returnSecureToken: true };
  if (TENANT_ID) body.tenantId = TENANT_ID;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  const idToken: string = data.idToken;
  const refreshToken: string = data.refreshToken;
  const expiresInSec = Number(data.expiresIn || "3600");
  localStorage.setItem(LS_TOKEN, idToken);
  localStorage.setItem(LS_REFRESH, refreshToken);
  localStorage.setItem(LS_EXP, String(now() + expiresInSec - 30));
  localStorage.setItem(LS_EMAIL, email);
  return { idToken, refreshToken, email };
}

async function refresh(): Promise<string | null> {
  const rt = localStorage.getItem(LS_REFRESH);
  if (!rt || !API_KEY) return null;
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt }).toString(),
  });
  const data = await res.json();
  if (!res.ok) return null;
  const idToken: string = data.id_token;
  const refreshToken: string = data.refresh_token;
  const expiresInSec = Number(data.expires_in || "3600");
  localStorage.setItem(LS_TOKEN, idToken);
  localStorage.setItem(LS_REFRESH, refreshToken);
  localStorage.setItem(LS_EXP, String(now() + expiresInSec - 30));
  return idToken;
}

export async function getIdToken(): Promise<string | null> {
  if (apiCallsWithoutBearer()) return null;
  const tok = localStorage.getItem(LS_TOKEN);
  const exp = Number(localStorage.getItem(LS_EXP) || "0");
  if (tok && now() < exp) return tok;
  return refresh();
}

export function currentEmail(): string {
  return localStorage.getItem(LS_EMAIL) || "";
}

export function signOut(): void {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_EXP);
  localStorage.removeItem(LS_EMAIL);
}

/** fetch() wrapper that attaches the Identity Platform bearer token. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (apiCallsWithoutBearer()) return fetch(input, init);
  const tok = await getIdToken();
  if (!tok) {
    throw new Error(
      "Not signed in or session expired. Use Identity Platform login, or for local dev set backend SKIP_AUTH=1 and use npm run dev without VITE_USE_IDP_IN_DEV.",
    );
  }
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${tok}`);
  return fetch(input, { ...init, headers });
}
