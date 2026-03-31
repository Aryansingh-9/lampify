"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAdmin } from "@/components/require-admin";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type Analytics = {
  students: number;
  paid_subscribers: number;
  mock_interviews: number;
  wizard_sessions: number;
  admin_pathways: number;
  revenue_paise: number;
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const a = await apiFetch<Analytics>("/admin/analytics", { method: "GET" });
        setData(a);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, []);

  return (
    <RequireAdmin>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Admin dashboard</h1>
        <p className="text-muted-foreground mb-8">KPIs and quick links for operations.</p>
        {err && <p className="text-destructive mb-4">{err}</p>}
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Students</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{data.students}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Paid subscribers</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{data.paid_subscribers}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Mock interviews</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{data.mock_interviews}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Wizard sessions</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{data.wizard_sessions}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Your pathways</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{data.admin_pathways}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (paise)</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">₹{(data.revenue_paise / 100).toFixed(0)}</CardContent>
            </Card>
          </div>
        )}
        <div className="flex flex-wrap gap-4">
          <Link href="/admin/students" className="text-primary font-medium hover:underline">
            View students →
          </Link>
          <Link href="/admin/batches" className="text-primary font-medium hover:underline">
            Manage batches →
          </Link>
          <Link href="/admin/pathways" className="text-primary font-medium hover:underline">
            Manage pathways →
          </Link>
        </div>
      </main>
    </RequireAdmin>
  );
}
