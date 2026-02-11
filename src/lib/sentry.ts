/**
 * Sentry Error Monitoring Setup
 *
 * This file provides the configuration for Sentry error monitoring.
 * To enable Sentry:
 * 1. Install Sentry: npm install @sentry/react
 * 2. Set VITE_SENTRY_DSN in your .env file
 * 3. Uncomment the code below and import in main.tsx
 */

/*
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
    integrations: [
      new Sentry.BrowserTracing({
        // Set sampling rate for performance monitoring
        tracePropagationTargets: ['localhost', /^https:\/\/yourapp\.com/],
      }),
      new Sentry.Replay({
        // Session replay for debugging
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance Monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || 'development',

    // Error filtering
    beforeSend(event, hint) {
      // Filter out known non-critical errors
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          // Ignore network errors (handled by retry logic)
          if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
            return null;
          }

          // Ignore specific errors that are not actionable
          if (error.message.includes('ResizeObserver loop')) {
            return null;
          }
        }
      }
      return event;
    },

    // User context (optional - add user info for better debugging)
    beforeBreadcrumb(breadcrumb, hint) {
      // Sanitize sensitive data from breadcrumbs
      if (breadcrumb.category === 'console') {
        return null; // Don't send console logs to Sentry
      }
      return breadcrumb;
    },
  });

  // Set user context when available
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
};

// Export Sentry for manual error logging
export { Sentry };
*/

// Placeholder functions when Sentry is not installed
export const initSentry = () => {
  console.log('Sentry not configured. Install @sentry/react to enable error monitoring.');
};

export const setSentryUser = (_user: { id: string; email?: string; name?: string }) => {
  // No-op when Sentry is not enabled
};

export const clearSentryUser = () => {
  // No-op when Sentry is not enabled
};
