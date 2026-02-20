import { supabase } from "./supabase";

/**
 * Legacy API layer that App.jsx expects.
 * - api(path, options)
 * - token helpers
 * - session-expired event
 */

export const SESSION_EXPIRED_EVENT = "wealthapp:session-expired";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

// ---------- Token helpers (legacy) ----------
const TOKEN_KEY = "wealthapp-access-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

let _sessionGuard = 0;
export function resetSessionGuard() {
  _sessionGuard = 0;
}

// ---------- Error type ----------
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ---------- Helpers ----------
function normalizeBody(body) {
  if (body == null) return undefined;
  // If caller passed a plain object, JSON-encode it
  if (typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
    return JSON.stringify(body);
  }
  return body;
}

function hasJsonHeader(headers) {
  const h = headers || {};
  const ct = h["Content-Type"] || h["content-type"];
  return typeof ct === "string" && ct.toLowerCase().includes("application/json");
}

async function safeReadJson(res) {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

// ---------- Core API wrapper ----------
export async function api(path, options = {}) {
  // Prefer Supabase session token if available
  let token = null;

  try {
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      token = session?.access_token || null;
      if (token) setToken(token);
    } else {
      token = getToken();
    }
  } catch {
    token = getToken();
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers = {
    ...(options.headers || {}),
  };

  // If we're sending a JSON body and no content-type was set, set it.
  const normalizedBody = normalizeBody(options.body);
  const willSendBody = normalizedBody !== undefined;

  if (willSendBody && !hasJsonHeader(headers) && !(normalizedBody instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    ...options,
    headers,
    body: normalizedBody,
  });

  // Standardize error handling
  if (res.status === 401) {
    clearToken();
    if (_sessionGuard < 1) {
      _sessionGuard += 1;
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }

    // Prefer JSON detail if present
    const json = await safeReadJson(res);
    const msg = json?.detail || json?.message || (await safeReadText(res)) || "Unauthorized";
    throw new ApiError(msg, 401, json || msg);
  }

  if (!res.ok) {
    const json = await safeReadJson(res);
    const text = json ? "" : await safeReadText(res);
    const msg = json?.detail || json?.message || text || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, json || text);
  }

  // Success
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    // Read text first to avoid double-read issues
    const json = await safeReadJson(res);
    return json;
  }
  return safeReadText(res);
}

// ---------- Convenience wrappers ----------
export function apiGet(path) {
  return api(path, { method: "GET" });
}

export function apiPost(path, body) {
  return api(path, { method: "POST", body });
}

export function apiPut(path, body) {
  return api(path, { method: "PUT", body });
}

export function apiPatch(path, body) {
  return api(path, { method: "PATCH", body });
}

export function apiDelete(path) {
  return api(path, { method: "DELETE" });
}