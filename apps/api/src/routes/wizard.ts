import { Router } from "express";
import { z } from "zod";
import type { WizardType } from "@prisma/client";
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
  interview_type: z.enum(["HR", "TECHNICAL", "MANAGERIAL"]),
});

router.post("/interview-wizard", requireAuth, async (req: AuthRequest, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  if (!(await canConsumeAttempt(req.userId!))) {
    res.status(402).json({ error: "Upgrade required", code: "FREEMIUM_LIMIT" });
    return;
  }

  const typeLabel =
    parse.data.interview_type === "HR"
      ? "HR / behavioral"
      : parse.data.interview_type === "TECHNICAL"
        ? "technical problem-solving and system design"
        : "managerial leadership and stakeholder";

  const system = `You are an interviewer. Return ONLY JSON {"questions": string[]} with exactly 10 ${typeLabel} interview questions.`;
  const raw = await groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: `Generate questions for a ${parse.data.interview_type} interview.` },
    ],
    true
  );
  let questions: string[];
  try {
    const p = JSON.parse(raw) as { questions?: string[] };
    questions = (p.questions ?? []).slice(0, 10);
    while (questions.length < 10) {
      questions.push(`Follow-up question ${questions.length + 1}?`);
    }
  } catch {
    res.status(500).json({ error: "Failed to generate questions" });
    return;
  }

  const session = await prisma.interviewWizardSession.create({
    data: {
      userId: req.userId!,
      interviewType: parse.data.interview_type as WizardType,
      status: "IN_PROGRESS",
      questions: questions as object,
    },
  });

  res.status(201).json({
    id: session.id,
    interview_type: session.interviewType,
    questions,
    status: session.status,
  });
});

router.get("/interview-wizard/:id", requireAuth, async (req: AuthRequest, res) => {
  const s = await prisma.interviewWizardSession.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { answers: { orderBy: { createdAt: "asc" } } },
  });
  if (!s) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(s);
});

const answerSchema = z.object({
  question: z.string(),
  user_answer: z.string().min(1),
});

router.post("/interview-wizard/:id/answer", requireAuth, async (req: AuthRequest, res) => {
  const parse = answerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const s = await prisma.interviewWizardSession.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!s) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (s.status === "COMPLETED") {
    res.status(400).json({ error: "Session completed" });
    return;
  }

  const evalSystem = `Evaluate answer. Return ONLY JSON {"score": number 0-100, "feedback": string}`;
  const evalRaw = await groqChat(
    [
      { role: "system", content: evalSystem },
      {
        role: "user",
        content: `Type: ${s.interviewType}\nQ: ${parse.data.question}\nA: ${parse.data.user_answer}`,
      },
    ],
    true
  );
  let score = 75;
  let feedback = "Nice answer.";
  try {
    const ev = JSON.parse(evalRaw) as { score?: number; feedback?: string };
    if (typeof ev.score === "number") score = Math.min(100, Math.max(0, Math.round(ev.score)));
    if (typeof ev.feedback === "string") feedback = ev.feedback;
  } catch {
    /* */
  }

  const ans = await prisma.wizardSessionAnswer.create({
    data: {
      sessionId: s.id,
      question: parse.data.question,
      userAnswer: parse.data.user_answer,
      aiFeedback: feedback,
      score,
    },
  });
  res.status(201).json(ans);
});

router.post("/interview-wizard/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  const s = await prisma.interviewWizardSession.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { answers: true },
  });
  if (!s) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (s.answers.length === 0) {
    res.status(400).json({ error: "Submit at least one answer" });
    return;
  }

  const avg = Math.round(s.answers.reduce((acc, a) => acc + (a.score ?? 0), 0) / s.answers.length);
  const summarySystem = `JSON only: {"summary": string, "strengths": string[], "improvements": string[]}`;
  const summaryUser = s.answers.map((a) => `Q:${a.question} S:${a.score} F:${a.aiFeedback}`).join("\n");
  const sumRaw = await groqChat(
    [
      { role: "system", content: summarySystem },
      { role: "user", content: summaryUser },
    ],
    true
  );
  let summary = "Good session.";
  let strengths: string[] = ["Communication"];
  let improvements: string[] = ["Depth"];
  try {
    const p = JSON.parse(sumRaw) as { summary?: string; strengths?: string[]; improvements?: string[] };
    if (p.summary) summary = p.summary;
    if (Array.isArray(p.strengths)) strengths = p.strengths;
    if (Array.isArray(p.improvements)) improvements = p.improvements;
  } catch {
    /* */
  }

  await prisma.interviewWizardSession.update({
    where: { id: s.id },
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
    id: s.id,
    status: "COMPLETED",
    overall_score: avg,
    summary_feedback: summary,
    strengths,
    improvements,
  });
});

export default router;
