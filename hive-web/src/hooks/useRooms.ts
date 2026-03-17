/**
 * useRooms — fetches the room list from the Hive server (MH-016).
 *
 * Handles auth (adds Bearer token), 401 redirect, and loading/error state.
 */

import { useEffect, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { authHeader, clearToken } from "../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface RoomEntry {
  id: string;
  name: string;
  workspace_id: number;
  workspace_name: string;
  added_at: string;
}

interface State {
  rooms: RoomEntry[];
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "done"; rooms: RoomEntry[] }
  | { type: "error"; message: string };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "done":
      return { rooms: action.rooms, loading: false, error: null };
    case "error":
      return { rooms: [], loading: false, error: action.message };
  }
}

export interface UseRoomsResult {
  rooms: RoomEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRooms(): UseRoomsResult {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, {
    rooms: [],
    loading: true,
    error: null,
  });
  const [tick, refresh] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/rooms`, { headers: authHeader() })
      .then((res) => {
        if (res.status === 401) {
          clearToken();
          navigate("/login", { replace: true });
          return null;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<{ rooms: RoomEntry[]; total: number }>;
      })
      .then((data) => {
        if (cancelled || !data) return;
        dispatch({ type: "done", rooms: data.rooms ?? [] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        dispatch({
          type: "error",
          message: err instanceof Error ? err.message : "unknown error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, tick]);

  return { ...state, refresh };
}
