export type Session = { username: string };

const parseJsonOrThrow = async (response: Response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "Request failed");
  }
  return response.json();
};

export const getMe = async (): Promise<Session | null> => {
  const response = await fetch("/api/me", { credentials: "include" });
  if (response.status === 401) return null;
  return parseJsonOrThrow(response);
};

export const login = async (username: string, password: string): Promise<Session> => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  return parseJsonOrThrow(response);
};

export const logout = async (): Promise<void> => {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
};
