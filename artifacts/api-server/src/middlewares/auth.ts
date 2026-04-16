import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { authTokensTable, charactersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { isDebugUser } from "../lib/admin.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; isAdmin?: boolean; isDebugUser?: boolean; username?: string | null };
    }
  }
}

export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Yetkilendirme gereklidir" });
    return;
  }

  const token = authHeader.slice(7);
  if (!token) {
    res.status(401).json({ error: "Geçersiz token" });
    return;
  }

  try {
    const [auth] = await db
      .select()
      .from(authTokensTable)
      .where(eq(authTokensTable.token, token));

    if (!auth) {
      res.status(401).json({ error: "Geçersiz veya süresi dolmuş token" });
      return;
    }

    const [char] = await db
      .select({ name: charactersTable.name })
      .from(charactersTable)
      .where(eq(charactersTable.userId, auth.userId));

    req.user = {
      id: auth.userId,
      username: char?.name ?? null,
      isAdmin: isDebugUser(char?.name),
      isDebugUser: isDebugUser(char?.name),
    };
    next();
  } catch {
    res.status(500).json({ error: "Yetkilendirme hatası" });
  }
}
