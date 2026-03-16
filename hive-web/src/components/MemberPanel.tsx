import { useMemo } from 'react';

/** A room member with presence info. */
export interface Member {
  username: string;
  status?: string;
  isAgent: boolean;
}

interface UserCardProps {
  member: Member;
}

/** Single user card in the member panel. */
function UserCard({ member }: UserCardProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
      {/* Presence indicator */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          member.status ? 'bg-green-500' : 'bg-gray-400'
        }`}
        title={member.status ? 'online' : 'offline'}
      />

      {/* Avatar placeholder */}
      <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">
        {member.isAgent ? '🤖' : member.username.charAt(0).toUpperCase()}
      </div>

      {/* Username + status */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {member.username}
        </div>
        {member.status && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {member.status}
          </div>
        )}
      </div>
    </div>
  );
}

interface MemberPanelProps {
  members: Member[];
  roomName?: string;
}

/** Right-panel component showing online room members with status. */
export function MemberPanel({ members, roomName }: MemberPanelProps) {
  const { humans, agents } = useMemo(() => {
    const humans = members.filter((m) => !m.isAgent);
    const agents = members.filter((m) => m.isAgent);
    return { humans, agents };
  }, [members]);

  const onlineCount = members.filter((m) => m.status).length;

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Members
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {onlineCount} online · {members.length} total
          {roomName && ` · ${roomName}`}
        </p>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto py-2">
        {humans.length > 0 && (
          <div className="mb-2">
            <div className="px-4 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              People ({humans.length})
            </div>
            {humans.map((member) => (
              <UserCard key={member.username} member={member} />
            ))}
          </div>
        )}

        {agents.length > 0 && (
          <div>
            <div className="px-4 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Agents ({agents.length})
            </div>
            {agents.map((member) => (
              <UserCard key={member.username} member={member} />
            ))}
          </div>
        )}

        {members.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No members in this room
          </div>
        )}
      </div>
    </div>
  );
}
