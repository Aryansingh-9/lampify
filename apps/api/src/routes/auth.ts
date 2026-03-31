import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdmin, supabaseAnon } from "../lib/supabase.js";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(200),
});

router.post("/signup", async (req, res) => {
  const parse = signupSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const { email, password, name } = parse.data;

  const admin = getSupabaseAdmin();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createErr || !created.user) {
    res.status(400).json({ error: createErr?.message ?? "Signup failed" });
    return;
  }

  await prisma.user.upsert({
    where: { id: created.user.id },
    create: {
      id: created.user.id,
      email,
      name,
      role: "STUDENT",
      subscriptionTier: "FREE",
      freeAttemptsRemaining: 5,
    },
    update: { email, name },
  });

  const { data: session, error: signErr } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (signErr || !session.session) {
    res.status(201).json({
      message: "Account created; sign in required",
      userId: created.user.id,
    });
    return;
  }

  res.status(201).json({
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    expires_at: session.session.expires_at,
    user: {
      id: created.user.id,
      email,
      name,
    },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword(parse.data);
  if (error || !data.session) {
    res.status(401).json({ error: error?.message ?? "Invalid credentials" });
    return;
  }

  const userRow = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!userRow) {
    await prisma.user.create({
      data: {
        id: data.user.id,
        email: data.user.email ?? parse.data.email,
        name: data.user.user_metadata?.name ?? null,
        role: "STUDENT",
        freeAttemptsRemaining: 5,
      },
    });
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: userRow?.name ?? data.user.user_metadata?.name,
      role: userRow?.role ?? "STUDENT",
    },
  });
});

router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    await supabaseAnon.auth.signOut();
  }
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

export default router;
