/**
 * Full-page error states for navigation-level errors (MH-006).
 *
 * Used for 404 Not Found and general fatal errors on route load.  Provides a
 * link back to the dashboard so the user is never stranded.
 */

import { Link } from 'react-router-dom';

interface ErrorPageProps {
  /** Primary headline. */
  title: string;
  /** Explanatory sentence. */
  description: string;
  /** Icon / emoji displayed above the title. */
  icon?: string;
  /** data-testid forwarded to root element. */
  'data-testid'?: string;
}

/**
 * Full-page error layout.
 *
 * Renders an icon, title, description, and a "Back to dashboard" link.
 * Should be placed at the route level so broken pages do not crash the whole
 * app.
 */
export function ErrorPage({
  title,
  description,
  icon = '🚫',
  'data-testid': testId = 'error-page',
}: ErrorPageProps) {
  return (
    <div
      role="main"
      data-testid={testId}
      className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-900 text-center px-6"
    >
      <span aria-hidden="true" className="text-6xl select-none">{icon}</span>
      <h1 className="text-2xl font-bold text-gray-100">{title}</h1>
      <p className="text-sm text-gray-400 max-w-sm">{description}</p>
      <Link
        to="/"
        className="mt-2 px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
        data-testid="error-page-back"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

/** 404 Not Found page. */
export function NotFoundPage() {
  return (
    <ErrorPage
      data-testid="not-found-page"
      icon="🔍"
      title="Page not found"
      description="The page you are looking for does not exist. It may have been moved or deleted."
    />
  );
}
