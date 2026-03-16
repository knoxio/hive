import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';

interface MessageInputProps {
  /** Send a message via the WebSocket connection. */
  onSend: (content: string) => void;
  /** Whether the WebSocket is connected. Disables input when false. */
  connected: boolean;
  /** Placeholder text for the input field. */
  placeholder?: string;
}

/**
 * Chat message input with enter-to-send.
 *
 * Renders a text input at the bottom of the chat panel. Pressing Enter sends
 * the message via the provided `onSend` callback (from useWebSocket hook).
 * The input is disabled when the WebSocket is disconnected.
 */
export function MessageInput({
  onSend,
  connected,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [value, setValue] = useState('');

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed && connected) {
          onSend(trimmed);
          setValue('');
        }
      }
    },
    [value, connected, onSend]
  );

  return (
    <div className="border-t border-zinc-700 p-3">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={!connected}
        placeholder={connected ? placeholder : 'Disconnected...'}
        className={`
          w-full rounded-lg px-4 py-2 text-sm
          bg-zinc-800 text-zinc-100 placeholder-zinc-500
          border border-zinc-600 focus:border-blue-500 focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label="Message input"
      />
    </div>
  );
}
