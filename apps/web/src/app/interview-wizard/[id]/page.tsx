"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";

type Session = {
  id: string;
  status: string;
  interviewType: string;
  questions: unknown;
  answers: { question: string; userAnswer: string; aiFeedback: string | null; score: number | null }[];
  overallScore: number | null;
  summaryFeedback: string | null;
  strengths: unknown;
  improvements: unknown;
};

export default function InterviewWizardSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [session, setSession] = useState<Session | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<Session>(`/interview-wizard/${id}`, { method: "GET" });
    setSession(data);
  }, [id]);

  useEffect(() => {
    void load().catch(() => router.replace("/interview-wizard"));
  }, [load, router]);

  useEffect(() => {
    if (session?.status === "COMPLETED") {
      /* stay on page to show feedback tabs */
    }
  }, [session?.status]);

  const questions: string[] = (() => {
    const q = session?.questions;
    if (Array.isArray(q)) return q as string[];
    if (typeof q === "string") {
      try {
        return JSON.parse(q) as string[];
      } catch {
        return [];
      }
    }
    return [];
  })();

  async function submitAnswer() {
    if (!session || !questions[idx] || !answer.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/interview-wizard/${id}/answer`, {
        method: "POST",
        json: { question: questions[idx], user_answer: answer },
      });
      setAnswer("");
      if (idx + 1 >= questions.length) {
        await apiFetch(`/interview-wizard/${id}/complete`, { method: "POST" });
        await load();
      } else {
        setIdx((i) => i + 1);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return (
      <RequireAuth>
        <SiteHeader />
        <div className="p-10 text-center text-muted-foreground">Loading…</div>
      </RequireAuth>
    );
  }

  if (session.status === "COMPLETED") {
    const strengths = Array.isArray(session.strengths) ? (session.strengths as string[]) : [];
    const improvements = Array.isArray(session.improvements) ? (session.improvements as string[]) : [];
    return (
      <RequireAuth>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="mb-6 flex justify-between items-center gap-4">
            <h1 className="text-3xl font-bold">Wizard complete</h1>
            <Badge className="text-lg px-3 py-1">{session.overallScore ?? "—"}</Badge>
          </div>
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="detail">Questions</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {session.summaryFeedback}
                </CardContent>
              </Card>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Improvements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {improvements.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="detail" className="space-y-3">
              {session.answers.map((a, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex justify-between gap-2">
                      <CardTitle className="text-base font-medium">{a.question}</CardTitle>
                      {a.score != null && <Badge>{a.score}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p className="whitespace-pre-wrap">{a.userAnswer}</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{a.aiFeedback}</p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
          <Button asChild className="mt-6" variant="outline">
            <Link href="/interview-wizard">Done</Link>
          </Button>
        </main>
      </RequireAuth>
    );
  }

  const currentQ = questions[idx] ?? "";

  return (
    <RequireAuth>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex flex-wrap justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Interview Wizard</h1>
            <p className="text-sm text-muted-foreground">
              {session.interviewType} · Question {idx + 1} of {questions.length}
            </p>
          </div>
          <Badge variant="outline">{session.status}</Badge>
        </div>
        <Progress value={questions.length ? ((idx + 1) / questions.length) * 100 : 0} className="mb-6 h-2" />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg leading-relaxed">{currentQ}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={8} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" />
            <div className="flex gap-2">
              <Button onClick={() => void submitAnswer()} disabled={saving || !answer.trim()}>
                {saving ? "Saving…" : idx + 1 >= questions.length ? "Submit & finish" : "Next"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/interview-wizard">Exit</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </RequireAuth>
  );
}
