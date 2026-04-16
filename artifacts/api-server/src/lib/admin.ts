export function isDebugUser(name?: string | null): boolean {
  const isDev = process.env.NODE_ENV === "development";
  const normalized = String(name || "").trim().toLowerCase();
  return isDev && normalized === "test_user";
}

