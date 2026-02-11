# Sentry Error Monitoring Setup Guide

This guide explains how to enable Sentry error monitoring for ExpressWash.

## Why Sentry?

Sentry provides real-time error tracking and performance monitoring for production applications. It helps you:
- Track and debug errors in production
- Monitor application performance
- Replay user sessions where errors occurred
- Get notified of critical errors immediately

## Prerequisites

1. Create a Sentry account at [https://sentry.io](https://sentry.io)
2. Create a new React project in Sentry
3. Get your DSN (Data Source Name) from the project settings

## Installation Steps

### 1. Install Sentry Package

```bash
npm install @sentry/react
```

### 2. Configure Environment Variables

Add your Sentry DSN to `.env`:

```env
# Sentry Error Monitoring
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id
VITE_APP_VERSION=1.0.0
```

### 3. Enable Sentry

Edit `src/lib/sentry.ts` and uncomment the Sentry configuration code (lines 10-95).

### 4. Initialize in main.tsx

Update `src/main.tsx` to initialize Sentry:

```typescript
import { initSentry } from './lib/sentry';

// Initialize Sentry (before React render)
initSentry();

// ... rest of your main.tsx
```

### 5. Update AuthStore (Optional)

To track user context in Sentry, update `src/stores/authStore.ts`:

```typescript
import { setSentryUser, clearSentryUser } from '@/lib/sentry';

// In setAuth function:
setAuth: (user, token) => {
  set({ user, token, isAuthenticated: true });
  // Track user in Sentry
  if (user) {
    setSentryUser({ id: user.id, email: user.email, name: user.name });
  }
},

// In clearAuth function:
clearAuth: () => {
  set({ user: null, token: null, isAuthenticated: false });
  clearSentryUser();
},
```

## Configuration Options

### Performance Monitoring

Adjust `tracesSampleRate` in `src/lib/sentry.ts`:
- **Development**: `1.0` (100% of transactions)
- **Production**: `0.1` (10% of transactions to reduce costs)

### Session Replay

Adjust replay sample rates:
- **replaysSessionSampleRate**: `0.1` (10% of normal sessions)
- **replaysOnErrorSampleRate**: `1.0` (100% of error sessions)

### Error Filtering

The `beforeSend` function filters out:
- Network errors (already handled by retry logic)
- ResizeObserver errors (browser quirks)
- Any other non-actionable errors

You can customize this filter in `src/lib/sentry.ts`.

## Testing Sentry

To test if Sentry is working:

```typescript
// Add this button temporarily to any page
<button onClick={() => { throw new Error('Sentry Test Error'); }}>
  Test Sentry
</button>
```

Click the button and verify the error appears in your Sentry dashboard.

## Alerting

Set up alerts in Sentry dashboard:
1. Go to **Alerts** → **Create Alert**
2. Choose conditions (e.g., "When an error occurs more than 10 times in 1 hour")
3. Set notification channels (email, Slack, PagerDuty, etc.)

## Cost Optimization

Sentry has usage-based pricing. To optimize costs:

1. **Reduce sample rates** in production
2. **Filter unnecessary errors** in `beforeSend`
3. **Set appropriate data retention** in Sentry settings
4. **Use source maps** only in production builds

## Source Maps (Production)

To get readable stack traces in production:

1. Update `vite.config.ts`:

```typescript
export default defineConfig({
  build: {
    sourcemap: true, // Generate source maps
  },
})
```

2. Upload source maps to Sentry:

```bash
# Install Sentry CLI
npm install -D @sentry/vite-plugin

# Update vite.config.ts
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    sentryVitePlugin({
      org: "your-org",
      project: "your-project",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

## Troubleshooting

### Error: "Sentry DSN not configured"

- Ensure `VITE_SENTRY_DSN` is set in `.env`
- Restart your dev server after adding environment variables

### Errors not appearing in Sentry

- Check that Sentry is initialized before React renders
- Verify your DSN is correct
- Check browser console for Sentry initialization errors
- Ensure you're not filtering out the error in `beforeSend`

### High Sentry costs

- Reduce `tracesSampleRate` and replay sample rates
- Add more aggressive error filtering in `beforeSend`
- Review Sentry quotas in project settings

## Resources

- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Session Replay](https://docs.sentry.io/product/session-replay/)
- [Sentry Pricing](https://sentry.io/pricing/)
