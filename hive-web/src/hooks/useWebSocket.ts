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
}

/**
 * React hook for managing a WebSocket connection to the Hive server.
 *
 * Handles connection lifecycle, automatic reconnection with exponential
 * backoff, message parsing, and connection state tracking.
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
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    retriesRef.current = 0;
    setStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
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
        return;
      }

      const delay = Math.min(
        initialDelay * Math.pow(2, retriesRef.current),
        maxDelay,
      );
      retriesRef.current += 1;
      setStatus('connecting');

      retryTimeoutRef.current = setTimeout(() => {
        if (retriesRef.current < maxRetries) {
          connectRef.current();
        } else {
          setStatus('disconnected');
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
  }, [maxRetries]);

  const sendMessage = useCallback(
    (content: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(content);
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

  return { status, messages, sendMessage, connect, disconnect, clearMessages };
}
