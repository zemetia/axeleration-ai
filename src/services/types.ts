export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ─── Request config ──────────────────────────────────────────────────────────

export interface RequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  /** Fetch cache mode */
  cache?: RequestCache;
  /** Next.js ISR revalidation in seconds (`false` = no-store) */
  revalidate?: number | false;
  /** Next.js cache tags */
  tags?: string[];
  /** External AbortSignal — combined with the client timeout signal */
  signal?: AbortSignal;
  /** Per-request timeout override in ms. Set to 0 to disable. */
  timeout?: number;
  /** Include credentials (cookies) for cross-origin requests */
  withCredentials?: boolean;
}

export interface ApiClientConfig {
  baseUrl?: string;
  /** Default timeout in ms for all requests. Defaults to 10 000. */
  timeout?: number;
  /** Headers merged into every request */
  defaultHeaders?: Record<string, string>;
}

// ─── Interceptors ────────────────────────────────────────────────────────────

/** The mutable request context passed through request interceptors */
export interface RequestContext {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: unknown;
  config: RequestConfig;
}

export type RequestInterceptorFn = (
  ctx: RequestContext,
) => RequestContext | Promise<RequestContext>;

export type ResponseInterceptorFn = <T>(data: T, response: Response) => T | Promise<T>;

export type ErrorInterceptorFn = (error: ApiError) => never | Promise<never>;

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isNetworkError(): boolean {
    return this.status === 0;
  }
}

// ─── Service response shapes ─────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
}
