"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";

type Feedback = {
  id: string;
  status: string;
  overall_score: number | null;
  summary_feedback: string | null;
  strengths: string[] | null;
  improvements: string[] | null;
  answers: { question: string; userAnswer: string; aiFeedback: string | null; score: number | null }[];
};

export default function MockInterviewFeedbackPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<Feedback | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await apiFetch<Feedback & { strengths?: unknown; improvements?: unknown }>(`/mock-interviews/${id}/feedback`, {
          method: "GET",
        });
        setData({
          ...raw,
          strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
          improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [id]);

  return (
    <RequireAuth>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Interview feedback</h1>
            <p className="text-muted-foreground">AI evaluation of your mock interview.</p>
          </div>
          <Link href="/mock-interviews" className="text-sm font-medium text-primary hover:underline">
            ← Back to list
          </Link>
        </div>
        {err && <p className="text-destructive mb-4">{err}</p>}
        {!data && !err && <p className="text-muted-foreground">Loading…</p>}
        {data && (
          <div className="space-y-6">
            <Card className="border-primary/30">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Overall score</CardTitle>
                <div className="text-4xl font-bold text-primary">{data.overall_score ?? "—"}</div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{data.summary_feedback}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">{data.status}</Badge>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="questions">Per question</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {(data.strengths ?? []).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Improvements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {(data.improvements ?? []).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="questions" className="space-y-4">
                {data.answers.map((a, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <div className="flex justify-between gap-4">
                        <CardTitle className="text-base font-medium leading-relaxed">{a.question}</CardTitle>
                        {a.score != null && <Badge>{a.score}</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">Your answer</div>
                        <p className="whitespace-pre-wrap">{a.userAnswer}</p>
                      </div>
                      <Separator />
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">AI feedback</div>
                        <p className="whitespace-pre-wrap">{a.aiFeedback}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </RequireAuth>
  );
}
