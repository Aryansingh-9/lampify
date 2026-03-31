"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

type Row = {
  id: string;
  jobRole: string;
  company: string | null;
  status: string;
  attemptNumber: number;
  overallScore: number | null;
  createdAt: string;
};

export default function MockInterviewsListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<Row[]>("/mock-interviews", { method: "GET" });
        setRows(data);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  return (
    <RequireAuth>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Mock interviews</h1>
            <p className="text-muted-foreground">Practice with AI-generated questions for your target role.</p>
          </div>
          <Button asChild>
            <Link href="/mock-interviews/new">
              <Plus className="h-4 w-4 mr-1" />
              New interview
            </Link>
          </Button>
        </div>
        {err && <p className="text-destructive mb-4">{err}</p>}
        <div className="space-y-3">
          {rows.length === 0 && !err && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No interviews yet. Create one to get started.
              </CardContent>
            </Card>
          )}
          {rows.map((r) => (
            <Link key={r.id} href={r.status === "COMPLETED" ? `/mock-interviews/${r.id}/feedback` : `/mock-interviews/${r.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between gap-4 py-4">
                  <div>
                    <CardTitle className="text-lg">{r.jobRole}</CardTitle>
                    <p className="text-sm text-muted-foreground">{r.company ?? "—"} · Attempt #{r.attemptNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.overallScore != null && <Badge variant="secondary">Score {r.overallScore}</Badge>}
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </RequireAuth>
  );
}
