import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { SessionContext } from "@/lib/SessionContext";
import type { BoardData } from "@/lib/kanban";

// Auto-mocking @/lib/api would also replace the ApiError class, breaking
// `instanceof ApiError` checks (e.g. isSessionExpired) with a different
// class reference. Keep the real exports and only mock the functions.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchBoard: vi.fn(),
  renameColumn: vi.fn(),
  addCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
  moveCard: vi.fn(),
}));

const BOARD_ID = 1;

const seedBoard = (): BoardData => ({
  columns: [
    { id: "col-a", title: "Backlog", cardIds: ["card-1"] },
    { id: "col-b", title: "Done", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Existing card", details: "Notes" },
  },
});

const getFirstColumn = async () => (await screen.findAllByTestId(/column-/i))[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.mocked(api.fetchBoard).mockResolvedValue(seedBoard());
  });

  it("loads and renders the board's columns", async () => {
    render(<KanbanBoard boardId={BOARD_ID} />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(2);
    expect(api.fetchBoard).toHaveBeenCalledWith(BOARD_ID);
  });

  it("pluralizes the card count correctly", async () => {
    render(<KanbanBoard boardId={BOARD_ID} />);
    const columns = await screen.findAllByTestId(/column-/i);
    expect(within(columns[0]).getByText("1 card")).toBeInTheDocument();
    expect(within(columns[1]).getByText("0 cards")).toBeInTheDocument();
  });

  it("renames a column on blur", async () => {
    const base = seedBoard();
    const renamed: BoardData = {
      ...base,
      columns: [{ ...base.columns[0], title: "New Name" }, base.columns[1]],
    };
    vi.mocked(api.renameColumn).mockResolvedValue(renamed);

    render(<KanbanBoard boardId={BOARD_ID} />);
    const column = await getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.tab();

    await waitFor(() =>
      expect(api.renameColumn).toHaveBeenCalledWith(BOARD_ID, "col-a", "New Name")
    );
    expect(await within(column).findByDisplayValue("New Name")).toBeInTheDocument();
  });

  it("adds and removes a card", async () => {
    const base = seedBoard();
    const withNewCard: BoardData = {
      columns: [
        { id: "col-a", title: "Backlog", cardIds: ["card-1", "card-2"] },
        base.columns[1],
      ],
      cards: {
        ...base.cards,
        "card-2": { id: "card-2", title: "New card", details: "Notes" },
      },
    };
    vi.mocked(api.addCard).mockResolvedValue(withNewCard);
    vi.mocked(api.deleteCard).mockResolvedValue(base);

    render(<KanbanBoard boardId={BOARD_ID} />);
    const column = await getFirstColumn();

    const addButton = within(column).getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(await within(column).findByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    await waitFor(() =>
      expect(within(column).queryByText("New card")).not.toBeInTheDocument()
    );
  });

  it("edits a card", async () => {
    const base = seedBoard();
    const updated: BoardData = {
      ...base,
      cards: {
        "card-1": { id: "card-1", title: "Updated title", details: "Updated notes" },
      },
    };
    vi.mocked(api.updateCard).mockResolvedValue(updated);

    render(<KanbanBoard boardId={BOARD_ID} />);
    const column = await getFirstColumn();

    await userEvent.click(
      within(column).getByRole("button", { name: /edit existing card/i })
    );

    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated title");
    await userEvent.click(within(column).getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(api.updateCard).toHaveBeenCalledWith(BOARD_ID, "card-1", "Updated title", "Notes")
    );
    expect(await within(column).findByText("Updated title")).toBeInTheDocument();
  });

  it("signals session expiry on a 401 instead of showing the generic error state", async () => {
    vi.mocked(api.fetchBoard).mockRejectedValue(new ApiError(401, "Not authenticated"));
    const notifyUnauthorized = vi.fn();

    render(
      <SessionContext.Provider value={{ notifyUnauthorized }}>
        <KanbanBoard boardId={BOARD_ID} />
      </SessionContext.Provider>
    );

    await waitFor(() => expect(notifyUnauthorized).toHaveBeenCalled());
    expect(screen.queryByText(/could not load the board/i)).not.toBeInTheDocument();
  });
});
