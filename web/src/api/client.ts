import { getLaunchToken } from '../bootstrap/token';

export class ApiError extends Error {
  constructor(
    public readonly errors: Array<{ message: string; [k: string]: unknown }>,
    public readonly status = 0,
  ) {
    super(`API error: ${errors.map((e) => e.message).join(', ')}`);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (path.startsWith('/api')) {
    const token = getLaunchToken();
    if (token) {
      headers.set('x-gsd-token', token);
    }
  }

  const response = await fetch(path, { ...init, headers });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`API response for ${path} is not valid JSON`);
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'ok' in body &&
    body.ok === false
  ) {
    const err = body as unknown as { errors: Array<{ message: string }> };
    throw new ApiError(err.errors, response.status);
  }

  return body as T;
}
