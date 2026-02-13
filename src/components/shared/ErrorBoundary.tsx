import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackTitle?: string;
  fullPage?: boolean;
  showHomeButton?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Unified ErrorBoundary Component
 * Catches React errors and displays user-friendly fallback UI
 * Supports Sentry integration and custom fallback rendering
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to Sentry if available (production)
    if (window.Sentry && !import.meta.env.DEV) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }

    // Development logging
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Store errorInfo in state
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const {
        fallbackTitle = 'Something went wrong',
        fullPage = false,
        showHomeButton = false,
      } = this.props;
      const isDevelopment = import.meta.env.DEV;

      // Full page error UI
      if (fullPage) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <Card className="max-w-2xl w-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/10 rounded-full">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{fallbackTitle}</CardTitle>
                    <CardDescription>
                      We encountered an unexpected error. Please try refreshing the page.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isDevelopment && this.state.error && (
                  <div className="bg-muted p-4 rounded-md overflow-auto">
                    <p className="font-mono text-sm text-destructive font-semibold">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                          Component Stack
                        </summary>
                        <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                <div className="flex gap-3 flex-wrap">
                  <Button onClick={this.handleReset} variant="default" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                  {showHomeButton && (
                    <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
                      <Home className="h-4 w-4" />
                      Go to Home
                    </Button>
                  )}
                  <Button onClick={this.handleReload} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>
                </div>

                {!isDevelopment && (
                  <div className="text-sm text-muted-foreground">
                    <p>If this problem persists, please contact support with the following information:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Time: {new Date().toLocaleString()}</li>
                      <li>Page: {window.location.pathname}</li>
                      {this.state.error && <li>Error: {this.state.error.message}</li>}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      }

      // Inline error UI (default)
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-md w-full border-border/50 shadow-lg">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {fallbackTitle}
                </h3>
                <p className="text-sm text-muted-foreground">
                  An unexpected error occurred. Please try again or reload the page.
                </p>
                {isDevelopment && this.state.error && (
                  <pre className="mt-2 p-3 bg-muted rounded-lg text-xs text-left overflow-auto max-h-32">
                    {this.state.error.message}
                  </pre>
                )}
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button onClick={this.handleReload}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Extend Window interface for Sentry
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: { contexts?: Record<string, unknown> }) => void;
    };
  }
}
