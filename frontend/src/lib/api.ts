import type { BoardData } from "@/lib/kanban";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const parseJsonOrThrow = async (response: Response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.detail ?? "Request failed");
  }
  return response.json();
};

const request = <T>(path: string, init?: RequestInit): Promise<T> =>
  fetch(path, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  }).then(parseJsonOrThrow);

export type BoardSummary = { id: number; name: string };

export const listBoards = (): Promise<BoardSummary[]> => request("/api/boards");

export const createBoard = (name: string): Promise<BoardSummary> =>
  request("/api/boards", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const fetchBoard = (boardId: number): Promise<BoardData> =>
  request(`/api/boards/${boardId}`);

export const renameColumn = (
  boardId: number,
  columnId: string,
  title: string
): Promise<BoardData> =>
  request(`/api/boards/${boardId}/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });

export const addCard = (
  boardId: number,
  columnId: string,
  title: string,
  details: string
): Promise<BoardData> =>
  request(`/api/boards/${boardId}/cards`, {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, title, details }),
  });

export const updateCard = (
  boardId: number,
  cardId: string,
  title: string,
  details: string
): Promise<BoardData> =>
  request(`/api/boards/${boardId}/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ title, details }),
  });

export const deleteCard = (boardId: number, cardId: string): Promise<BoardData> =>
  request(`/api/boards/${boardId}/cards/${cardId}`, { method: "DELETE" });

export const moveCard = (
  boardId: number,
  cardId: string,
  columnId: string,
  position: number
): Promise<BoardData> =>
  request(`/api/boards/${boardId}/cards/${cardId}/move`, {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, position }),
  });

export type ChatResult = { reply: string; board: BoardData };

export const sendChatMessage = (boardId: number, message: string): Promise<ChatResult> =>
  request(`/api/boards/${boardId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
