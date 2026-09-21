import type { Page } from "@playwright/test";

type Card = { id: string; title: string; details: string };
type Column = { id: string; title: string; cardIds: string[] };
type BoardData = { columns: Column[]; cards: Record<string, Card> };

const seedBoard = (): BoardData => ({
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-review", title: "Review", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Notes" },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Notes" },
  },
});

let nextCardId = 100;

export const mockBoardApi = async (page: Page) => {
  const board = seedBoard();

  await page.route("**/api/board", async (route) => {
    await route.fulfill({ json: board });
  });

  await page.route("**/api/board/columns/*", async (route) => {
    const columnId = route.request().url().split("/").pop()!;
    const { title } = route.request().postDataJSON();
    const column = board.columns.find((c) => c.id === columnId);
    if (column) column.title = title;
    await route.fulfill({ json: board });
  });

  await page.route("**/api/board/cards", async (route) => {
    const { column_id: columnId, title, details } = route.request().postDataJSON();
    const id = `card-${nextCardId++}`;
    board.cards[id] = { id, title, details };
    board.columns.find((c) => c.id === columnId)?.cardIds.push(id);
    await route.fulfill({ json: board });
  });

  await page.route("**/api/board/cards/*/move", async (route) => {
    const cardId = route.request().url().split("/").slice(-2)[0];
    const { column_id: targetColumnId, position } = route.request().postDataJSON();
    for (const column of board.columns) {
      column.cardIds = column.cardIds.filter((id) => id !== cardId);
    }
    board.columns.find((c) => c.id === targetColumnId)?.cardIds.splice(position, 0, cardId);
    await route.fulfill({ json: board });
  });

  await page.route("**/api/board/cards/*", async (route) => {
    const method = route.request().method();
    const cardId = route.request().url().split("/").pop()!;
    if (method === "PATCH") {
      const { title, details } = route.request().postDataJSON();
      board.cards[cardId] = { id: cardId, title, details };
    } else if (method === "DELETE") {
      delete board.cards[cardId];
      for (const column of board.columns) {
        column.cardIds = column.cardIds.filter((id) => id !== cardId);
      }
    }
    await route.fulfill({ json: board });
  });
};
