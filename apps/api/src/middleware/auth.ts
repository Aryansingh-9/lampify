import type { NextFunction, Request, Response } from "express";
import { supabaseAnon } from "../lib/supabase.js";
import { prisma } from "../lib/prisma.js";
import type { Role, SubscriptionTier } from "@prisma/client";

export type AuthRequest = Request & {
  userId?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    subscriptionTier: SubscriptionTier;
    freeAttemptsRemaining: number;
  };
};

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: data.user.id },
  });

  if (!dbUser) {
    res.status(403).json({ error: "User not provisioned" });
    return;
  }

  req.userId = dbUser.id;
  req.user = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    subscriptionTier: dbUser.subscriptionTier,
    freeAttemptsRemaining: dbUser.freeAttemptsRemaining,
  };
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}
