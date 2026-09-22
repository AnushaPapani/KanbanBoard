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
import { Spinner } from "@/components/Spinner";
import { moveCard as moveCardLocally, type BoardData } from "@/lib/kanban";
import * as api from "@/lib/api";
import { isSessionExpired, useSession } from "@/lib/SessionContext";

type KanbanBoardProps = {
  boardId: number;
};

const emptyBoard: BoardData = { columns: [], cards: {} };

export const KanbanBoard = ({ boardId }: KanbanBoardProps) => {
  const { notifyUnauthorized } = useSession();
  const [board, setBoard] = useState<BoardData>(emptyBoard);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    api
      .fetchBoard(boardId)
      .then((data) => {
        setBoard(data);
        setStatus("ready");
      })
      .catch((error) => {
        if (isSessionExpired(error)) {
          notifyUnauthorized();
          return;
        }
        setStatus("error");
      });
  }, [boardId, notifyUnauthorized]);

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
    } catch (error) {
      if (isSessionExpired(error)) {
        notifyUnauthorized();
        return;
      }
      setActionError("Something went wrong saving that change. The board has been refreshed.");
      try {
        setBoard(await api.fetchBoard(boardId));
      } catch (refetchError) {
        if (isSessionExpired(refetchError)) {
          notifyUnauthorized();
        }
        // Otherwise the board keeps its last known state; the error banner is already showing.
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

    runAction(() => api.moveCard(boardId, cardId, targetColumn.id, position));
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
    runAction(() => api.renameColumn(boardId, columnId, title));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    runAction(() => api.addCard(boardId, columnId, title, details || "No details yet."));
  };

  const handleUpdateCard = (cardId: string, title: string, details: string) => {
    runAction(() => api.updateCard(boardId, cardId, title, details));
  };

  const handleDeleteCard = (cardId: string) => {
    runAction(() => api.deleteCard(boardId, cardId));
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading board..." />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-[var(--gray-text)]">
        Could not load the board. Please refresh.
      </div>
    );
  }

  return (
    <div className="relative">
      {actionError && (
        <div className="mb-6 rounded-2xl border border-[var(--accent-yellow)] bg-white/90 px-5 py-3 text-sm font-medium text-[var(--navy-dark)]">
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

      <button
        type="button"
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-white shadow-[var(--shadow)] transition hover:brightness-110"
        aria-label="Open assistant"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 5.5C4 4.67157 4.67157 4 5.5 4H18.5C19.3284 4 20 4.67157 20 5.5V14.5C20 15.3284 19.3284 16 18.5 16H9L5 19.5V16H5.5C4.67157 16 4 15.3284 4 14.5V5.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <ChatSidebar
        boardId={boardId}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onBoardUpdate={setBoard}
      />
    </div>
  );
};
