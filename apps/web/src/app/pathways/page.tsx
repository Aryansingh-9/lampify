"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

type Pathway = {
  id: string;
  name: string;
  domain: string;
  status: string;
  modules: { id: string; name: string }[];
};

export default function PathwaysPage() {
  const [items, setItems] = useState<Pathway[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<Pathway[]>("/pathways", { method: "GET" });
        setItems(data);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, []);

  return (
    <RequireAuth>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Pathways</h1>
        <p className="text-muted-foreground mb-8">Learning paths published by your instructors.</p>
        {err && <p className="text-destructive">{err}</p>}
        <div className="grid gap-4">
          {items.length === 0 && !err && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">No pathways available yet.</CardContent>
            </Card>
          )}
          {items.map((p) => (
            <Link key={p.id} href={`/pathways/${p.id}`}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{p.name}</CardTitle>
                      <CardDescription>{p.domain}</CardDescription>
                    </div>
                    <Badge variant="outline">{p.modules.length} modules</Badge>
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
