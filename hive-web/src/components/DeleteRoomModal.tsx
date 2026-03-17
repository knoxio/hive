/**
 * DeleteRoomModal — confirmation dialog to delete a room (MH-015).
 *
 * Requires the user to type the room name to confirm before the delete
 * button becomes active. Calls DELETE /api/rooms/:room_id on submit and
 * invokes `onDeleted` so the parent can deselect the room.
 */

import { type FormEvent, useState, useEffect, useRef } from "react";
import { authHeader } from "../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface DeleteRoomModalProps {
  roomId: string;
  onDeleted: () => void;
  onClose: () => void;
}

export function DeleteRoomModal({
  roomId,
  onDeleted,
  onClose,
}: DeleteRoomModalProps) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus confirmation input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const confirmed = confirmation === roomId;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "DELETE",
        headers: authHeader(),
      });

      if (res.status === 204) {
        onDeleted();
        return;
      }

      if (res.status === 404) {
        setError("Room not found — it may have already been deleted.");
        return;
      }

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Unexpected error (${res.status})`);
    } catch {
      setError("Network error — could not reach server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="delete-room-modal"
    >
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-red-400 mb-2">
          Delete room
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          This action is permanent. Type{" "}
          <span className="font-mono text-gray-200">{roomId}</span> to confirm.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <input
              ref={inputRef}
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={roomId}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              data-testid="delete-room-confirmation-input"
            />
          </div>

          {error && (
            <p
              className="mb-4 text-sm text-red-400"
              data-testid="delete-room-error"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !confirmed}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="delete-room-submit"
            >
              {submitting ? "Deleting…" : "Delete room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
