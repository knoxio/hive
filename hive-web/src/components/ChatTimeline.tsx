import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RoomMessage } from '../hooks/useWebSocket';
import MessageBubble from './MessageBubble';

interface ChatTimelineProps {
  messages: RoomMessage[];
  currentUser?: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  /** Whether there are no more historical messages to load. */
  atBeginning?: boolean;
}

/** 5 minutes in milliseconds — threshold for message grouping. */
const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Determine which messages are "grouped" (same sender, within 5 minutes of
 * the previous message from the same user).
 */
function buildGroupFlags(messages: RoomMessage[]): boolean[] {
  const flags: boolean[] = new Array(messages.length).fill(false);
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    if (
      prev.user === curr.user &&
      prev.type === 'message' &&
      curr.type === 'message'
    ) {
      const prevTime = new Date(prev.ts).getTime();
      const currTime = new Date(curr.ts).getTime();
      if (currTime - prevTime < GROUP_THRESHOLD_MS) {
        flags[i] = true;
      }
    }
  }
  return flags;
}

/**
 * Scrollable chat timeline with history loading, scroll anchoring, and
 * "beginning of conversation" indicator.
 *
 * Scroll anchoring: when prepending historical messages at the top, the
 * visible content does not jump — we preserve the relative scroll offset by
 * recording scrollHeight before the update and correcting scrollTop after.
 */
export default function ChatTimeline({
  messages,
  currentUser,
  onLoadMore,
  isLoadingMore,
  atBeginning,
}: ChatTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const prevLengthRef = useRef(messages.length);

  // Scroll anchoring: record scrollHeight before prepend, restore after.
  const scrollHeightBeforeRef = useRef<number>(0);
  const isPrependingRef = useRef(false);

  function checkAtBottom() {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setIsAtBottom(nearBottom);
    if (nearBottom) setUnseenCount(0);
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnseenCount(0);
    setIsAtBottom(true);
  }

  // Detect whether a prepend happened vs. an append.
  // A prepend increases length but the first message ID changes.
  const firstMsgIdRef = useRef<string | undefined>(messages[0]?.id);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const newFirstId = messages[0]?.id;
    const oldFirstId = firstMsgIdRef.current;

    if (
      isPrependingRef.current &&
      newFirstId !== oldFirstId &&
      messages.length > prevLengthRef.current
    ) {
      // Restore scroll position after prepend to prevent content jump.
      const newScrollHeight = el.scrollHeight;
      el.scrollTop += newScrollHeight - scrollHeightBeforeRef.current;
      isPrependingRef.current = false;
    }

    firstMsgIdRef.current = newFirstId;
    prevLengthRef.current = messages.length;
  }, [messages]);

  // Auto-scroll to bottom on new appended messages when already at bottom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isAtBottom && !isPrependingRef.current) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    } else if (!isPrependingRef.current) {
      const newCount = messages.length - prevLengthRef.current;
      if (newCount > 0) {
        setUnseenCount((prev) => prev + newCount);
      }
    }
  }, [messages.length, isAtBottom]);

  function handleScroll() {
    checkAtBottom();
    const el = containerRef.current;
    if (el && el.scrollTop === 0 && onLoadMore && !isLoadingMore) {
      // Record scrollHeight before the prepend so we can anchor after.
      scrollHeightBeforeRef.current = el.scrollHeight;
      isPrependingRef.current = true;
      onLoadMore();
    }
  }

  const groupFlags = buildGroupFlags(messages);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        data-testid="chat-timeline"
      >
        {/* Beginning of conversation indicator */}
        {atBeginning && messages.length > 0 && (
          <div className="text-center py-3 text-xs text-gray-500 border-b border-gray-700/50 mx-4 mb-2">
            Beginning of conversation
          </div>
        )}

        {/* Loading spinner for older messages */}
        {isLoadingMore && (
          <div className="text-center py-2 text-xs text-gray-500">
            Loading older messages…
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No messages yet
          </div>
        )}

        <div className="py-2">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUser={currentUser}
              isGrouped={groupFlags[i]}
            />
          ))}
        </div>

        <div ref={bottomRef} />
      </div>

      {unseenCount > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-full shadow-lg transition-colors"
        >
          {unseenCount} new message{unseenCount === 1 ? '' : 's'} ↓
        </button>
      )}
    </div>
  );
}
