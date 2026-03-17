/** Room list sidebar component. */

import { EmptyState } from './EmptyState';
import { RoomListSkeleton } from './Skeleton';

interface Room {
  id: string;
  name: string;
  unreadCount: number;
}

interface RoomListProps {
  rooms: Room[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  /** True while the room list is being fetched for the first time. */
  loading?: boolean;
  /** Set to true when the backend/daemon is unreachable (e.g. 503 or network error). */
  daemonOffline?: boolean;
  /** The configured API/daemon URL, shown in the offline state for user verification. */
  daemonUrl?: string;
  /** Called when the user clicks "Retry" in the daemon-offline state. */
  onRetry?: () => void;
  /** Called when the user clicks "Create your first room" in the no-rooms state. */
  onCreateRoom?: () => void;
}

export function RoomList({
  rooms,
  selectedRoomId,
  onSelectRoom,
  loading = false,
  daemonOffline = false,
  daemonUrl,
  onRetry,
  onCreateRoom,
}: RoomListProps) {
  if (loading) {
    return <RoomListSkeleton />;
  }

  if (daemonOffline) {
    return (
      <EmptyState
        icon="🔌"
        title="Daemon offline"
        description={
          daemonUrl
            ? `Cannot reach the Hive server at ${daemonUrl}. Check that it is running.`
            : 'Cannot reach the Hive server. Check that it is running.'
        }
        action={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
      />
    );
  }

  if (rooms.length === 0) {
    return (
      <EmptyState
        icon="💬"
        title="No rooms yet"
        description="Create a room to start collaborating with your agents."
        action={
          onCreateRoom
            ? { label: 'Create your first room', onClick: onCreateRoom }
            : undefined
        }
      />
    );
  }

  return (
    <ul className="space-y-0.5 px-2" role="list" aria-label="Rooms">
      {rooms.map((room) => (
        <li key={room.id}>
          <button
            onClick={() => onSelectRoom(room.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${
              selectedRoomId === room.id
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            <span className="truncate">#{room.name}</span>
            {room.unreadCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-blue-600 text-white min-w-[1.25rem] text-center">
                {room.unreadCount > 99 ? '99+' : room.unreadCount}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export type { Room, RoomListProps };
