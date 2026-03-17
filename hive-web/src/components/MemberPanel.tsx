/**
 * MemberPanel — right-side panel showing room members with presence indicators.
 * MH-020: member list per room.
 *
 * Props:
 * - `members`: merged list of members (WS-derived online + API-fetched offline).
 * - `roomName`: for display in the panel header.
 */

import { useMemo, useState } from 'react';

/** A room member with presence info. */
export interface Member {
  username: string;
  /** Display name from user profile, if available. */
  displayName?: string;
  /** "online" | "offline" | undefined — undefined treated as offline. */
  status?: string;
  isAgent: boolean;
  /** "admin" | "user" */
  role?: string;
}

// ---------------------------------------------------------------------------
// Mini profile card
// ---------------------------------------------------------------------------

interface ProfileCardProps {
  member: Member;
}

/** Tooltip-style profile card shown on hover. */
function ProfileCard({ member }: ProfileCardProps) {
  const initials = (member.displayName ?? member.username).slice(0, 2).toUpperCase();
  return (
    <div
      className="absolute left-full ml-2 top-0 z-50 w-52 bg-gray-700 rounded-lg shadow-xl border border-gray-600 p-3 text-sm"
      data-testid="member-profile-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {member.isAgent ? '🤖' : initials}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-gray-100 truncate">
            {member.displayName ?? member.username}
          </div>
          {member.displayName && (
            <div className="text-xs text-gray-400 truncate">@{member.username}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            member.status ? 'bg-green-500' : 'bg-gray-500'
          }`}
        />
        {member.status ? 'Online' : 'Offline'}
        {member.role === 'admin' && (
          <span className="ml-1 px-1 py-0.5 rounded bg-blue-800 text-blue-200 text-xs">
            admin
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single user card
// ---------------------------------------------------------------------------

interface UserCardProps {
  member: Member;
}

/** Single user card in the member panel with hover profile card. */
function UserCard({ member }: UserCardProps) {
  const [showCard, setShowCard] = useState(false);
  const initials = (member.displayName ?? member.username).slice(0, 2).toUpperCase();

  return (
    <div
      className="relative flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-700 transition-colors cursor-default"
      onMouseEnter={() => setShowCard(true)}
      onMouseLeave={() => setShowCard(false)}
      data-testid={`member-item-${member.username}`}
    >
      {/* Presence dot */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          member.status ? 'bg-green-500' : 'bg-gray-500'
        }`}
        title={member.status ? 'online' : 'offline'}
        aria-label={member.status ? 'online' : 'offline'}
      />

      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-300 flex-shrink-0">
        {member.isAgent ? '🤖' : initials}
      </div>

      {/* Name + role badge */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-100 truncate">
          {member.displayName ?? member.username}
        </div>
        {member.role === 'admin' && (
          <div className="text-xs text-blue-400">admin</div>
        )}
      </div>

      {/* Hover profile card */}
      {showCard && <ProfileCard member={member} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface MemberPanelProps {
  members: Member[];
  roomName?: string;
}

/** Right-panel component showing room members sorted online-first. */
export function MemberPanel({ members, roomName }: MemberPanelProps) {
  const { online, offline, agents } = useMemo(() => {
    const sortedHumans = members
      .filter((m) => !m.isAgent)
      .sort((a, b) => {
        const nameA = (a.displayName ?? a.username).toLowerCase();
        const nameB = (b.displayName ?? b.username).toLowerCase();
        return nameA.localeCompare(nameB);
      });

    const online = sortedHumans.filter((m) => !!m.status);
    const offline = sortedHumans.filter((m) => !m.status);

    const agents = [...members]
      .filter((m) => m.isAgent)
      .sort((a, b) => a.username.localeCompare(b.username));

    return { online, offline, agents };
  }, [members]);

  const onlineCount = members.filter((m) => !!m.status).length;
  const totalCount = members.length;

  return (
    <div className="flex flex-col h-full border-l border-gray-700 bg-gray-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300">Members</h2>
        <p className="text-xs text-gray-500" data-testid="member-count">
          {onlineCount} online · {totalCount} total
          {roomName && ` · #${roomName}`}
        </p>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto py-2">
        {online.length > 0 && (
          <div className="mb-2">
            <div className="px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Online — {online.length}
            </div>
            {online.map((member) => (
              <UserCard key={member.username} member={member} />
            ))}
          </div>
        )}

        {offline.length > 0 && (
          <div className="mb-2">
            <div className="px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Offline — {offline.length}
            </div>
            {offline.map((member) => (
              <UserCard key={member.username} member={member} />
            ))}
          </div>
        )}

        {agents.length > 0 && (
          <div>
            <div className="px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Agents — {agents.length}
            </div>
            {agents.map((member) => (
              <UserCard key={member.username} member={member} />
            ))}
          </div>
        )}

        {members.length === 0 && (
          <div
            className="px-4 py-8 text-center text-sm text-gray-500"
            data-testid="member-panel-empty"
          >
            No members in this room
          </div>
        )}
      </div>
    </div>
  );
}
