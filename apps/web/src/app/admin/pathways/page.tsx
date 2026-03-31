"use client";

import { useEffect, useState } from "react";
import { RequireAdmin } from "@/components/require-admin";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

type Pathway = {
  id: string;
  name: string;
  domain: string;
  status: string;
  modules: { id: string; name: string }[];
};

export default function AdminPathwaysPage() {
  const [items, setItems] = useState<Pathway[]>([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [publish, setPublish] = useState(true);
  const [assignPath, setAssignPath] = useState("");
  const [assignUser, setAssignUser] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const data = await apiFetch<Pathway[]>("/admin/pathways", { method: "GET" });
    setItems(data);
  }

  useEffect(() => {
    void refresh().catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await apiFetch("/admin/pathways", {
        method: "POST",
        json: { name, domain, publish },
      });
      setName("");
      setDomain("");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/assign-pathway", {
      method: "POST",
      json: { pathway_id: assignPath, user_id: assignUser },
    });
    setAssignPath("");
    setAssignUser("");
  }

  return (
    <RequireAdmin>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-8">Pathways (admin)</h1>
        {err && <p className="text-destructive mb-4">{err}</p>}
        <div className="grid gap-8 lg:grid-cols-2 mb-12">
          <Card>
            <CardHeader>
              <CardTitle>Create pathway</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void create(e)} className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label>Domain</Label>
                  <Input value={domain} onChange={(e) => setDomain(e.target.value)} required />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                  Publish immediately
                </label>
                <Button type="submit" disabled={pending}>
                  {pending ? "Generating modules…" : "Create & generate modules"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Assign pathway to student</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void assign(e)} className="space-y-3">
                <div>
                  <Label>Pathway ID</Label>
                  <Input value={assignPath} onChange={(e) => setAssignPath(e.target.value)} required />
                </div>
                <div>
                  <Label>User ID</Label>
                  <Input value={assignUser} onChange={(e) => setAssignUser(e.target.value)} required />
                </div>
                <Button type="submit">Assign</Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          {items.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>{p.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{p.domain}</p>
                  <p className="text-xs font-mono mt-1">{p.id}</p>
                </div>
                <Badge>{p.status}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{p.modules.length} modules generated</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </RequireAdmin>
  );
}
