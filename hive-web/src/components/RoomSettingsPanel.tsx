/**
 * RoomSettingsPanel — slide-in panel for editing room display name and description (MH-018).
 *
 * Rendered on top of the chat when the settings icon in the room header is clicked.
 * Supports partial saves: only changed fields are sent to `PATCH /api/rooms/:room_id`.
 */

import { type FormEvent, useEffect, useRef, useState } from "react";
import { authHeader } from "../lib/auth";
import { FieldError } from "./FieldError";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const NAME_PATTERN = /^[a-zA-Z0-9 _-]{1,80}$/;
const MAX_DESCRIPTION = 280;

interface Room {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
}

interface RoomSettingsPanelProps {
  room: Room;
  onClose: () => void;
  /** Called with the updated room data after a successful save. */
  onUpdated: (updated: { display_name: string | null; description: string | null }) => void;
}

/**
 * Slide-in settings panel for a room.
 *
 * The panel is rendered as a fixed overlay on the right side of the viewport
 * so it does not disrupt the chat layout.
 */
export function RoomSettingsPanel({ room, onClose, onUpdated }: RoomSettingsPanelProps) {
  const [displayName, setDisplayName] = useState(room.display_name ?? "");
  const [description, setDescription] = useState(room.description ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Auto-focus first field on open.
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const initialDisplayName = room.display_name ?? "";
  const initialDescription = room.description ?? "";
  const isDirty = displayName !== initialDisplayName || description !== initialDescription;

  // Close on Escape, prompting if there are unsaved changes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isDirty) {
          if (window.confirm("Discard unsaved changes?")) onClose();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, isDirty]);

  const displayNameError =
    displayName.length > 0 && !NAME_PATTERN.test(displayName)
      ? "Display name must be 1–80 characters: letters, numbers, spaces, hyphens, underscores only"
      : null;

  const descriptionError =
    description.length > MAX_DESCRIPTION
      ? `Description must be ${MAX_DESCRIPTION} characters or fewer`
      : null;

  const canSave = isDirty && !displayNameError && !descriptionError && !saving;

  const handleReset = () => {
    setDisplayName(initialDisplayName);
    setDescription(initialDescription);
    setServerError(null);
    setSaved(false);
  };

  const handleCloseWithGuard = () => {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setServerError(null);
    setSaved(false);

    const patch: { display_name?: string | null; description?: string | null } = {};
    if (displayName !== initialDisplayName) {
      patch.display_name = displayName.trim() || null;
    }
    if (description !== initialDescription) {
      patch.description = description.trim() || null;
    }

    try {
      const res = await fetch(`${API_BASE}/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(body.error ?? `Unexpected error (${res.status})`);
        return;
      }

      const updated = (await res.json()) as Room;
      setDisplayName(updated.display_name ?? "");
      setDescription(updated.description ?? "");
      onUpdated({ display_name: updated.display_name, description: updated.description });
      setSaved(true);
    } catch {
      setServerError("Network error — could not reach server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex justify-end"
      data-testid="room-settings-panel"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseWithGuard();
      }}
    >
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      {/* Panel */}
      <aside className="relative z-10 w-80 bg-gray-800 border-l border-gray-700 flex flex-col shadow-xl h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-100" id="room-settings-title">
            Room settings
          </h2>
          <button
            onClick={handleCloseWithGuard}
            className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
            aria-label="Close settings panel"
            data-testid="room-settings-close"
          >
            ×
          </button>
        </div>

        {/* Room ID (read-only) */}
        <div className="px-4 py-3 border-b border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Room ID</p>
          <p className="text-sm text-gray-300 font-mono" data-testid="room-settings-id">
            {room.id}
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col flex-1 overflow-y-auto"
          aria-labelledby="room-settings-title"
        >
          <div className="flex-1 px-4 py-4 space-y-5">
            {/* Display name */}
            <div>
              <label
                htmlFor="room-display-name"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Display name{" "}
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                ref={firstFieldRef}
                id="room-display-name"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setSaved(false);
                }}
                placeholder={room.id}
                maxLength={80}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="room-display-name-input"
              />
              {displayNameError && <FieldError message={displayNameError} />}
              <p className="mt-1 text-xs text-gray-500">
                Friendly label shown in the UI. The room ID ({room.id}) is unchanged.
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="room-description"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Description{" "}
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                id="room-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setSaved(false);
                }}
                placeholder="What is this room for?"
                rows={3}
                maxLength={MAX_DESCRIPTION + 1}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                data-testid="room-description-input"
              />
              <div className="flex justify-between items-start mt-0.5">
                {descriptionError ? (
                  <FieldError message={descriptionError} />
                ) : (
                  <span />
                )}
                <span
                  className={`text-xs ml-auto ${
                    description.length > MAX_DESCRIPTION ? "text-red-400" : "text-gray-500"
                  }`}
                >
                  {description.length}/{MAX_DESCRIPTION}
                </span>
              </div>
            </div>
          </div>

          {/* Status + actions */}
          <div className="px-4 py-4 border-t border-gray-700 space-y-3">
            {serverError && (
              <p className="text-sm text-red-400" data-testid="room-settings-error">
                {serverError}
              </p>
            )}
            {saved && (
              <p className="text-sm text-green-400" data-testid="room-settings-saved">
                Changes saved.
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={!isDirty || saving}
                className="flex-1 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-600 rounded hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                data-testid="room-settings-reset"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="room-settings-save"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
