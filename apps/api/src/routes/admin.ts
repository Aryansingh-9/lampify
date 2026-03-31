import { Router } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { groqChat } from "../lib/groq.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/admin/batches", async (req: AuthRequest, res) => {
  const batches = await prisma.batch.findMany({
    where: { adminId: req.userId! },
    include: {
      enrollments: { include: { user: { select: { id: true, email: true, name: true, role: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(batches);
});

const batchSchema = z.object({
  name: z.string().min(1).max(200),
});

router.post("/admin/batches", async (req: AuthRequest, res) => {
  const parse = batchSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const b = await prisma.batch.create({
    data: { adminId: req.userId!, name: parse.data.name },
  });
  res.status(201).json(b);
});

const enrollSchema = z.object({
  user_id: z.string().uuid(),
});

router.post("/admin/batches/:id/enroll", async (req: AuthRequest, res) => {
  const parse = enrollSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const batch = await prisma.batch.findFirst({
    where: { id: req.params.id, adminId: req.userId! },
  });
  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: parse.data.user_id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const e = await prisma.batchEnrollment.upsert({
    where: {
      batchId_userId: { batchId: batch.id, userId: user.id },
    },
    create: { batchId: batch.id, userId: user.id },
    update: {},
  });
  res.status(201).json(e);
});

router.get("/admin/students", async (req: AuthRequest, res) => {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      email: true,
      name: true,
      subscriptionTier: true,
      freeAttemptsRemaining: true,
      createdAt: true,
      pathwayProgress: { select: { pathwayId: true, progressPercent: true } },
      batchEnrollments: { include: { batch: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(students);
});

router.get("/admin/pathways", async (req: AuthRequest, res) => {
  const list = await prisma.pathway.findMany({
    where: { adminId: req.userId! },
    include: { modules: { orderBy: { sortOrder: "asc" }, include: { assessments: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(list);
});

const pathwaySchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  publish: z.boolean().optional(),
});

router.post("/admin/pathways", async (req: AuthRequest, res) => {
  const parse = pathwaySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  const pathway = await prisma.pathway.create({
    data: {
      adminId: req.userId!,
      name: parse.data.name,
      domain: parse.data.domain,
      status: parse.data.publish ? "PUBLISHED" : "DRAFT",
    },
  });

  const system = `You design learning pathways. Return ONLY JSON {"modules": [{"name": string, "content": string, "assessment": {"questions": {"prompt": string, "choices": string[], "correctIndex": number}[], "passing_score": number}}]}`;
  const userPrompt = `Create 4 modules for the pathway "${parse.data.name}" in domain "${parse.data.domain}". Each module: 200-400 word content teaching core ideas, plus a short quiz (3 multiple-choice questions). passing_score is 60-80.`;
  const raw = await groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    true
  );

  type Mod = {
    name: string;
    content: string;
    assessment?: { questions?: unknown[]; passing_score?: number };
  };
  let modules: Mod[] = [];
  try {
    const p = JSON.parse(raw) as { modules?: Mod[] };
    modules = p.modules ?? [];
  } catch {
    modules = [
      {
        name: `${parse.data.name} — Foundations`,
        content: `Introduction to ${parse.data.domain}. Key concepts and vocabulary.`,
        assessment: {
          questions: [
            { prompt: "What is the primary focus?", choices: ["A", "B", "C", "D"], correctIndex: 0 },
          ],
          passing_score: 70,
        },
      },
    ];
  }

  let order = 0;
  for (const m of modules.slice(0, 8)) {
    const mod = await prisma.pathwayModule.create({
      data: {
        pathwayId: pathway.id,
        name: m.name,
        content: m.content,
        sortOrder: order++,
      },
    });
    const qs = m.assessment?.questions ?? [];
    const passing = m.assessment?.passing_score ?? 70;
    await prisma.pathwayAssessment.create({
      data: {
        moduleId: mod.id,
        questions: qs as object,
        passingScore: passing,
      },
    });
  }

  const full = await prisma.pathway.findUnique({
    where: { id: pathway.id },
    include: { modules: { orderBy: { sortOrder: "asc" }, include: { assessments: true } } },
  });
  res.status(201).json(full);
});

const assignSchema = z.object({
  user_id: z.string().uuid(),
  pathway_id: z.string().uuid(),
});

router.post("/admin/assign-pathway", async (req: AuthRequest, res) => {
  const parse = assignSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const pathway = await prisma.pathway.findFirst({
    where: { id: parse.data.pathway_id, adminId: req.userId! },
  });
  if (!pathway) {
    res.status(404).json({ error: "Pathway not found" });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: parse.data.user_id } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const prog = await prisma.userPathwayProgress.upsert({
    where: {
      userId_pathwayId: { userId: target.id, pathwayId: pathway.id },
    },
    create: {
      userId: target.id,
      pathwayId: pathway.id,
      progressPercent: 0,
      completedModules: [] as object,
    },
    update: {},
  });
  res.json(prog);
});

router.get("/admin/analytics", async (req: AuthRequest, res) => {
  const [students, paid, interviews, wizardSessions, pathways] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { subscriptionTier: { not: "FREE" } } }),
    prisma.mockInterview.count(),
    prisma.interviewWizardSession.count(),
    prisma.pathway.count({ where: { adminId: req.userId! } }),
  ]);
  const revenue = await prisma.payment.aggregate({
    where: { status: "PAID" },
    _sum: { amount: true },
  });
  res.json({
    students,
    paid_subscribers: paid,
    mock_interviews: interviews,
    wizard_sessions: wizardSessions,
    admin_pathways: pathways,
    revenue_paise: revenue._sum.amount ?? 0,
  });
});

export default router;
