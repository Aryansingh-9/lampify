"use client";

import { useEffect, useState } from "react";
import { RequireAdmin } from "@/components/require-admin";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type Batch = {
  id: string;
  name: string;
  enrollments: { user: { id: string; email: string; name: string | null } }[];
};

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [name, setName] = useState("");
  const [enrollUser, setEnrollUser] = useState("");
  const [enrollBatch, setEnrollBatch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const data = await apiFetch<Batch[]>("/admin/batches", { method: "GET" });
    setBatches(data);
  }

  useEffect(() => {
    void refresh().catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, []);

  async function createBatch(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/batches", { method: "POST", json: { name } });
    setName("");
    await refresh();
  }

  async function enroll(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch(`/admin/batches/${enrollBatch}/enroll`, {
      method: "POST",
      json: { user_id: enrollUser },
    });
    setEnrollUser("");
    await refresh();
  }

  return (
    <RequireAdmin>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-8">Batches</h1>
        {err && <p className="text-destructive mb-4">{err}</p>}
        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create batch</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void createBatch(e)} className="space-y-3">
                <div>
                  <Label htmlFor="bn">Name</Label>
                  <Input id="bn" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <Button type="submit">Create</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Enroll student</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void enroll(e)} className="space-y-3">
                <div>
                  <Label htmlFor="bid">Batch ID</Label>
                  <Input id="bid" value={enrollBatch} onChange={(e) => setEnrollBatch(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="uid">User ID (UUID)</Label>
                  <Input id="uid" value={enrollUser} onChange={(e) => setEnrollUser(e.target.value)} required />
                </div>
                <Button type="submit">Enroll</Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <div className="mt-10 space-y-4">
          {batches.map((b) => (
            <Card key={b.id}>
              <CardHeader>
                <CardTitle>{b.name}</CardTitle>
                <p className="text-xs text-muted-foreground font-mono">{b.id}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium mb-2">Students ({b.enrollments.length})</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {b.enrollments.map((e) => (
                    <li key={e.user.id}>
                      {e.user.email} {e.user.name ? `(${e.user.name})` : ""}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </RequireAdmin>
  );
}
