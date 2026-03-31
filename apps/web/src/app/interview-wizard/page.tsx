"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function InterviewWizardHubPage() {
  return (
    <RequireAuth>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Interview Wizard</h1>
        <p className="text-muted-foreground mb-8">
          Pick an interview style and answer 10 AI-generated questions with instant scoring.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Start a new session</CardTitle>
            <CardDescription>HR, Technical, or Managerial — tailored to the format you choose.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/interview-wizard/new">Configure &amp; begin</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </RequireAuth>
  );
}
