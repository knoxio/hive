/** Reusable empty-state UI component for panels with no content or degraded state. */

export interface EmptyStateAction {
  /** Button/link label. */
  label: string;
  /** Called when the action button is clicked (renders as a `<button>`). */
  onClick?: () => void;
  /** If set, renders as an `<a>` tag opening in a new tab instead of a button. */
  href?: string;
}

export interface EmptyStateProps {
  /** Short heading describing the empty state. */
  title: string;
  /** Longer explanation and guidance for the user. */
  description: string;
  /** Optional emoji or icon character shown above the title. */
  icon?: string;
  /** Optional primary call-to-action. */
  action?: EmptyStateAction;
  /** Additional CSS classes applied to the wrapper element. */
  className?: string;
}

/**
 * Centered empty-state panel with title, description, optional icon, and optional CTA.
 *
 * Designed to replace blank panels so users always have context on what to do next.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center h-full p-6 text-center ${className}`}
      role="status"
      aria-label={title}
      data-testid="empty-state"
    >
      {icon && (
        <span className="text-4xl mb-4" aria-hidden="true">
          {icon}
        </span>
      )}
      <h3 className="text-base font-semibold text-gray-200 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-4">{description}</p>
      {action &&
        (action.href ? (
          <a
            href={action.href}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {action.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
