/**
 * JoinRoomModal — browse all workspace rooms and join / leave them (MH-019).
 *
 * Displays every room in the workspace with a Join/Leave button. Joined state
 * is driven by the `joinedRoomIds` Set passed in from App, which the parent
 * persists to localStorage.
 */
import { useState } from 'react';
import type { Room } from './RoomList';

interface JoinRoomModalProps {
  /** All rooms available in the workspace. */
  allRooms: Room[];
  /** IDs of rooms the current user has joined. */
  joinedRoomIds: Set<string>;
  /** Called when the user clicks Join on a room. */
  onJoin: (roomId: string) => Promise<void>;
  /** Called when the user clicks Leave on a joined room. */
  onLeave: (roomId: string) => Promise<void>;
  /** Dismiss the modal. */
  onClose: () => void;
}

export function JoinRoomModal({
  allRooms,
  joinedRoomIds,
  onJoin,
  onLeave,
  onClose,
}: JoinRoomModalProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (roomId: string) => {
    setPending(roomId);
    setError(null);
    try {
      await onJoin(roomId);
    } catch {
      setError(`Failed to join ${roomId}`);
    } finally {
      setPending(null);
    }
  };

  const handleLeave = async (roomId: string) => {
    setPending(roomId);
    setError(null);
    try {
      await onLeave(roomId);
    } catch {
      setError(`Failed to leave ${roomId}`);
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Browse rooms"
      data-testid="join-room-modal"
    >
      <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100">Browse rooms</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-100 transition-colors text-xl leading-none"
            data-testid="join-room-modal-close"
          >
            ×
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-red-900/40 border-b border-red-700 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Room list */}
        <div className="flex-1 overflow-y-auto">
          {allRooms.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">
              No rooms in this workspace.
            </div>
          ) : (
            <ul className="divide-y divide-gray-700">
              {allRooms.map((room) => {
                const joined = joinedRoomIds.has(room.id);
                const isLoading = pending === room.id;
                return (
                  <li
                    key={room.id}
                    className="flex items-center justify-between px-4 py-3"
                    data-testid="room-browser-item"
                  >
                    <span className="text-sm text-gray-200">#{room.name}</span>
                    <button
                      onClick={() => (joined ? handleLeave(room.id) : handleJoin(room.id))}
                      disabled={isLoading}
                      data-testid={joined ? 'leave-room-btn' : 'join-room-btn'}
                      className={`text-xs px-3 py-1 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        joined
                          ? 'bg-red-700/30 text-red-300 hover:bg-red-700/50 border border-red-700'
                          : 'bg-blue-600 text-white hover:bg-blue-500'
                      }`}
                    >
                      {isLoading ? '…' : joined ? 'Leave' : 'Join'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
          {allRooms.length} room{allRooms.length !== 1 ? 's' : ''} in workspace
        </div>
      </div>
    </div>
  );
}
