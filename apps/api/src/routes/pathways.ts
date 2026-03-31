import { Router } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/pathways", requireAuth, async (req: AuthRequest, res) => {
  const published = await prisma.pathway.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    include: {
      modules: { orderBy: { sortOrder: "asc" }, include: { assessments: true } },
    },
  });
  res.json(published);
});

router.get("/pathways/:id", requireAuth, async (req: AuthRequest, res) => {
  const p = await prisma.pathway.findFirst({
    where: { id: req.params.id, status: "PUBLISHED" },
    include: {
      modules: { orderBy: { sortOrder: "asc" }, include: { assessments: true } },
    },
  });
  if (!p) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(p);
});

router.get("/pathways/:id/progress", requireAuth, async (req: AuthRequest, res) => {
  const pathway = await prisma.pathway.findFirst({
    where: { id: req.params.id },
    include: { modules: true },
  });
  if (!pathway) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const progress = await prisma.userPathwayProgress.upsert({
    where: {
      userId_pathwayId: { userId: req.userId!, pathwayId: pathway.id },
    },
    create: {
      userId: req.userId!,
      pathwayId: pathway.id,
      progressPercent: 0,
      completedModules: [] as object,
    },
    update: {},
  });
  const moduleCount = pathway.modules.length || 1;
  const completed = (progress.completedModules as string[] | null)?.length ?? 0;
  const pct = Math.min(100, Math.round((completed / moduleCount) * 100));

  if (pct !== progress.progressPercent) {
    await prisma.userPathwayProgress.update({
      where: { id: progress.id },
      data: { progressPercent: pct },
    });
  }

  res.json({
    pathway_id: pathway.id,
    progress_percent: pct,
    completed_modules: progress.completedModules,
    total_modules: moduleCount,
  });
});

router.post("/pathways/:id/progress", requireAuth, async (req: AuthRequest, res) => {
  const { module_id } = req.body as { module_id?: string };
  if (!module_id || typeof module_id !== "string") {
    res.status(400).json({ error: "module_id required" });
    return;
  }
  const pathway = await prisma.pathway.findFirst({
    where: { id: req.params.id },
    include: { modules: true },
  });
  if (!pathway) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const mod = pathway.modules.find((m) => m.id === module_id);
  if (!mod) {
    res.status(404).json({ error: "Module not in pathway" });
    return;
  }

  const progress = await prisma.userPathwayProgress.upsert({
    where: {
      userId_pathwayId: { userId: req.userId!, pathwayId: pathway.id },
    },
    create: {
      userId: req.userId!,
      pathwayId: pathway.id,
      progressPercent: 0,
      completedModules: [module_id] as object,
    },
    update: {},
  });

  const done = new Set((progress.completedModules as string[] | null) ?? []);
  done.add(module_id);
  const moduleCount = pathway.modules.length || 1;
  const pct = Math.min(100, Math.round((done.size / moduleCount) * 100));

  const updated = await prisma.userPathwayProgress.update({
    where: { id: progress.id },
    data: {
      completedModules: [...done] as object,
      progressPercent: pct,
    },
  });

  res.json({
    pathway_id: pathway.id,
    progress_percent: updated.progressPercent,
    completed_modules: updated.completedModules,
  });
});

export default router;
