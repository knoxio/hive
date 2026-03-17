/**
 * Route-level React Error Boundary (MH-006).
 *
 * Catches unexpected JavaScript errors anywhere in the component tree and
 * renders a fallback UI with a "Reload" button instead of a blank screen.
 * Stack traces are logged to the console in development but never shown to
 * users.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback.  Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] uncaught error', error, info.componentStack);
    }
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;

    if (fallback) return fallback(error, this.reset);

    return (
      <div
        role="alert"
        data-testid="error-boundary-fallback"
        className="flex flex-col items-center justify-center h-full gap-4 px-6 py-10 text-center"
      >
        <span aria-hidden="true" className="text-5xl select-none">⚠️</span>
        <h2 className="text-lg font-semibold text-gray-100">Something went wrong</h2>
        <p className="text-sm text-gray-400 max-w-sm">
          An unexpected error occurred. Reload the page to try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-1 px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
          data-testid="error-boundary-reload"
        >
          Reload
        </button>
      </div>
    );
  }
}
