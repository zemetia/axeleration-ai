import * as Sentry from '@sentry/nextjs';

export { Sentry };

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.withScope((scope) => {
    if (context) scope.setContext('additional', context);
    Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
): void {
  Sentry.captureMessage(message, level);
}
