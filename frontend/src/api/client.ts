export const TOKEN_STORAGE_KEY = 'trackit_token';

const BASE_URL = import.meta.env.VITE_API_URL;

interface ErrorResponse {
  error?: {
    message?: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Prefer the server's error message, falling back to the response status text
 * when the body isn't JSON (e.g. an HTML error page or an empty response).
 */
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorResponse;
    if (body.error?.message) {
      return body.error.message;
    }
  } catch {
    // Body wasn't JSON; fall through to the status text.
  }

  return response.statusText || 'Request failed';
}
