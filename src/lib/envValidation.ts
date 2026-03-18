/**
 * Environment Variable Validation
 * Validates required environment variables on startup
 */

interface EnvValidationResult {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
}

const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const OPTIONAL_ENV_VARS = [
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_SENTRY_DSN',
  'VITE_SESSION_TIMEOUT_MINUTES',
];

/**
 * Validate environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const varName of REQUIRED_ENV_VARS) {
    const value = import.meta.env[varName];
    if (!value || value === '') {
      missingVars.push(varName);
    }
  }

  // Check optional vars and warn if missing
  for (const varName of OPTIONAL_ENV_VARS) {
    const value = import.meta.env[varName];
    if (!value || value === '') {
      warnings.push(`Optional environment variable ${varName} is not set`);
    }
  }

  const isValid = missingVars.length === 0;

  return {
    isValid,
    missingVars,
    warnings,
  };
}

/**
 * Validate and throw error if invalid
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.isValid) {
    const errorMessage = `
Missing required environment variables:
${result.missingVars.map((v) => `  - ${v}`).join('\n')}

Please check your .env file and ensure all required variables are set.
See .env.example for reference.
    `.trim();

    throw new Error(errorMessage);
  }

  // Log warnings in development
  if (import.meta.env.DEV && result.warnings.length > 0) {
    console.warn('Environment warnings:');
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(key: string, fallback?: string): string {
  const value = import.meta.env[key];
  if (!value && fallback === undefined) {
    throw new Error(`Environment variable ${key} is not set and no fallback provided`);
  }
  return value || fallback || '';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * Get app version from package.json (if available)
 */
export function getAppVersion(): string {
  return import.meta.env.VITE_APP_VERSION || '1.0.0';
}
