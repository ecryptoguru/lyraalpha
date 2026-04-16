/**
 * Shared SWR fetcher with proper HTTP error surfacing.
 *
 * The common `fetch(url).then(r => r.json())` pattern silently treats 4xx/5xx
 * bodies as valid data, leaving SWR's `error` state permanently empty and
 * making failures invisible to the UI. This fetcher throws on non-2xx so
 * SWR surfaces the error and components can render a retry state.
 */

export interface FetchError extends Error {
  status: number;
  info: unknown;
}

export const fetcher = async <T = unknown>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`) as FetchError;
    err.status = res.status;
    try {
      err.info = await res.json();
    } catch {
      err.info = null;
    }
    throw err;
  }

  return res.json() as Promise<T>;
};

/**
 * Forgiving variant that returns `null` on failure instead of throwing.
 * Use sparingly — only when the UI treats "missing" as a valid state and
 * a failed fetch should degrade silently (e.g., optional side-panels).
 */
export const fetcherNullable = async <T = unknown>(url: string): Promise<T | null> => {
  try {
    return await fetcher<T>(url);
  } catch {
    return null;
  }
};
