"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

type PathwayDetail = {
  id: string;
  name: string;
  domain: string;
  modules: { id: string; name: string; content: string; sortOrder: number }[];
};

export default function PathwayDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [p, setP] = useState<PathwayDetail | null>(null);
  const [progress, setProgress] = useState<{ progress_percent: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [detail, prog] = await Promise.all([
      apiFetch<PathwayDetail>(`/pathways/${id}`, { method: "GET" }),
      apiFetch<{ progress_percent: number }>(`/pathways/${id}/progress`, { method: "GET" }),
    ]);
    setP(detail);
    setProgress(prog);
  }, [id]);

  useEffect(() => {
    void refresh().catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, [id, refresh]);

  async function markComplete(moduleId: string) {
    await apiFetch(`/pathways/${id}/progress`, {
      method: "POST",
      json: { module_id: moduleId },
    });
    await refresh();
  }

  return (
    <RequireAuth>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/pathways" className="text-sm text-primary hover:underline mb-4 inline-block">
          ← All pathways
        </Link>
        {err && <p className="text-destructive">{err}</p>}
        {!p && !err && <p className="text-muted-foreground">Loading…</p>}
        {p && (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold">{p.name}</h1>
              <p className="text-muted-foreground">{p.domain}</p>
              <div className="mt-4 flex items-center gap-4">
                <Progress value={progress?.progress_percent ?? 0} className="flex-1 h-3" />
                <Badge variant="secondary">{progress?.progress_percent ?? 0}%</Badge>
              </div>
            </div>
            <div className="space-y-4">
              {p.modules.map((m) => (
                <Card key={m.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{m.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm leading-relaxed whitespace-pre-wrap">
                    <p>{m.content}</p>
                    <Button size="sm" variant="secondary" onClick={() => void markComplete(m.id)}>
                      Mark module complete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </RequireAuth>
  );
}
