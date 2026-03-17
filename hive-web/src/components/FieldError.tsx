/**
 * Inline field-level error message for forms (MH-006).
 *
 * Renders directly beneath the relevant input so users see which field has an
 * error without hunting for a toast.
 */

interface FieldErrorProps {
  /** Error text, or null/undefined to render nothing. */
  message: string | null | undefined;
  /** data-testid forwarded to the root element. */
  'data-testid'?: string;
}

/**
 * Inline form field error.
 *
 * @example
 * <input id="name" ... />
 * <FieldError message={errors.name} data-testid="name-error" />
 */
export function FieldError({ message, 'data-testid': testId }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      role="alert"
      aria-live="polite"
      data-testid={testId ?? 'field-error'}
      className="mt-1 text-xs text-red-400"
    >
      {message}
    </p>
  );
}
