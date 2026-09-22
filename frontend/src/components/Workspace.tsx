"use client";

import { useEffect, useState } from "react";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { KanbanBoard } from "@/components/KanbanBoard";
import { Spinner } from "@/components/Spinner";
import * as api from "@/lib/api";
import type { BoardSummary } from "@/lib/api";
import { isSessionExpired, useSession } from "@/lib/SessionContext";

type WorkspaceProps = {
  onLogout: () => void;
};

export const Workspace = ({ onLogout }: WorkspaceProps) => {
  const { notifyUnauthorized } = useSession();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listBoards()
      .then((data) => {
        setBoards(data);
        setActiveBoardId(data[0]?.id ?? null);
        setStatus("ready");
      })
      .catch((error) => {
        if (isSessionExpired(error)) {
          notifyUnauthorized();
          return;
        }
        setStatus("error");
      });
  }, [notifyUnauthorized]);

  const handleCreateBoard = async (name: string) => {
    setCreateError(null);
    try {
      const created = await api.createBoard(name);
      setBoards((prev) => [...prev, created]);
      setActiveBoardId(created.id);
    } catch (error) {
      if (isSessionExpired(error)) {
        notifyUnauthorized();
      } else {
        setCreateError("Could not create that board. Please try again.");
      }
      throw error;
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Project Management
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Switch between boards, rename columns, drag cards between stages, and
                capture quick notes without getting buried in settings.
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="h-fit rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
            >
              Log out
            </button>
          </div>

          {status === "ready" && activeBoardId !== null && (
            <BoardSwitcher
              boards={boards}
              activeBoardId={activeBoardId}
              onSelect={setActiveBoardId}
              onCreate={handleCreateBoard}
            />
          )}
          {createError && <p className="text-sm font-medium text-red-600">{createError}</p>}
        </header>

        {status === "loading" && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Spinner label="Loading your boards..." />
          </div>
        )}

        {status === "error" && (
          <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[var(--gray-text)]">
            Could not load your boards. Please refresh.
          </div>
        )}

        {status === "ready" && activeBoardId !== null && (
          <KanbanBoard key={activeBoardId} boardId={activeBoardId} />
        )}
      </main>
    </div>
  );
};
