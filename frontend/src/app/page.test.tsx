import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const boardsListResponse = () =>
  new Response(JSON.stringify([{ id: 1, name: "My Board" }]), { status: 200 });

const emptyBoardResponse = () =>
  new Response(JSON.stringify({ columns: [], cards: {} }), { status: 200 });

describe("Home (auth gate)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the login form when signed out", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 401 }));

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("falls back to the login form if checking the session fails outright", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("network error"));

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the board after signing in with correct credentials", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ username: "user" }), { status: 200 })
    );
    fetchMock.mockResolvedValueOnce(boardsListResponse());
    fetchMock.mockResolvedValueOnce(emptyBoardResponse());

    render(<Home />);
    await screen.findByRole("heading", { name: "Sign in" });

    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("returns to the login form after logging out", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ username: "user" }), { status: 200 })
    );
    fetchMock.mockResolvedValueOnce(boardsListResponse());
    fetchMock.mockResolvedValueOnce(emptyBoardResponse());
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    render(<Home />);
    await screen.findByRole("heading", { name: "Kanban Studio" });

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
