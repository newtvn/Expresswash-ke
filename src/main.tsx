import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { validateEnvironmentOrThrow } from "./lib/envValidation";

// Validate environment variables before app starts
try {
  validateEnvironmentOrThrow();
} catch (error) {
  console.error('Environment validation failed:', error);
  // Show error to user
  document.getElementById("root")!.innerHTML = `
    <div style="display: flex; align-items: center; justify-center; height: 100vh; padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
      <div style="max-width: 600px; padding: 40px; border: 2px solid #ef4444; border-radius: 12px; background: #fef2f2;">
        <h1 style="color: #991b1b; margin: 0 0 16px 0; font-size: 24px;">Configuration Error</h1>
        <p style="color: #7f1d1d; margin: 0 0 16px 0; line-height: 1.6;">
          The application is missing required environment variables and cannot start.
        </p>
        <pre style="background: #fee2e2; padding: 16px; border-radius: 8px; overflow-x: auto; color: #991b1b; font-size: 14px;">${error instanceof Error ? error.message : String(error)}</pre>
      </div>
    </div>
  `;
  throw error;
}

createRoot(document.getElementById("root")!).render(<App />);
