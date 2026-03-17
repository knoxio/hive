import { useCallback, useEffect, useRef, useState } from 'react';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface RoomMessage {
  type: string;
  id: string;
  room: string;
  user: string;
  ts: string;
  content?: string;
  seq?: number;
}

interface UseWebSocketOptions {
  /** WebSocket URL (e.g. ws://localhost:3000/ws/myroom) */
  url: string;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Max reconnection attempts (default: 10) */
  maxRetries?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  initialDelay?: number;
  /** Max reconnect delay in ms (default: 30000) */
  maxDelay?: number;
}

interface UseWebSocketReturn {
  /** Current connection status */
  status: ConnectionStatus;
  /** Accumulated messages from the WebSocket */
  messages: RoomMessage[];
  /** Send a text message through the WebSocket */
  sendMessage: (content: string) => void;
  /** Manually connect to the WebSocket */
  connect: () => void;
  /** Manually disconnect from the WebSocket */
  disconnect: () => void;
  /** Clear the message buffer */
  clearMessages: () => void;
  /** Current reconnect attempt count (0 while connected) */
  retryCount: number;
  /** Epoch ms when the next reconnect attempt fires, or null if not reconnecting */
  retryAt: number | null;
  /** Timestamp of the last successful connection, or null if never connected */
  lastConnectedAt: Date | null;
}

/**
 * React hook for managing a WebSocket connection to the Hive server.
 *
 * Handles connection lifecycle, automatic reconnection with exponential
 * backoff, message parsing, and connection state tracking.
 *
 * In addition to the core `status`, exposes `retryCount`, `retryAt`, and
 * `lastConnectedAt` to power rich connection status UIs (MH-026).
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    autoConnect = true,
    maxRetries = 10,
    initialDelay = 1000,
    maxDelay = 30000,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    retriesRef.current = 0;
    setStatus('connecting');
    setRetryCount(0);
    setRetryAt(null);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setLastConnectedAt(new Date());
      setRetryCount(0);
      setRetryAt(null);
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RoomMessage;
        setMessages((prev) => [...prev, data]);
      } catch {
        // Non-JSON message — ignore
      }
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      if (event.code === 1000 || retriesRef.current >= maxRetries) {
        setStatus('disconnected');
        setRetryAt(null);
        return;
      }

      const delay = Math.min(
        initialDelay * Math.pow(2, retriesRef.current),
        maxDelay,
      );
      retriesRef.current += 1;
      const nextRetryAt = Date.now() + delay;
      setStatus('connecting');
      setRetryCount(retriesRef.current);
      setRetryAt(nextRetryAt);

      retryTimeoutRef.current = setTimeout(() => {
        if (retriesRef.current < maxRetries) {
          connectRef.current();
        } else {
          setStatus('disconnected');
          setRetryAt(null);
        }
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror — reconnect handled there
    };
  }, [url, maxRetries, initialDelay, maxDelay]);

  // Keep ref in sync for reconnection
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    retriesRef.current = maxRetries; // prevent reconnect
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'client disconnect');
      wsRef.current = null;
    }
    setStatus('disconnected');
    setRetryAt(null);
  }, [maxRetries]);

  const sendMessage = useCallback(
    (content: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Send as a JSON envelope so the room daemon can distinguish message
        // types (message, dm, command) without heuristics. Plain text is also
        // accepted by the daemon, but the JSON format is explicit and allows
        // future type additions (DM, commands) without protocol changes.
        wsRef.current.send(JSON.stringify({ type: 'message', content }));
      }
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Auto-connect on mount (deferred to avoid setState-in-effect lint)
  useEffect(() => {
    if (!autoConnect) return;
    const timer = setTimeout(() => connectRef.current(), 0);
    return () => {
      clearTimeout(timer);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'unmount');
        wsRef.current = null;
      }
    };
  }, [autoConnect]);

  return {
    status,
    messages,
    sendMessage,
    connect,
    disconnect,
    clearMessages,
    retryCount,
    retryAt,
    lastConnectedAt,
  };
}
