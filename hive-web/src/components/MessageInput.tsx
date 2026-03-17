import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';

interface MessageInputProps {
  /** Send a message via the WebSocket connection. */
  onSend: (content: string) => void;
  /** Whether the WebSocket is connected. Disables input when false. */
  connected: boolean;
  /** Placeholder text for the input field. */
  placeholder?: string;
  /** Maximum character length (default: 4000). */
  maxLength?: number;
}

/**
 * Chat message input with enter-to-send and character limit indicator.
 *
 * - Enter sends the message (Shift+Enter inserts a newline).
 * - Input is disabled when the WebSocket is not connected.
 * - Character counter appears when usage exceeds 80% of `maxLength`.
 */
export function MessageInput({
  onSend,
  connected,
  placeholder = 'Type a message…',
  maxLength = 4000,
}: MessageInputProps) {
  const [value, setValue] = useState('');

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      // Enforce hard limit — browser textarea doesn't support maxLength for
      // multiline inputs when Shift+Enter is used, so we enforce it here.
      if (next.length <= maxLength) {
        setValue(next);
      }
    },
    [maxLength],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed && connected) {
          onSend(trimmed);
          setValue('');
        }
      }
    },
    [value, connected, onSend],
  );

  const remaining = maxLength - value.length;
  const nearLimit = value.length > maxLength * 0.8;
  const atLimit = value.length >= maxLength;

  return (
    <div className="border-t border-zinc-700 p-3">
      <div className="relative">
        <textarea
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={!connected}
          placeholder={connected ? placeholder : 'Disconnected…'}
          data-testid="message-input"
          aria-label="Message input"
          className={`
            w-full resize-none rounded-lg px-4 py-2 text-sm
            bg-zinc-800 text-zinc-100 placeholder-zinc-500
            border focus:outline-none transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${atLimit ? 'border-red-500 focus:border-red-400' : 'border-zinc-600 focus:border-blue-500'}
          `}
          style={{ minHeight: '2.5rem', maxHeight: '8rem', overflowY: 'auto' }}
        />
        {nearLimit && (
          <span
            data-testid="char-counter"
            className={`absolute bottom-3 right-3 text-xs select-none pointer-events-none ${
              atLimit ? 'text-red-400' : 'text-zinc-400'
            }`}
            aria-live="polite"
            aria-label={`${remaining} characters remaining`}
          >
            {remaining}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-600 select-none">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
}
