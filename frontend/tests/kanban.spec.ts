import { expect, test } from "@playwright/test";
import { mockBoardApi } from "./support/mockBoardApi";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { username: "user" } })
  );
  await mockBoardApi(page);
});

test("loads the kanban board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await page.goto("/");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("edits a card", async ({ page }) => {
  await page.goto("/");
  const card = page.getByTestId("card-card-1");
  await card.getByRole("button", { name: /edit align roadmap themes/i }).click();
  await card.getByLabel("Card title").fill("Updated via e2e");
  await card.getByRole("button", { name: /save/i }).click();
  await expect(page.getByText("Updated via e2e")).toBeVisible();
});

test("chat sidebar moves a card and updates the board without a reload", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      json: {
        reply: "Moved it to Done!",
        board: {
          columns: [
            { id: "col-backlog", title: "Backlog", cardIds: ["card-2"] },
            { id: "col-discovery", title: "Discovery", cardIds: [] },
            { id: "col-progress", title: "In Progress", cardIds: [] },
            { id: "col-review", title: "Review", cardIds: [] },
            { id: "col-done", title: "Done", cardIds: ["card-1"] },
          ],
          cards: {
            "card-1": { id: "card-1", title: "Align roadmap themes", details: "Notes" },
            "card-2": { id: "card-2", title: "Gather customer signals", details: "Notes" },
          },
        },
      },
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("Ask the assistant...").fill("Move Align roadmap themes to Done");
  await page.getByRole("button", { name: /send/i }).click();

  await expect(page.getByText("Moved it to Done!")).toBeVisible();
  await expect(page.getByTestId("column-col-done").getByTestId("card-card-1")).toBeVisible();
  await expect(page.getByTestId("column-col-backlog").getByTestId("card-card-1")).toHaveCount(0);
});

test("moves a card between columns", async ({ page }) => {
  await page.goto("/");
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});
