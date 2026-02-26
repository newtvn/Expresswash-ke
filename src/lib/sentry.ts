/**
 * Sentry Error Monitoring
 *
 * Uses the modern functional integration API (@sentry/react v8+).
 * To enable: set VITE_SENTRY_DSN in your .env file.
 * If the DSN is not set, all exports become safe no-ops.
 */

import * as Sentry from '@sentry/react';

export const initSentry = () => {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  if (!sentryDsn) {
    console.warn('Sentry DSN not configured. Error monitoring is disabled.');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || 'development',

    integrations: [
      Sentry.browserTracingIntegration({
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/expresswash\.co\.ke/,
        ],
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance: 10% in prod, 100% in dev
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

    // Session Replay: 1% of normal sessions, 50% of error sessions
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 0.5,

    beforeSend(event, hint) {
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          // Ignore network errors (handled by React Query retry logic)
          if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
            return null;
          }
          // Ignore ResizeObserver errors (browser noise)
          if (error.message.includes('ResizeObserver loop')) {
            return null;
          }
        }
      }
      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      // Don't send console logs to Sentry
      if (breadcrumb.category === 'console') {
        return null;
      }
      return breadcrumb;
    },
  });
};

export const setSentryUser = (user: { id: string; email?: string; name?: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
};

export const clearSentryUser = () => {
  Sentry.setUser(null);
};

export { Sentry };
