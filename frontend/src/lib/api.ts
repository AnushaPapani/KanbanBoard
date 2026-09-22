import type { BoardData } from "@/lib/kanban";

export const parseJsonOrThrow = async (response: Response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "Request failed");
  }
  return response.json();
};

const request = <T>(path: string, init?: RequestInit): Promise<T> =>
  fetch(path, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  }).then(parseJsonOrThrow);

export const fetchBoard = (): Promise<BoardData> => request("/api/board");

export const renameColumn = (columnId: string, title: string): Promise<BoardData> =>
  request(`/api/board/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });

export const addCard = (columnId: string, title: string, details: string): Promise<BoardData> =>
  request("/api/board/cards", {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, title, details }),
  });

export const updateCard = (cardId: string, title: string, details: string): Promise<BoardData> =>
  request(`/api/board/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ title, details }),
  });

export const deleteCard = (cardId: string): Promise<BoardData> =>
  request(`/api/board/cards/${cardId}`, { method: "DELETE" });

export const moveCard = (cardId: string, columnId: string, position: number): Promise<BoardData> =>
  request(`/api/board/cards/${cardId}/move`, {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, position }),
  });

export type ChatResult = { reply: string; board: BoardData };

export const sendChatMessage = (message: string): Promise<ChatResult> =>
  request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
