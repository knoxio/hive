import { useEffect, useRef, useState } from "react";
import type { RoomMessage } from "../hooks/useWebSocket";
import MessageBubble from "./MessageBubble";

interface ChatTimelineProps {
  messages: RoomMessage[];
  currentUser?: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

/**
 * Scrollable chat timeline with auto-scroll and "new messages" pill.
 *
 * Auto-scrolls to bottom when user is at the bottom. Shows a pill
 * with unseen count when new messages arrive while scrolled up.
 */
export default function ChatTimeline({
  messages,
  currentUser,
  onLoadMore,
  isLoadingMore,
}: ChatTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const prevLengthRef = useRef(messages.length);

  function checkAtBottom() {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setIsAtBottom(nearBottom);
    if (nearBottom) setUnseenCount(0);
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setUnseenCount(0);
    setIsAtBottom(true);
  }

  useEffect(() => {
    const newCount = messages.length - prevLengthRef.current;
    prevLengthRef.current = messages.length;
    if (newCount <= 0) return;

    if (isAtBottom) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    } else {
      setUnseenCount((prev) => prev + newCount);
    }
  }, [messages.length, isAtBottom]);

  function handleScroll() {
    checkAtBottom();
    const el = containerRef.current;
    if (el && el.scrollTop === 0 && onLoadMore && !isLoadingMore) {
      onLoadMore();
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {isLoadingMore && (
          <div className="text-center py-2 text-xs text-gray-500">
            Loading older messages...
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No messages yet
          </div>
        )}

        <div className="py-2">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUser={currentUser}
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
          {unseenCount} new message{unseenCount === 1 ? "" : "s"} ↓
        </button>
      )}
    </div>
  );
}
