import { vi } from 'vitest';

/**
 * Create a Fetch-compatible mock Response supporting json(), text(), blob(), and headers.
 */
export function mockResponse(status, body, contentType = 'application/json') {
  const isString = typeof body === 'string';
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': contentType }),
    json: async () => (isString ? JSON.parse(body) : body),
    text: async () => (isString ? body : JSON.stringify(body)),
    blob: async () =>
      new Blob([isString ? body : JSON.stringify(body)], { type: contentType }),
  };
}

/**
 * Install a URL-routed fetch stub on globalThis and return the spy function.
 */
export function stubFetchRoutes(handler) {
  const fetchSpy = vi.fn(async (url, options = {}) => handler(String(url), options));
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}
