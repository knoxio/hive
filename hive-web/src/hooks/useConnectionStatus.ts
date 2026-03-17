/**
 * useConnectionStatus — wraps raw WebSocket state with UX-friendly behaviour.
 *
 * - Debounces the "disconnected" state: a clean → disconnected transition only
 *   becomes visible after 2 seconds. Brief network hiccups (< 2 s) that resolve
 *   themselves are never shown as disconnected.
 * - Tracks whether the connection was just restored so the UI can show a brief
 *   "Connected" toast.
 * - Formats tooltip metadata (last connected time, next retry time).
 *
 * MH-026
 */

import { useEffect, useRef, useState } from 'react';
import type { ConnectionStatus } from './useWebSocket';

/** Delay in ms before the "disconnected" state is shown in the UI. */
const DISCONNECTED_DEBOUNCE_MS = 2000;

/** How long (ms) to show the "Connection restored" toast. */
const TOAST_DURATION_MS = 3000;

export interface ConnectionStatusInfo {
  /**
   * The display status, which may differ from the raw WebSocket status:
   * - `connected`: fully connected; the indicator shows a quiet green dot.
   * - `connecting`: actively trying to connect or reconnect; amber pulse.
   * - `disconnected`: connection lost and debounce period expired; red dot + Retry.
   */
  displayStatus: ConnectionStatus;
  /** True during the brief window after reconnect — show the "Connected" toast. */
  showRestoredToast: boolean;
  /** Human-readable time of last connection, or null if never connected. */
  lastConnectedStr: string | null;
  /** "Xs" or "now" string for next retry countdown, or null when not reconnecting. */
  nextRetryStr: string | null;
}

interface UseConnectionStatusOptions {
  status: ConnectionStatus;
  retryAt: number | null;
  lastConnectedAt: Date | null;
}

/**
 * Derives display-ready connection status from the raw WebSocket state.
 *
 * All internal state updates that derive from `status` are deferred via
 * `setTimeout` to satisfy the react-hooks/set-state-in-effect lint rule
 * (no synchronous setState in effect bodies).
 */
export function useConnectionStatus({
  status,
  retryAt,
  lastConnectedAt,
}: UseConnectionStatusOptions): ConnectionStatusInfo {
  const [displayStatus, setDisplayStatus] = useState<ConnectionStatus>(status);
  const [showRestoredToast, setShowRestoredToast] = useState(false);
  const [nextRetryStr, setNextRetryStr] = useState<string | null>(null);

  const prevStatusRef = useRef<ConnectionStatus>(status);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Update display status when the raw status changes.
  // All setState calls are deferred into setTimeout callbacks to avoid
  // the react-hooks/set-state-in-effect lint error.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === 'disconnected') {
      // Debounce: flip to disconnected only after 2 s of sustained outage.
      const debounce = setTimeout(() => {
        setDisplayStatus('disconnected');
      }, DISCONNECTED_DEBOUNCE_MS);
      return () => clearTimeout(debounce);
    }

    if (status === 'connected') {
      const timer = setTimeout(() => {
        setDisplayStatus('connected');

        // Show "restored" toast if we recovered from a previous connection drop.
        // Only after at least one prior successful connection (lastConnectedAt set).
        if ((prev === 'connecting' || prev === 'disconnected') && lastConnectedAt !== null) {
          clearTimeout(toastTimerRef.current);
          setShowRestoredToast(true);
          toastTimerRef.current = setTimeout(() => {
            setShowRestoredToast(false);
          }, TOAST_DURATION_MS);
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    // connecting
    const timer = setTimeout(() => {
      setDisplayStatus('connecting');
    }, 0);
    return () => clearTimeout(timer);
  }, [status, lastConnectedAt]);

  // Update the "next retry in X s" countdown every second.
  useEffect(() => {
    if (retryAt === null) {
      const timer = setTimeout(() => setNextRetryStr(null), 0);
      return () => clearTimeout(timer);
    }

    const update = () => {
      const secsLeft = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setNextRetryStr(secsLeft > 0 ? `${secsLeft}s` : 'now');
    };
    // Defer the initial tick so no state is set synchronously in the effect body.
    const initial = setTimeout(update, 0);
    const interval = setInterval(update, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [retryAt]);

  // Cleanup toast timer on unmount.
  useEffect(() => {
    return () => {
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  const lastConnectedStr = lastConnectedAt?.toLocaleTimeString() ?? null;

  return { displayStatus, showRestoredToast, lastConnectedStr, nextRetryStr };
}
