export const TOKEN_STORAGE_KEY = 'trackit_token';

interface ErrorResponse {
  error?: {
    message?: string;
  };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  const responseBody = (await response.json()) as T & ErrorResponse;

  if (!response.ok) {
    throw new Error(responseBody.error?.message || 'Request failed');
  }

  return responseBody;
}
