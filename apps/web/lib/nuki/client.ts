import "server-only";

const NUKI_API_BASE = "https://api.nuki.io";

export interface NukiSmartlock {
  smartlockId: number;
  name: string;
  type: number;
  state: { stateName: string };
}

export interface NukiAuth {
  id: number;
  name: string;
  type: number;
  code: number;
  enabled: boolean;
  allowedFromDate: string | null;
  allowedUntilDate: string | null;
  allowedWeekDays: number;
  allowedFromTime: number;
  allowedUntilTime: number;
}

interface CreateAuthPayload {
  name: string;
  code: number;
  type: 13; // Keypad code
  allowedWeekDays: number;
  allowedFromTime: number;
  allowedUntilTime: number;
  allowedFromDate?: string;
  allowedUntilDate?: string;
  enabled: boolean;
  remoteAllowed: boolean;
}

interface UpdateAuthPayload {
  name?: string;
  code?: number;
  enabled?: boolean;
  allowedWeekDays?: number;
  allowedFromTime?: number;
  allowedUntilTime?: number;
  allowedFromDate?: string | null;
  allowedUntilDate?: string | null;
}

async function nukiFetch<T>(
  apiToken: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${NUKI_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Nuki API ${res.status}: ${body}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** List all smartlocks for this account */
export async function listSmartlocks(apiToken: string): Promise<NukiSmartlock[]> {
  return nukiFetch<NukiSmartlock[]>(apiToken, "/smartlock");
}

/** List all authorizations for a smartlock */
export async function listAuths(
  apiToken: string,
  smartlockId: string,
): Promise<NukiAuth[]> {
  return nukiFetch<NukiAuth[]>(apiToken, `/smartlock/${smartlockId}/auth`);
}

/** Create a keypad code authorization (type 13) */
export async function createAuth(
  apiToken: string,
  smartlockId: string,
  payload: CreateAuthPayload,
): Promise<void> {
  await nukiFetch<void>(apiToken, `/smartlock/${smartlockId}/auth`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Update an existing authorization */
export async function updateAuth(
  apiToken: string,
  smartlockId: string,
  authId: number,
  payload: UpdateAuthPayload,
): Promise<void> {
  await nukiFetch<void>(apiToken, `/smartlock/${smartlockId}/auth/${authId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Delete an authorization */
export async function deleteAuth(
  apiToken: string,
  smartlockId: string,
  authId: number,
): Promise<void> {
  await nukiFetch<void>(apiToken, `/smartlock/${smartlockId}/auth/${authId}`, {
    method: "DELETE",
  });
}
