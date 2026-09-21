import { expect, test, type Page } from "@playwright/test";
import { mockBoardApi } from "./support/mockBoardApi";

const mockAuth = async (page: Page) => {
  await mockBoardApi(page);
  let authenticated = false;

  await page.route("**/api/me", (route) =>
    route.fulfill(
      authenticated
        ? { json: { username: "user" } }
        : { status: 401, json: { detail: "Not authenticated" } }
    )
  );

  await page.route("**/api/login", async (route) => {
    const body = route.request().postDataJSON();
    if (body.username === "user" && body.password === "password") {
      authenticated = true;
      await route.fulfill({ json: { username: "user" } });
    } else {
      await route.fulfill({ status: 401, json: { detail: "Invalid credentials" } });
    }
  });

  await page.route("**/api/logout", async (route) => {
    authenticated = false;
    await route.fulfill({ json: { status: "ok" } });
  });
};

test("shows the login form when signed out, then reveals the board on sign in", async ({
  page,
}) => {
  await mockAuth(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
});

test("rejects the wrong password", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");

  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/invalid username or password/i)).toBeVisible();
});

test("logout returns to the login form", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");

  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

  await page.getByRole("button", { name: /log out/i }).click();

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
