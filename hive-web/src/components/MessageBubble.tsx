import { useState } from 'react';
import type { RoomMessage } from '../hooks/useWebSocket';

interface MessageBubbleProps {
  message: RoomMessage;
  currentUser?: string;
  /**
   * When true, suppress the avatar and sender name because this message is
   * part of a group from the same sender (sent within 5 minutes of the
   * previous message from that user).
   */
  isGrouped?: boolean;
}

/** Format a timestamp as a relative string (e.g. "3m ago"). */
function formatRelative(ts: string): string {
  const date = new Date(ts);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Format a timestamp as an absolute string for hover display. */
function formatAbsolute(ts: string): string {
  return new Date(ts).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Highlight @mentions of the current user. */
function renderContent(
  content: string,
  currentUser?: string,
): React.ReactNode {
  if (!currentUser) return content;
  const mention = `@${currentUser}`;
  const parts = content.split(new RegExp(`(${mention})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === mention.toLowerCase() ? (
      <span key={i} className="bg-blue-600/30 text-blue-300 rounded px-0.5">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** System-style message (join, leave, system, event). */
function SystemMessage({ message }: { message: RoomMessage }) {
  const icon =
    message.type === 'join'
      ? '+'
      : message.type === 'leave'
        ? '-'
        : message.type === 'event'
          ? '!'
          : '*';
  const text =
    message.type === 'join'
      ? `${message.user} joined`
      : message.type === 'leave'
        ? `${message.user} left`
        : (message.content ?? '');

  return (
    <div className="flex items-start gap-2 px-4 py-1 text-xs text-gray-500">
      <span className="w-5 text-center font-mono text-gray-600">{icon}</span>
      <span className="flex-1">
        [{formatRelative(message.ts)}] {text}
      </span>
    </div>
  );
}

export default function MessageBubble({
  message,
  currentUser,
  isGrouped = false,
}: MessageBubbleProps) {
  const [showAbsolute, setShowAbsolute] = useState(false);

  if (['join', 'leave', 'system', 'event'].includes(message.type)) {
    return <SystemMessage message={message} />;
  }

  return (
    <div
      className={`flex items-start gap-3 px-4 hover:bg-gray-800/50 transition-colors ${
        isGrouped ? 'py-0.5' : 'py-2'
      }`}
    >
      {/* Avatar — shown only on the first message in a group */}
      {isGrouped ? (
        <div className="w-8 shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {message.user.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Header row — sender name + timestamp, suppressed for grouped messages */}
        {!isGrouped && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm text-gray-100">
              {message.user}
            </span>
            <span
              className="text-xs text-gray-500 cursor-default select-none"
              title={formatAbsolute(message.ts)}
              onMouseEnter={() => setShowAbsolute(true)}
              onMouseLeave={() => setShowAbsolute(false)}
            >
              {showAbsolute ? formatAbsolute(message.ts) : formatRelative(message.ts)}
            </span>
          </div>
        )}

        <p className="text-sm text-gray-200 mt-0.5 break-words whitespace-pre-wrap">
          {renderContent(message.content ?? '', currentUser)}
        </p>
      </div>
    </div>
  );
}
