import { useCallback, useRef, useState } from 'react';
import type { RoomMessage } from './useWebSocket';
import { authHeader } from '../lib/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Maximum messages kept per room to avoid unbounded memory growth. */
const HISTORY_CAP = 500;

interface HistoryResponse {
  messages: RoomMessage[];
  has_more: boolean;
}

interface UseMessageHistoryReturn {
  /** Historical messages for the active room (oldest first). */
  historyMessages: RoomMessage[];
  /** Whether older messages exist beyond the current page. */
  hasMore: boolean;
  /** Whether a history fetch is in progress. */
  isLoadingMore: boolean;
  /** Load the initial 50 messages when entering a room. */
  loadInitial: (roomId: string) => Promise<void>;
  /** Load the next page of older messages (cursor = oldest currently loaded). */
  loadMore: (roomId: string) => Promise<void>;
  /** Clear history for a room (called on room switch). */
  clearHistory: (roomId: string) => void;
}

/**
 * Manages per-room message history with cursor-based backward pagination.
 *
 * Historical messages are stored per-room and merged with live WS messages
 * in the parent component. History is capped at HISTORY_CAP messages per
 * room to avoid unbounded memory growth.
 */
export function useMessageHistory(): UseMessageHistoryReturn {
  // Per-room history: roomId → oldest-first array of messages.
  const historyRef = useRef<Map<string, RoomMessage[]>>(new Map());
  // Per-room has_more flag.
  const hasMoreRef = useRef<Map<string, boolean>>(new Map());

  // Active room's history exposed as state for re-renders.
  const [historyMessages, setHistoryMessages] = useState<RoomMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /** Active room ID — needed to ignore stale responses after room switch. */
  const activeRoomRef = useRef<string | null>(null);

  const fetchPage = useCallback(
    async (roomId: string, before?: string): Promise<HistoryResponse> => {
      const params = new URLSearchParams({ limit: '50' });
      if (before) params.set('before', before);
      const res = await fetch(
        `${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/messages?${params}`,
        { headers: authHeader() },
      );
      if (!res.ok) {
        return { messages: [], has_more: false };
      }
      const data = (await res.json()) as HistoryResponse;
      return data;
    },
    [],
  );

  const loadInitial = useCallback(
    async (roomId: string) => {
      activeRoomRef.current = roomId;
      setIsLoadingMore(true);
      try {
        const { messages, has_more } = await fetchPage(roomId);
        if (activeRoomRef.current !== roomId) return; // stale
        historyRef.current.set(roomId, messages);
        hasMoreRef.current.set(roomId, has_more);
        setHistoryMessages(messages);
        setHasMore(has_more);
      } finally {
        if (activeRoomRef.current === roomId) setIsLoadingMore(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(
    async (roomId: string) => {
      if (isLoadingMore) return;
      const current = historyRef.current.get(roomId) ?? [];
      if (current.length === 0) return;
      const oldestId = current[0]?.id;
      if (!oldestId) return;

      setIsLoadingMore(true);
      try {
        const { messages, has_more } = await fetchPage(roomId, oldestId);
        if (activeRoomRef.current !== roomId) return; // stale
        // Prepend older messages, cap total at HISTORY_CAP.
        const merged = [...messages, ...current];
        const capped = merged.slice(-HISTORY_CAP);
        historyRef.current.set(roomId, capped);
        hasMoreRef.current.set(roomId, has_more);
        setHistoryMessages(capped);
        setHasMore(has_more);
      } finally {
        if (activeRoomRef.current === roomId) setIsLoadingMore(false);
      }
    },
    [fetchPage, isLoadingMore],
  );

  const clearHistory = useCallback((roomId: string) => {
    historyRef.current.delete(roomId);
    hasMoreRef.current.delete(roomId);
    if (activeRoomRef.current === roomId) {
      setHistoryMessages([]);
      setHasMore(false);
      setIsLoadingMore(false);
    }
  }, []);

  return {
    historyMessages,
    hasMore,
    isLoadingMore,
    loadInitial,
    loadMore,
    clearHistory,
  };
}
