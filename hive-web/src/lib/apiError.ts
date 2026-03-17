/**
 * Centralised API error handling (MH-006).
 *
 * Maps HTTP status codes and network failures to user-friendly messages with
 * suggested next actions.  Raw status codes and stack traces are never surfaced
 * to the user.
 */

/** Structured error payload returned by hive-server (mirrors backend AppError). */
export interface ApiErrorBody {
  code: string;
  message: string;
  /** Field name if the error relates to a specific form field. */
  field?: string;
}

/** Parsed application error with user-facing message and action hint. */
export interface AppError {
  /** Human-readable message safe to show users. */
  message: string;
  /** Brief label for a recovery action (e.g. "Retry", "Go to login"). */
  action?: string;
  /** Whether this error should redirect to /login. */
  redirectToLogin?: boolean;
  /** Field name for inline form errors. */
  field?: string;
  /** Original HTTP status code (for logging only, not shown to users). */
  status?: number;
}

/**
 * Parse a fetch Response into an AppError.
 *
 * Tries to read a structured `{ code, message, field }` JSON body from the
 * response.  Falls back to a generic message based on the HTTP status code.
 */
export async function parseApiError(res: Response): Promise<AppError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    const text = await res.text();
    if (text) body = JSON.parse(text);
  } catch {
    // ignore parse failures — use status-based fallback
  }

  return mapStatusToError(res.status, body);
}

/**
 * Create an AppError from a caught network-level error (no response received).
 */
export function networkError(): AppError {
  return {
    message: 'Could not reach the server — check your connection.',
    action: 'Retry',
    status: 0,
  };
}

/**
 * Map an HTTP status code + optional body to a user-friendly AppError.
 */
export function mapStatusToError(
  status: number,
  body: Partial<ApiErrorBody> = {},
): AppError {
  // Use the server's own message when it provides one, subject to a sanity
  // check that it is non-empty and does not look like a raw technical string.
  const serverMsg = body.message && isSafeMessage(body.message) ? body.message : undefined;

  switch (status) {
    case 401:
      return {
        message: 'Your session has expired. Please log in again.',
        action: 'Go to login',
        redirectToLogin: true,
        status,
      };
    case 403:
      return {
        message: serverMsg ?? "You don't have permission to do this.",
        action: 'Contact your admin',
        field: body.field,
        status,
      };
    case 404:
      return {
        message: serverMsg ?? 'The requested resource was not found.',
        action: 'Go back',
        status,
      };
    case 409:
      return {
        message: serverMsg ?? 'This action conflicts with existing data.',
        action: 'Reload',
        field: body.field,
        status,
      };
    case 422:
      return {
        message: serverMsg ?? 'The submitted data is invalid.',
        action: 'Check your input',
        field: body.field,
        status,
      };
    case 429:
      return {
        message: 'Too many requests — please slow down.',
        action: 'Wait and retry',
        status,
      };
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        message: 'The server encountered an error. Please try again in a moment.',
        action: 'Retry',
        status,
      };
    default:
      return {
        message: serverMsg ?? 'An unexpected error occurred.',
        action: 'Retry',
        field: body.field,
        status,
      };
  }
}

/**
 * Return true when a server-supplied message is safe to show to users.
 *
 * Rejects messages that look like stack traces, contain raw SQL, or are very
 * long (a heuristic for technical output).
 */
function isSafeMessage(msg: string): boolean {
  if (msg.length > 200) return false;
  const lowerMsg = msg.toLowerCase();
  const technicalPatterns = ['error:', 'stack:', 'at ', 'exception', 'sql', 'panic'];
  return !technicalPatterns.some((p) => lowerMsg.includes(p));
}

/**
 * A thin fetch wrapper that throws AppError on non-2xx responses or network
 * failures.  Logs full details to the console in development mode.
 *
 * @example
 * const data = await apiFetch<Room[]>('/api/rooms');
 */
export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[api] network error', { input, err });
    }
    throw networkError();
  }

  if (!res.ok) {
    const appError = await parseApiError(res);
    if (import.meta.env.DEV) {
      console.error('[api] error response', { status: res.status, url: String(input), appError });
    }
    throw appError;
  }

  return res.json() as Promise<T>;
}
