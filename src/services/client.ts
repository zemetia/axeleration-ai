import type {
  ApiClientConfig,
  ErrorInterceptorFn,
  HttpMethod,
  RequestConfig,
  RequestContext,
  RequestInterceptorFn,
  ResponseInterceptorFn,
} from './types';
import { ApiError } from './types';

type GetConfig = Omit<RequestConfig, 'method' | 'body'>;
type MutationConfig = Omit<RequestConfig, 'method' | 'body'>;

// ─── ApiClient ───────────────────────────────────────────────────────────────

class ApiClientInstance {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultHeaders: Record<string, string>;

  private requestInterceptors: RequestInterceptorFn[] = [];
  private responseInterceptors: ResponseInterceptorFn[] = [];
  private errorInterceptors: ErrorInterceptorFn[] = [];

  /**
   * Axios-style interceptor registration.
   *
   * @example
   * ```ts
   * // Inject auth token on every request
   * apiClient.interceptors.request.use((ctx) => {
   *   const token = getCookie('access_token');
   *   if (token) ctx.headers['Authorization'] = `Bearer ${token}`;
   *   return ctx;
   * });
   *
   * // Normalize response shape
   * apiClient.interceptors.response.use((data) => {
   *   return (data as { data: unknown }).data ?? data;
   * });
   *
   * // Global error handler
   * apiClient.interceptors.error.use((err) => {
   *   if (err.isUnauthorized()) window.location.href = '/login';
   *   throw err;
   * });
   * ```
   */
  readonly interceptors = {
    request: {
      use: (fn: RequestInterceptorFn): void => {
        this.requestInterceptors.push(fn);
      },
      eject: (): void => {
        this.requestInterceptors.splice(0);
      },
    },
    response: {
      use: (fn: ResponseInterceptorFn): void => {
        this.responseInterceptors.push(fn);
      },
      eject: (): void => {
        this.responseInterceptors.splice(0);
      },
    },
    error: {
      use: (fn: ErrorInterceptorFn): void => {
        this.errorInterceptors.push(fn);
      },
      eject: (): void => {
        this.errorInterceptors.splice(0);
      },
    },
  };

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? '';
    this.defaultTimeout = config.timeout ?? 10_000;
    this.defaultHeaders = config.defaultHeaders ?? {};
  }

  private async execute<T>(path: string, config: RequestConfig): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      cache,
      revalidate,
      tags,
      signal: externalSignal,
      timeout,
      withCredentials = false,
    } = config;

    // Build initial request context
    let ctx: RequestContext = {
      url: `${this.baseUrl}${path}`,
      method: method as HttpMethod,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...this.defaultHeaders,
        ...headers,
      },
      body,
      config,
    };

    // Run request interceptors
    for (const fn of this.requestInterceptors) {
      ctx = await fn(ctx);
    }

    // Timeout via AbortController
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (effectiveTimeout > 0) {
      timeoutId = setTimeout(
        () => controller.abort(new Error(`Request timed out after ${effectiveTimeout}ms`)),
        effectiveTimeout,
      );
    }

    // Combine external signal with timeout signal
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, controller.signal])
      : controller.signal;

    const fetchOptions: RequestInit = {
      method: ctx.method,
      headers: ctx.headers,
      body: ctx.body !== undefined ? JSON.stringify(ctx.body) : undefined,
      credentials: withCredentials ? 'include' : 'same-origin',
      signal,
      cache,
    };

    if (revalidate !== undefined || tags !== undefined) {
      fetchOptions.next = {
        ...(revalidate !== undefined && { revalidate }),
        ...(tags !== undefined && { tags }),
      };
    }

    try {
      const response = await fetch(ctx.url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = undefined;
        }

        const error = new ApiError(response.status, response.statusText, errorBody);

        for (const fn of this.errorInterceptors) {
          await fn(error);
        }

        throw error;
      }

      if (response.status === 204) return undefined as T;

      let data = (await response.json()) as T;

      for (const fn of this.responseInterceptors) {
        data = (await fn(data, response)) as T;
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) throw err;
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? `Request timed out after ${effectiveTimeout}ms`
          : err instanceof Error
            ? err.message
            : 'Network error';
      throw new ApiError(0, message, err);
    }
  }

  get<T>(path: string, config?: GetConfig): Promise<T> {
    return this.execute<T>(path, { ...config, method: 'GET' });
  }

  post<T>(path: string, body: unknown, config?: MutationConfig): Promise<T> {
    return this.execute<T>(path, { ...config, method: 'POST', body });
  }

  put<T>(path: string, body: unknown, config?: MutationConfig): Promise<T> {
    return this.execute<T>(path, { ...config, method: 'PUT', body });
  }

  patch<T>(path: string, body: unknown, config?: MutationConfig): Promise<T> {
    return this.execute<T>(path, { ...config, method: 'PATCH', body });
  }

  delete<T>(path: string, config?: GetConfig): Promise<T> {
    return this.execute<T>(path, { ...config, method: 'DELETE' });
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const apiClient = new ApiClientInstance({
  baseUrl: process.env['NEXT_PUBLIC_API_URL'] ?? '',
  timeout: 10_000,
});

// ─── Default interceptors ─────────────────────────────────────────────────
// Uncomment and adapt to your auth strategy.
//
// import { getCookie } from '@/lib/cookies';
//
// apiClient.interceptors.request.use((ctx) => {
//   const token = getCookie('access_token');
//   if (token) ctx.headers['Authorization'] = `Bearer ${token}`;
//   return ctx;
// });
//
// apiClient.interceptors.error.use((err) => {
//   if (err.isUnauthorized() && typeof window !== 'undefined') {
//     window.location.href = '/login';
//   }
//   throw err;
// });
