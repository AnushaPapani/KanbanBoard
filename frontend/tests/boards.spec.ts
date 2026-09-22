import { expect, test } from "@playwright/test";
import { mockBoardApi } from "./support/mockBoardApi";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({ json: { username: "user" } }));
  await mockBoardApi(page);
});

test("creates a new board and switches to it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("column-col-backlog")).toBeVisible();

  await page.getByRole("button", { name: "+ New board" }).click();
  await page.getByLabel("New board name").fill("Marketing Launch");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByLabel("Select board")).toHaveValue(/\d+/);
  await expect(page.getByText("Drop a card here").first()).toBeVisible();
  // The new board is a distinct, empty board — the original board's seeded card isn't here.
  await expect(page.getByTestId("card-card-1")).toHaveCount(0);
});

test("switches back to an existing board and its cards are still there", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("card-card-1")).toBeVisible();

  await page.getByRole("button", { name: "+ New board" }).click();
  await page.getByLabel("New board name").fill("Second board");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByTestId("card-card-1")).toHaveCount(0);

  await page.getByLabel("Select board").selectOption({ label: "My Board" });
  await expect(page.getByTestId("card-card-1")).toBeVisible();
});
