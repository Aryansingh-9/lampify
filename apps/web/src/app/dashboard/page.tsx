"use client";

import Link from "next/link";
import { Mic, Route, Wand2 } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <RequireAuth>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Hi {user?.name ?? user?.email} — pick a flow to practice interviews with AI feedback.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Plan: {user?.subscription_tier}</Badge>
            {user?.subscription_tier === "FREE" && (
              <Badge variant="outline">Free attempts left: {user?.free_attempts_remaining}</Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Link href="/mock-interviews">
            <Card className="h-full transition-shadow hover:shadow-md border-primary/20 hover:border-primary/40">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mic className="h-5 w-5" />
                </div>
                <CardTitle>Mock Interviews</CardTitle>
                <CardDescription>
                  Paste a job description and your resume. Get 10 tailored questions, record answers, and receive AI
                  evaluation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-primary">Start or continue →</span>
              </CardContent>
            </Card>
          </Link>

          <Link href="/pathways">
            <Card className="h-full transition-shadow hover:shadow-md border-primary/20 hover:border-primary/40">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Route className="h-5 w-5" />
                </div>
                <CardTitle>Pathways</CardTitle>
                <CardDescription>
                  Structured learning paths with modules and assessments. Track your progress as you complete each step.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-primary">Browse pathways →</span>
              </CardContent>
            </Card>
          </Link>

          <Link href="/interview-wizard">
            <Card className="h-full transition-shadow hover:shadow-md border-primary/20 hover:border-primary/40">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Wand2 className="h-5 w-5" />
                </div>
                <CardTitle>Interview Wizard</CardTitle>
                <CardDescription>
                  Choose HR, Technical, or Managerial style. Ten focused questions with instant scoring and feedback.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-primary">Open wizard →</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </RequireAuth>
  );
}
