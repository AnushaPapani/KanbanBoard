import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/LoginForm";
import * as auth from "@/lib/auth";

vi.mock("@/lib/auth");

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in by default", async () => {
    vi.mocked(auth.login).mockResolvedValue({ username: "user" });
    const onSuccess = vi.fn();

    render(<LoginForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(auth.login).toHaveBeenCalledWith("user", "password");
    expect(auth.signup).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith("user");
  });

  it("switches to sign-up mode and calls signup instead", async () => {
    vi.mocked(auth.signup).mockResolvedValue({ username: "newperson" });
    const onSuccess = vi.fn();

    render(<LoginForm onSuccess={onSuccess} />);
    await userEvent.click(screen.getByRole("button", { name: "Switch to sign up" }));
    expect(screen.getByRole("heading", { name: "Create an account" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Username"), "newperson");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(auth.signup).toHaveBeenCalledWith("newperson", "hunter2");
    expect(auth.login).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith("newperson");
  });

  it("shows the server's error message when signup fails", async () => {
    vi.mocked(auth.signup).mockRejectedValue(new Error("Username is already taken"));

    render(<LoginForm onSuccess={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Switch to sign up" }));
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "whatever");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Username is already taken")).toBeInTheDocument();
  });
});
