/**
 * Reusable empty-state component for panels with no content (MH-005).
 *
 * Renders a centred illustration, title, description, and an optional call-to-
 * action button.  All interactive elements are keyboard-focusable and labelled
 * for screen readers.
 */

export interface EmptyStateAction {
  /** Button label. */
  label: string;
  /** Called when the user activates the CTA button. */
  onClick: () => void;
  /** Optional href — renders an <a> instead of <button>. */
  href?: string;
}

export interface EmptyStateProps {
  /** Short headline explaining the empty state. */
  title: string;
  /** One or two sentences of guidance. */
  description: string;
  /**
   * Icon or illustration.  Accepts any renderable node (emoji string, SVG,
   * or a React element).  Defaults to a generic placeholder when omitted.
   */
  icon?: React.ReactNode;
  /** Optional call-to-action rendered below the description. */
  action?: EmptyStateAction;
  /** Additional CSS classes for the outermost element. */
  className?: string;
  /** data-testid forwarded to the root element. */
  'data-testid'?: string;
}

/**
 * EmptyState component.
 *
 * @example
 * <EmptyState
 *   title="No rooms yet"
 *   description="Create your first room to start chatting."
 *   icon="🏠"
 *   action={{ label: 'Create your first room', onClick: handleCreate }}
 * />
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
  'data-testid': testId = 'empty-state',
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      data-testid={testId}
      className={`flex flex-col items-center justify-center h-full gap-3 px-6 py-10 text-center ${className}`}
    >
      {/* Icon / illustration */}
      <span
        aria-hidden="true"
        className="text-4xl select-none"
      >
        {icon ?? '📭'}
      </span>

      {/* Headline */}
      <h3 className="text-base font-semibold text-gray-200">{title}</h3>

      {/* Description */}
      <p className="text-sm text-gray-400 max-w-xs">{description}</p>

      {/* Call-to-action */}
      {action &&
        (action.href ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
            data-testid="empty-state-action"
          >
            {action.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1 px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
            data-testid="empty-state-action"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
