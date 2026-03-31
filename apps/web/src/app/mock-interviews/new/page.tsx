"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { UpgradeModal } from "@/components/upgrade-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

export default function NewMockInterviewPage() {
  const router = useRouter();
  const [jobRole, setJobRole] = useState("");
  const [company, setCompany] = useState("");
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [pending, setPending] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await apiFetch<{ id: string }>("/mock-interviews", {
        method: "POST",
        json: {
          job_role: jobRole,
          company: company || undefined,
          jd,
          resume_content: resume,
        },
      });
      router.push(`/mock-interviews/${res.id}`);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      if (e.status === 402 || e.code === "FREEMIUM_LIMIT") {
        setUpgradeOpen(true);
      } else {
        setError(e.message ?? "Failed to create");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <RequireAuth>
      <SiteHeader />
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>New mock interview</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Job title</Label>
                <Input id="role" value={jobRole} onChange={(e) => setJobRole(e.target.value)} required placeholder="e.g. Senior Backend Engineer" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company (optional)</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jd">Job description</Label>
                <Textarea id="jd" value={jd} onChange={(e) => setJd(e.target.value)} required rows={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resume">Resume text</Label>
                <Textarea id="resume" value={resume} onChange={(e) => setResume(e.target.value)} required rows={10} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                {pending ? "Generating questions…" : "Generate interview"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </RequireAuth>
  );
}
