/** Room list sidebar component (FE-003). */

import { EmptyState } from './EmptyState';

interface Room {
  id: string;
  name: string;
  unreadCount: number;
}

interface RoomListProps {
  rooms: Room[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  /** Called when the user clicks "Create your first room". */
  onCreateRoom?: () => void;
}

export function RoomList({ rooms, selectedRoomId, onSelectRoom, onCreateRoom }: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <EmptyState
        data-testid="room-list-empty"
        icon="🏠"
        title="No rooms yet"
        description="Create your first room to start chatting with your team."
        action={onCreateRoom ? { label: 'Create your first room', onClick: onCreateRoom } : undefined}
      />
    );
  }

  return (
    <ul className="space-y-0.5 px-2">
      {rooms.map((room) => (
        <li key={room.id}>
          <button
            onClick={() => onSelectRoom(room.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${
              selectedRoomId === room.id
                ? "bg-blue-600/20 text-blue-300"
                : "text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            <span className="truncate">#{room.name}</span>
            {room.unreadCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-blue-600 text-white min-w-[1.25rem] text-center">
                {room.unreadCount > 99 ? "99+" : room.unreadCount}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export type { Room, RoomListProps };

