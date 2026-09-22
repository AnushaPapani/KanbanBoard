import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "@/components/Workspace";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { SessionContext } from "@/lib/SessionContext";
import type { BoardData } from "@/lib/kanban";

// Auto-mocking @/lib/api would also replace the ApiError class, breaking
// `instanceof ApiError` checks (e.g. isSessionExpired) with a different
// class reference. Keep the real exports and only mock the functions.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listBoards: vi.fn(),
  createBoard: vi.fn(),
  fetchBoard: vi.fn(),
}));

const board = (title: string): BoardData => ({
  columns: [{ id: `col-${title}`, title, cardIds: [] }],
  cards: {},
});

describe("Workspace", () => {
  beforeEach(() => {
    vi.mocked(api.listBoards).mockResolvedValue([
      { id: 1, name: "My Board" },
      { id: 2, name: "Marketing" },
    ]);
    vi.mocked(api.fetchBoard).mockImplementation((boardId) =>
      Promise.resolve(boardId === 1 ? board("Backlog") : board("Ideas"))
    );
  });

  it("loads boards and shows the first board by default", async () => {
    render(<Workspace onLogout={vi.fn()} />);

    expect(await screen.findByDisplayValue("Backlog")).toBeInTheDocument();
    expect(api.fetchBoard).toHaveBeenCalledWith(1);
  });

  it("switches boards via the selector", async () => {
    render(<Workspace onLogout={vi.fn()} />);
    await screen.findByDisplayValue("Backlog");

    await userEvent.selectOptions(screen.getByLabelText("Select board"), "2");

    expect(await screen.findByDisplayValue("Ideas")).toBeInTheDocument();
    expect(api.fetchBoard).toHaveBeenCalledWith(2);
  });

  it("creates a new board and switches to it", async () => {
    vi.mocked(api.createBoard).mockResolvedValue({ id: 3, name: "Launch plan" });
    vi.mocked(api.fetchBoard).mockImplementation((boardId) => {
      if (boardId === 3) return Promise.resolve(board("New column"));
      return Promise.resolve(boardId === 1 ? board("Backlog") : board("Ideas"));
    });

    render(<Workspace onLogout={vi.fn()} />);
    await screen.findByDisplayValue("Backlog");

    await userEvent.click(screen.getByRole("button", { name: "+ New board" }));
    await userEvent.type(screen.getByLabelText("New board name"), "Launch plan");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(api.createBoard).toHaveBeenCalledWith("Launch plan");
    await waitFor(() => expect(api.fetchBoard).toHaveBeenCalledWith(3));
    expect(await screen.findByDisplayValue("New column")).toBeInTheDocument();
  });

  it("signals session expiry on a 401 while loading the board list", async () => {
    vi.mocked(api.listBoards).mockRejectedValue(new ApiError(401, "Not authenticated"));
    const notifyUnauthorized = vi.fn();

    render(
      <SessionContext.Provider value={{ notifyUnauthorized }}>
        <Workspace onLogout={vi.fn()} />
      </SessionContext.Provider>
    );

    await waitFor(() => expect(notifyUnauthorized).toHaveBeenCalled());
    expect(screen.queryByText(/could not load your boards/i)).not.toBeInTheDocument();
  });

  it("signals session expiry on a 401 when creating a board", async () => {
    vi.mocked(api.createBoard).mockRejectedValue(new ApiError(401, "Not authenticated"));
    const notifyUnauthorized = vi.fn();

    render(
      <SessionContext.Provider value={{ notifyUnauthorized }}>
        <Workspace onLogout={vi.fn()} />
      </SessionContext.Provider>
    );
    await screen.findByDisplayValue("Backlog");

    await userEvent.click(screen.getByRole("button", { name: "+ New board" }));
    await userEvent.type(screen.getByLabelText("New board name"), "Launch plan");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(notifyUnauthorized).toHaveBeenCalled());
  });
});
