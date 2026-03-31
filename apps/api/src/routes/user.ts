import { Router } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/profile", requireAuth, async (req: AuthRequest, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!u) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    subscription_tier: u.subscriptionTier,
    free_attempts_remaining: u.freeAttemptsRemaining,
  });
});

const profileUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

router.put("/profile", requireAuth, async (req: AuthRequest, res) => {
  const parse = profileUpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const u = await prisma.user.update({
    where: { id: req.userId! },
    data: parse.data,
  });
  res.json({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    subscription_tier: u.subscriptionTier,
    free_attempts_remaining: u.freeAttemptsRemaining,
  });
});

router.get("/resumes", requireAuth, async (req: AuthRequest, res) => {
  const list = await prisma.resume.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: "desc" },
  });
  res.json(list);
});

const resumeSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

router.post("/resumes", requireAuth, async (req: AuthRequest, res) => {
  const parse = resumeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const r = await prisma.resume.create({
    data: { userId: req.userId!, ...parse.data },
  });
  res.status(201).json(r);
});

export default router;
