import type {
  ApiResponse,
  Paginated,
  Question,
  QuestionFilters,
  QuestionInput,
  Stats,
} from "@/types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    // non-JSON response
  }

  if (!res.ok || !json?.success) {
    throw new ApiError(json?.error || `Request failed (${res.status})`, res.status);
  }
  return json.data as T;
}

/** Build a querystring from question filters, skipping empty values. */
export function buildQuestionQuery(filters: QuestionFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Generic SWR fetcher. */
export const fetcher = <T>(url: string): Promise<T> => request<T>(url);

export const questionsApi = {
  list: (filters?: QuestionFilters) =>
    request<Paginated<Question>>(`/api/questions${buildQuestionQuery(filters)}`),
  get: (id: string) => request<Question>(`/api/questions/${id}`),
  create: (body: Partial<QuestionInput>) =>
    request<Question>(`/api/questions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<QuestionInput>) =>
    request<Question>(`/api/questions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  archive: (id: string) =>
    request<Question>(`/api/questions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    }),
  restore: (id: string) =>
    request<Question>(`/api/questions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: false }),
    }),
  bulkImport: (payload: { mode: "append" | "upsert"; questions: unknown[] }) =>
    request<{ inserted: number; updated: number; skipped: number }>(
      `/api/import`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
};

export const statsApi = {
  get: () => request<Stats>(`/api/stats`),
};

export const adminApi = {
  state: () => request<import("@/types").AdminAuthState & { authenticated: boolean }>(`/api/admin/auth`),
  login: (password: string) =>
    request<{ authenticated: true }>(`/api/admin/auth`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  setup: (password: string, confirm: string) =>
    request<{ authenticated: true }>(`/api/admin/setup`, {
      method: "POST",
      body: JSON.stringify({ password, confirm }),
    }),
  logout: () => request<{ ok: true }>(`/api/admin/logout`, { method: "POST" }),
};

export const seedApi = {
  run: () =>
    request<{ inserted: number }>(`/api/seed`, { method: "POST" }),
};
