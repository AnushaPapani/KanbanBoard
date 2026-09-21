"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { moveCard as moveCardLocally, type BoardData } from "@/lib/kanban";
import * as api from "@/lib/api";

type KanbanBoardProps = {
  onLogout?: () => void;
};

const emptyBoard: BoardData = { columns: [], cards: {} };

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(emptyBoard);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  useEffect(() => {
    api
      .fetchBoard()
      .then((data) => {
        setBoard(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  const runAction = async (action: () => Promise<BoardData>) => {
    setActionError(null);
    try {
      setBoard(await action());
    } catch {
      setActionError("Something went wrong saving that change. The board has been refreshed.");
      try {
        setBoard(await api.fetchBoard());
      } catch {
        // Board keeps its last known state; the error banner is already showing.
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const cardId = active.id as string;
    const nextColumns = moveCardLocally(board.columns, cardId, over.id as string);
    setBoard((prev) => ({ ...prev, columns: nextColumns }));

    const targetColumn = nextColumns.find((column) => column.cardIds.includes(cardId));
    if (!targetColumn) return;
    const position = targetColumn.cardIds.indexOf(cardId);

    runAction(() => api.moveCard(cardId, targetColumn.id, position));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleRenameColumnCommit = (columnId: string, title: string) => {
    runAction(() => api.renameColumn(columnId, title));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    runAction(() => api.addCard(columnId, title, details || "No details yet."));
  };

  const handleUpdateCard = (cardId: string, title: string, details: string) => {
    runAction(() => api.updateCard(cardId, title, details));
  };

  const handleDeleteCard = (cardId: string) => {
    runAction(() => api.deleteCard(cardId));
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
        Loading board...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-[var(--gray-text)]">
        Could not load the board. Please refresh.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1700px] flex-col gap-6 px-6 pb-16 pt-12 lg:flex-row">
        <main className="flex flex-1 flex-col gap-10">
          <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                  Single Board Kanban
                </p>
                <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                  Kanban Studio
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                  Keep momentum visible. Rename columns, drag cards between stages,
                  and capture quick notes without getting buried in settings.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="h-fit rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
                >
                  Log out
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {board.columns.map((column) => (
                <div
                  key={column.id}
                  className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                  {column.title}
                </div>
              ))}
            </div>
          </header>

          {actionError && (
            <div className="rounded-2xl border border-[var(--accent-yellow)] bg-white/90 px-5 py-3 text-sm font-medium text-[var(--navy-dark)]">
              {actionError}
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onRenameCommit={handleRenameColumnCommit}
                  onAddCard={handleAddCard}
                  onUpdateCard={handleUpdateCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>

        <div className="w-full lg:w-96 lg:flex-shrink-0">
          <ChatSidebar onBoardUpdate={setBoard} />
        </div>
      </div>
    </div>
  );
};
