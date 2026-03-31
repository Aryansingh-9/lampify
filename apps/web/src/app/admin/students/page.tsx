"use client";

import { useEffect, useState } from "react";
import { RequireAdmin } from "@/components/require-admin";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

type Student = {
  id: string;
  email: string;
  name: string | null;
  subscriptionTier: string;
  freeAttemptsRemaining: number;
  createdAt: string;
  pathwayProgress: { pathwayId: string; progressPercent: number }[];
  batchEnrollments: { batch: { id: string; name: string } }[];
};

export default function AdminStudentsPage() {
  const [rows, setRows] = useState<Student[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<Student[]>("/admin/students", { method: "GET" });
        setRows(data);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, []);

  return (
    <RequireAdmin>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Students</h1>
        <p className="text-muted-foreground mb-8">All registered learners and their pathway progress.</p>
        {err && <p className="text-destructive mb-4">{err}</p>}
        <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{s.name ?? s.email}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground">{s.id}</p>
                  <p className="text-sm text-muted-foreground">{s.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{s.subscriptionTier}</Badge>
                  <Badge variant="outline">Free attempts: {s.freeAttemptsRemaining}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>
                  <span className="font-medium">Batches: </span>
                  {s.batchEnrollments.length === 0
                    ? "—"
                    : s.batchEnrollments.map((b) => b.batch.name).join(", ")}
                </div>
                <div>
                  <span className="font-medium">Pathways: </span>
                  {s.pathwayProgress.length === 0
                    ? "—"
                    : s.pathwayProgress.map((p) => `${p.pathwayId.slice(0, 8)}… (${p.progressPercent}%)`).join(", ")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </RequireAdmin>
  );
}
