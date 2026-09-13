export class ProviderError extends Error {
  readonly provider: string;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(message: string, opts: { provider: string; retryable: boolean; cause?: unknown }) {
    super(message);
    this.name = 'ProviderError';
    this.provider = opts.provider;
    this.retryable = opts.retryable;
    this.cause = opts.cause;
  }
}

/** 429/5xx/timeout — worth falling back to the next registered provider for the capability. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
