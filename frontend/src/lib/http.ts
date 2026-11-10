export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfter = 0) { super(message); }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET", credentials: "same-origin",
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      headers: { "Content-Type": options.body instanceof Blob ? options.body.type : "application/json", "X-Maban-Request": "1" },
      body: options.body === undefined ? undefined : options.body instanceof Blob ? options.body : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("ارتباط با سرور برقرار نشد؛ اتصال رو بررسی و دوباره امتحان کنین.", 0);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(typeof data?.detail === "string" ? data.detail : "درخواست انجام نشد؛ دوباره امتحان کنین.", response.status, Number(response.headers.get("Retry-After")) || 0);
  if (!data) throw new ApiError("پاسخ سرور معتبر نیست؛ دوباره امتحان کنین.", 502);
  return data as T;
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "خطایی پیش اومد؛ دوباره امتحان کنین.";
