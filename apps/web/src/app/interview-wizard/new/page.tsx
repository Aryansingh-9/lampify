"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { UpgradeModal } from "@/components/upgrade-modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

export default function InterviewWizardNewPage() {
  const router = useRouter();
  const [type, setType] = useState<"HR" | "TECHNICAL" | "MANAGERIAL">("HR");
  const [pending, setPending] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setPending(true);
    try {
      const res = await apiFetch<{ id: string }>("/interview-wizard", {
        method: "POST",
        json: { interview_type: type },
      });
      router.push(`/interview-wizard/${res.id}`);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      if (e.status === 402 || e.code === "FREEMIUM_LIMIT") setUpgradeOpen(true);
      else setError(e.message ?? "Failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <RequireAuth>
      <SiteHeader />
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      <main className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Interview type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Choose style</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HR">HR / Behavioral</SelectItem>
                  <SelectItem value="TECHNICAL">Technical</SelectItem>
                  <SelectItem value="MANAGERIAL">Managerial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={() => void start()} disabled={pending}>
              {pending ? "Starting…" : "Generate 10 questions"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </RequireAuth>
  );
}
