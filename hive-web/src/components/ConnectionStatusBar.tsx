/**
 * ConnectionStatusBar — persistent connection status indicator for the nav bar (MH-026).
 *
 * Shows a coloured dot with contextual text depending on the WebSocket state.
 * In the "disconnected" state, a Retry button allows the user to bypass the
 * backoff timer and reconnect immediately. A brief "Connected" toast is shown
 * when the connection is restored after an outage.
 *
 * The component receives already-processed state from `useConnectionStatus`;
 * callers are responsible for providing the raw retry / last-connected data
 * to that hook and passing the result here.
 */

import type { ConnectionStatus } from '../hooks/useWebSocket';

interface ConnectionStatusBarProps {
  /** Debounce-adjusted status for display (from useConnectionStatus). */
  displayStatus: ConnectionStatus;
  /** Server URL shown in the tooltip. */
  serverUrl: string;
  /** ISO string of last successful connection, or null. */
  lastConnectedStr: string | null;
  /** "Xs" or "now" string for next retry countdown, or null. */
  nextRetryStr: string | null;
  /** Whether to show the "Connection restored" toast. */
  showRestoredToast: boolean;
  /** Called when the user clicks the Retry button. */
  onRetry: () => void;
}

/** Colour + label config per display status. */
const STATUS_CONFIG: Record<
  ConnectionStatus,
  { dot: string; label: string | null }
> = {
  connected: {
    dot: 'bg-green-500',
    label: null, // quiet state — no label
  },
  connecting: {
    dot: 'bg-yellow-500 animate-pulse',
    label: 'Reconnecting\u2026',
  },
  disconnected: {
    dot: 'bg-red-500',
    label: 'Disconnected',
  },
};

/**
 * Persistent connection status indicator for placement in the top nav bar.
 */
export function ConnectionStatusBar({
  displayStatus,
  serverUrl,
  lastConnectedStr,
  nextRetryStr,
  showRestoredToast,
  onRetry,
}: ConnectionStatusBarProps) {
  const { dot, label } = STATUS_CONFIG[displayStatus];

  // Tooltip content
  const tooltipLines: string[] = [
    `Status: ${displayStatus}`,
    `Server: ${serverUrl}`,
  ];
  if (lastConnectedStr) {
    tooltipLines.push(`Last connected: ${lastConnectedStr}`);
  }
  if (nextRetryStr) {
    tooltipLines.push(`Next retry: ${nextRetryStr}`);
  }
  const tooltipText = tooltipLines.join('\n');

  return (
    <div className="relative flex items-center gap-1.5" data-testid="connection-status-bar">
      {/* Coloured indicator dot + optional label */}
      <div
        className="flex items-center gap-1.5 text-xs cursor-default select-none"
        title={tooltipText}
        data-testid="connection-status-indicator"
        aria-label={`Connection status: ${displayStatus}`}
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`}
          data-testid="connection-status-dot"
        />
        {label && (
          <span
            className={`${displayStatus === 'disconnected' ? 'text-red-400' : 'text-yellow-400'}`}
            data-testid="connection-status-label"
          >
            {label}
          </span>
        )}
      </div>

      {/* Retry button (disconnected only) */}
      {displayStatus === 'disconnected' && (
        <button
          onClick={onRetry}
          className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-100 transition-colors"
          data-testid="connection-retry-button"
          aria-label="Retry connection"
        >
          Retry
        </button>
      )}

      {/* Restored toast */}
      {showRestoredToast && (
        <div
          className="absolute top-8 right-0 bg-green-700 text-white text-xs px-3 py-1.5 rounded shadow-lg whitespace-nowrap z-50"
          data-testid="connection-restored-toast"
          role="status"
          aria-live="polite"
        >
          Connected
        </div>
      )}
    </div>
  );
}
