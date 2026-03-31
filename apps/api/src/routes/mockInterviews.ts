import { Router } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { groqChat } from "../lib/groq.js";

const router = Router();

async function canConsumeAttempt(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return false;
  if (u.subscriptionTier !== "FREE") return true;
  return u.freeAttemptsRemaining > 0;
}

async function consumeAttempt(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.subscriptionTier !== "FREE") return;
  await prisma.user.update({
    where: { id: userId },
    data: { freeAttemptsRemaining: Math.max(0, u.freeAttemptsRemaining - 1) },
  });
}

const createSchema = z.object({
  job_role: z.string().min(1),
  jd: z.string().min(10),
  resume_content: z.string().min(10),
  company: z.string().optional(),
});

router.post("/mock-interviews", requireAuth, async (req: AuthRequest, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  if (!(await canConsumeAttempt(req.userId!))) {
    res.status(402).json({ error: "Upgrade required", code: "FREEMIUM_LIMIT" });
    return;
  }

  const attemptCount = await prisma.mockInterview.count({ where: { userId: req.userId! } });
  const system = `You are an expert interviewer. Return ONLY valid JSON: {"questions": string[] } with exactly 10 tailored interview questions as strings, based on job description and resume. Mix behavioral and role-specific.`;
  const user = `Job role: ${parse.data.job_role}\nCompany: ${parse.data.company ?? "N/A"}\nJD:\n${parse.data.jd}\n\nResume:\n${parse.data.resume_content}`;
  const raw = await groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    true
  );
  let questions: string[];
  try {
    const parsed = JSON.parse(raw) as { questions?: string[] };
    questions = parsed.questions ?? [];
    if (!Array.isArray(questions) || questions.length < 10) {
      const lines = raw
        .split("\n")
        .map((l) => l.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean);
      questions = lines.slice(0, 10);
    }
    questions = questions.slice(0, 10);
    while (questions.length < 10) {
      questions.push(`Additional question ${questions.length + 1} for this role?`);
    }
  } catch {
    res.status(500).json({ error: "Failed to generate questions" });
    return;
  }

  const mi = await prisma.mockInterview.create({
    data: {
      userId: req.userId!,
      jobRole: parse.data.job_role,
      jd: parse.data.jd,
      company: parse.data.company,
      status: "IN_PROGRESS",
      attemptNumber: attemptCount + 1,
      questions: questions as unknown as object,
    },
  });

  res.status(201).json({
    id: mi.id,
    questions,
    status: mi.status,
    attempt_number: mi.attemptNumber,
  });
});

router.get("/mock-interviews", requireAuth, async (req: AuthRequest, res) => {
  const list = await prisma.mockInterview.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      jobRole: true,
      company: true,
      status: true,
      attemptNumber: true,
      overallScore: true,
      createdAt: true,
    },
  });
  res.json(list);
});

router.get("/mock-interviews/:id", requireAuth, async (req: AuthRequest, res) => {
  const mi = await prisma.mockInterview.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { answers: { orderBy: { createdAt: "asc" } } },
  });
  if (!mi) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(mi);
});

const answerSchema = z.object({
  question: z.string(),
  user_answer: z.string().min(1),
});

router.post("/mock-interviews/:id/answer", requireAuth, async (req: AuthRequest, res) => {
  const parse = answerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const mi = await prisma.mockInterview.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!mi) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (mi.status === "COMPLETED") {
    res.status(400).json({ error: "Interview already completed" });
    return;
  }

  const evalSystem = `You evaluate interview answers. Return ONLY JSON: {"score": number 0-100, "feedback": string concise}`;
  const evalUser = `Question: ${parse.data.question}\nCandidate answer:\n${parse.data.user_answer}`;
  const evalRaw = await groqChat(
    [
      { role: "system", content: evalSystem },
      { role: "user", content: evalUser },
    ],
    true
  );
  let score = 70;
  let feedback = "Good effort.";
  try {
    const ev = JSON.parse(evalRaw) as { score?: number; feedback?: string };
    if (typeof ev.score === "number") score = Math.min(100, Math.max(0, Math.round(ev.score)));
    if (typeof ev.feedback === "string") feedback = ev.feedback;
  } catch {
    /* use defaults */
  }

  const ans = await prisma.mockInterviewAnswer.create({
    data: {
      mockInterviewId: mi.id,
      question: parse.data.question,
      userAnswer: parse.data.user_answer,
      aiFeedback: feedback,
      score,
    },
  });
  res.status(201).json(ans);
});

router.post("/mock-interviews/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  const mi = await prisma.mockInterview.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { answers: true },
  });
  if (!mi) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (mi.answers.length === 0) {
    res.status(400).json({ error: "Submit at least one answer" });
    return;
  }

  const avg = Math.round(mi.answers.reduce((s, a) => s + (a.score ?? 0), 0) / mi.answers.length);
  const summarySystem = `Summarize interview performance in JSON only: {"summary": string, "strengths": string[], "improvements": string[]}`;
  const summaryUser = `Questions and feedback:\n${mi.answers.map((a) => `Q: ${a.question}\nScore: ${a.score}\nFB: ${a.aiFeedback}`).join("\n---\n")}`;
  const sumRaw = await groqChat(
    [
      { role: "system", content: summarySystem },
      { role: "user", content: summaryUser },
    ],
    true
  );
  let summary = "Solid performance overall.";
  let strengths: string[] = ["Clarity"];
  let improvements: string[] = ["Add more metrics"];
  try {
    const s = JSON.parse(sumRaw) as { summary?: string; strengths?: string[]; improvements?: string[] };
    if (s.summary) summary = s.summary;
    if (Array.isArray(s.strengths)) strengths = s.strengths;
    if (Array.isArray(s.improvements)) improvements = s.improvements;
  } catch {
    /* defaults */
  }

  await prisma.mockInterview.update({
    where: { id: mi.id },
    data: {
      status: "COMPLETED",
      overallScore: avg,
      summaryFeedback: summary,
      strengths: strengths as object,
      improvements: improvements as object,
    },
  });

  await consumeAttempt(req.userId!);

  res.json({
    id: mi.id,
    status: "COMPLETED",
    overall_score: avg,
    summary_feedback: summary,
    strengths,
    improvements,
  });
});

router.get("/mock-interviews/:id/feedback", requireAuth, async (req: AuthRequest, res) => {
  const mi = await prisma.mockInterview.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { answers: { orderBy: { createdAt: "asc" } } },
  });
  if (!mi) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: mi.id,
    status: mi.status,
    overall_score: mi.overallScore,
    summary_feedback: mi.summaryFeedback,
    strengths: mi.strengths,
    improvements: mi.improvements,
    answers: mi.answers,
  });
});

export default router;
