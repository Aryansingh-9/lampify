"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type Resume = { id: string; title: string; content: string; updatedAt: string };

export default function ResumesPage() {
  const [list, setList] = useState<Resume[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);

  async function refresh() {
    const data = await apiFetch<Resume[]>("/resumes", { method: "GET" });
    setList(data);
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await apiFetch("/resumes", { method: "POST", json: { title, content } });
      setTitle("");
      setContent("");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <RequireAuth>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-8">Resumes</h1>
        <Card className="mb-10">
          <CardHeader>
            <CardTitle>Add resume</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void add(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t">Title</Label>
                <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c">Content</Label>
                <Textarea id="c" rows={12} value={content} onChange={(e) => setContent(e.target.value)} required />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save resume"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {list.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-lg">{r.title}</CardTitle>
                <p className="text-xs text-muted-foreground">Updated {new Date(r.updatedAt).toLocaleString()}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap line-clamp-6">{r.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </RequireAuth>
  );
}
