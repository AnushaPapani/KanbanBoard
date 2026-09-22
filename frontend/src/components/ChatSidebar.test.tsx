import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatSidebar } from "@/components/ChatSidebar";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

vi.mock("@/lib/api");

describe("ChatSidebar", () => {
  it("renders nothing when closed", () => {
    render(<ChatSidebar isOpen={false} onClose={vi.fn()} onBoardUpdate={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/ask the assistant/i)).not.toBeInTheDocument();
  });

  it("sends a message, shows the reply, and reports the updated board", async () => {
    const updatedBoard: BoardData = {
      columns: [{ id: "col-done", title: "Done", cardIds: ["card-1"] }],
      cards: { "card-1": { id: "card-1", title: "Ship MVP", details: "" } },
    };
    vi.mocked(api.sendChatMessage).mockResolvedValue({
      reply: "Moved it to Done!",
      board: updatedBoard,
    });
    const onBoardUpdate = vi.fn();

    render(<ChatSidebar isOpen onClose={vi.fn()} onBoardUpdate={onBoardUpdate} />);

    const input = screen.getByPlaceholderText(/ask the assistant/i);
    await userEvent.type(input, "Move Ship MVP to Done");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Moved it to Done!")).toBeInTheDocument();
    expect(api.sendChatMessage).toHaveBeenCalledWith("Move Ship MVP to Done");
    expect(onBoardUpdate).toHaveBeenCalledWith(updatedBoard);
  });

  it("shows an error and does not update the board if the request fails", async () => {
    vi.mocked(api.sendChatMessage).mockRejectedValue(new Error("boom"));
    const onBoardUpdate = vi.fn();

    render(<ChatSidebar isOpen onClose={vi.fn()} onBoardUpdate={onBoardUpdate} />);

    await userEvent.type(screen.getByPlaceholderText(/ask the assistant/i), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(<ChatSidebar isOpen onClose={onClose} onBoardUpdate={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /close assistant/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
