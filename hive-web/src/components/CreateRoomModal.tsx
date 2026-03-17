/**
 * CreateRoomModal — form to create a new room (MH-014).
 *
 * Calls POST /api/rooms with the room name and optional description.
 * Calls `onCreated` with the new room ID on success so the parent can
 * select it immediately.
 */

import { type FormEvent, useState, useEffect, useRef } from "react";
import { authHeader } from "../lib/auth";
import { FieldError } from "./FieldError";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const NAME_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

interface CreateRoomResponse {
  id: string;
  name: string;
  workspace_id: number;
}

interface CreateRoomModalProps {
  onCreated: (roomId: string) => void;
  onClose: () => void;
}

export function CreateRoomModal({ onCreated, onClose }: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus name field on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const nameError = name.length > 0 && !NAME_PATTERN.test(name)
    ? "Name must be 1–80 characters: letters, numbers, hyphens, underscores only"
    : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!NAME_PATTERN.test(name)) {
      setError("Invalid room name.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `Unexpected error (${res.status})`);
        return;
      }

      const created = (await res.json()) as CreateRoomResponse;
      onCreated(created.id);
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="create-room-modal"
    >
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          Create a room
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="room-name"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Room name
            </label>
            <input
              ref={nameRef}
              id="room-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. general"
              maxLength={80}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="room-name-input"
            />
            {nameError && <FieldError message={nameError} />}
          </div>

          <div className="mb-5">
            <label
              htmlFor="room-description"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Description{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              id="room-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this room for?"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="room-description-input"
            />
          </div>

          {error && (
            <p
              className="mb-4 text-sm text-red-400"
              data-testid="create-room-error"
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
              disabled={submitting || !name || !!nameError}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="create-room-submit"
            >
              {submitting ? "Creating…" : "Create room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
