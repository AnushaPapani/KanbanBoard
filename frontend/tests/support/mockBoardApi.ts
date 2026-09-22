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

const newBoardColumns = (suffix: number): Column[] => [
  { id: `col-backlog-${suffix}`, title: "Backlog", cardIds: [] },
  { id: `col-discovery-${suffix}`, title: "Discovery", cardIds: [] },
  { id: `col-progress-${suffix}`, title: "In Progress", cardIds: [] },
  { id: `col-review-${suffix}`, title: "Review", cardIds: [] },
  { id: `col-done-${suffix}`, title: "Done", cardIds: [] },
];

let nextCardId = 100;
let nextBoardId = 2;

const pathParts = (url: string) => new URL(url).pathname.split("/");

export const mockBoardApi = async (page: Page) => {
  const boards = new Map<number, BoardData>([[1, seedBoard()]]);
  const boardNames = new Map<number, string>([[1, "My Board"]]);

  await page.route("**/api/boards", async (route) => {
    if (route.request().method() === "POST") {
      const { name } = route.request().postDataJSON();
      const id = nextBoardId++;
      boards.set(id, { columns: newBoardColumns(id), cards: {} });
      boardNames.set(id, name);
      await route.fulfill({ json: { id, name } });
      return;
    }
    const summary = Array.from(boardNames.entries()).map(([id, name]) => ({ id, name }));
    await route.fulfill({ json: summary });
  });

  await page.route("**/api/boards/*", async (route) => {
    const boardId = Number(pathParts(route.request().url())[3]);
    await route.fulfill({ json: boards.get(boardId) });
  });

  await page.route("**/api/boards/*/columns/*", async (route) => {
    const parts = pathParts(route.request().url());
    const board = boards.get(Number(parts[3]))!;
    const { title } = route.request().postDataJSON();
    const column = board.columns.find((c) => c.id === parts[5]);
    if (column) column.title = title;
    await route.fulfill({ json: board });
  });

  await page.route("**/api/boards/*/cards", async (route) => {
    const board = boards.get(Number(pathParts(route.request().url())[3]))!;
    const { column_id: columnId, title, details } = route.request().postDataJSON();
    const id = `card-${nextCardId++}`;
    board.cards[id] = { id, title, details };
    board.columns.find((c) => c.id === columnId)?.cardIds.push(id);
    await route.fulfill({ json: board });
  });

  await page.route("**/api/boards/*/cards/*/move", async (route) => {
    const parts = pathParts(route.request().url());
    const board = boards.get(Number(parts[3]))!;
    const cardId = parts[5];
    const { column_id: targetColumnId, position } = route.request().postDataJSON();
    for (const column of board.columns) {
      column.cardIds = column.cardIds.filter((id) => id !== cardId);
    }
    board.columns.find((c) => c.id === targetColumnId)?.cardIds.splice(position, 0, cardId);
    await route.fulfill({ json: board });
  });

  await page.route("**/api/boards/*/cards/*", async (route) => {
    const parts = pathParts(route.request().url());
    const board = boards.get(Number(parts[3]))!;
    const cardId = parts[5];
    const method = route.request().method();
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
