"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";
import { isSessionExpired, useSession } from "@/lib/SessionContext";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatSidebarProps = {
  boardId: number;
  isOpen: boolean;
  onClose: () => void;
  onBoardUpdate: (board: BoardData) => void;
};

export const ChatSidebar = ({ boardId, isOpen, onClose, onBoardUpdate }: ChatSidebarProps) => {
  const { notifyUnauthorized } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const result = await api.sendChatMessage(boardId, message);
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      onBoardUpdate(result.board);
    } catch (err) {
      if (isSessionExpired(err)) {
        notifyUnauthorized();
        return;
      }
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-[var(--navy-dark)]/20 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed right-0 top-0 z-40 flex h-screen w-full max-w-sm flex-col border-l border-[var(--stroke)] bg-white shadow-[var(--shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
              Assistant
            </p>
            <h2 className="mt-2 font-display text-lg font-semibold text-[var(--navy-dark)]">
              Ask the board
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            className="rounded-full border border-transparent p-2 text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M1 1L17 17M17 1L1 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4" data-testid="chat-messages">
          {messages.length === 0 && (
            <p className="text-sm text-[var(--gray-text)]">
              Ask me to create, edit, or move cards — for example, &ldquo;move the
              design review card to Done.&rdquo;
            </p>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] break-words rounded-2xl bg-[var(--primary-blue)] px-4 py-2 text-sm text-white"
                  : "max-w-[85%] break-words rounded-2xl bg-[var(--surface)] px-4 py-2 text-sm text-[var(--navy-dark)]"
              }
            >
              {message.content}
            </div>
          ))}
          {sending && (
            <div className="max-w-[85%] rounded-2xl bg-[var(--surface)] px-4 py-2 text-sm text-[var(--gray-text)]">
              Thinking...
            </div>
          )}
        </div>

        {error && (
          <p className="px-6 pb-2 text-sm font-medium text-[var(--accent-yellow)]">{error}</p>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-[var(--stroke)] px-4 py-4"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask the assistant..."
            className="flex-1 rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </aside>
    </>
  );
};
