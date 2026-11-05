// Client-seitiger Fetch-Wrapper für unsere REST-API ({ data } | { error }).

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Standardmeldungen des Clients, falls der Server keine eigene Meldung mitliefert. */
const defaults = {
  network: () => "Netzwerkfehler – bitte Verbindung prüfen.",
  failed: (status: number) => `Anfrage fehlgeschlagen (${status}).`,
};

export async function api<T = unknown>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, "NETWORK", defaults.network());
  }

  let json: {
    data?: T;
    error?: { code: string; message: string; fields?: Record<string, string> };
  } | null = null;
  try {
    json = await res.json();
  } catch {
    /* leerer Body */
  }

  if (!res.ok) {
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/account")) &&
      !url.startsWith("/api/auth/login")
    ) {
      window.location.href = "/login";
    }
    throw new ApiClientError(res.status, json?.error?.code ?? "ERROR", json?.error?.message ?? defaults.failed(res.status), json?.error?.fields);
  }
  return json?.data as T;
}
