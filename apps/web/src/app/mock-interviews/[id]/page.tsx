"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

type MI = {
  id: string;
  status: string;
  questions: string[] | null;
  answers: { question: string; userAnswer: string; aiFeedback: string | null; score: number | null }[];
};

export default function MockInterviewSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [mi, setMi] = useState<MI | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const questions = Array.isArray(mi?.questions) ? (mi!.questions as unknown as string[]) : [];

  const load = useCallback(async () => {
    const data = await apiFetch<MI & { questions: unknown }>(`/mock-interviews/${id}`, { method: "GET" });
    const q = data.questions;
    const parsed = Array.isArray(q) ? (q as string[]) : typeof q === "string" ? (JSON.parse(q) as string[]) : [];
    setMi({ ...data, questions: parsed });
  }, [id]);

  useEffect(() => {
    void load().catch(() => router.replace("/mock-interviews"));
  }, [load, router]);

  useEffect(() => {
    if (mi?.status === "COMPLETED") {
      router.replace(`/mock-interviews/${id}/feedback`);
    }
  }, [mi?.status, id, router]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            void videoRef.current.play().catch(() => undefined);
          }
        })
        .catch(() => setStreamError("Camera/mic permission denied — you can still type your answer."));
    } else {
      setStreamError("Camera not available in this browser.");
    }
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function startSpeech() {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
        start: () => void;
      };
      SpeechRecognition?: new () => unknown;
    };
    const SR = w.webkitSpeechRecognition ?? w.SpeechRecognition;
    if (!SR) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    const rec = new SR() as {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      start: () => void;
    };
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev: { results: { 0: { 0: { transcript: string } } } }) => {
      const text = ev.results[0]?.[0]?.transcript ?? "";
      setAnswer((a) => (a ? `${a}\n${text}` : text));
    };
    rec.start();
  }

  async function submitAnswer() {
    if (!mi || !questions[idx] || !answer.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/mock-interviews/${id}/answer`, {
        method: "POST",
        json: { question: questions[idx], user_answer: answer },
      });
      setAnswer("");
      if (idx + 1 >= questions.length) {
        await apiFetch(`/mock-interviews/${id}/complete`, { method: "POST" });
        router.push(`/mock-interviews/${id}/feedback`);
      } else {
        setIdx((i) => i + 1);
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!mi) {
    return (
      <RequireAuth>
        <SiteHeader />
        <div className="p-10 text-center text-muted-foreground">Loading…</div>
      </RequireAuth>
    );
  }

  const currentQ = questions[idx] ?? "";

  return (
    <RequireAuth>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Mock interview</h1>
            <p className="text-sm text-muted-foreground">
              Question {idx + 1} of {questions.length || "—"}
            </p>
          </div>
          <Badge variant="outline">{mi.status}</Badge>
        </div>
        <Progress value={questions.length ? ((idx + 1) / questions.length) * 100 : 0} className="mb-6 h-2" />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Video & audio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative aspect-video rounded-lg bg-black/80 overflow-hidden">
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                {!streamError && (
                  <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-0.5 text-xs">Preview</span>
                )}
              </div>
              {streamError && <p className="text-xs text-muted-foreground">{streamError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg leading-relaxed">{currentQ || "Loading question…"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={10}
                placeholder="Type your answer, or use the mic to dictate…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={startSpeech}>
                  Dictate answer
                </Button>
                <Button onClick={() => void submitAnswer()} disabled={saving || !answer.trim()}>
                  {saving ? "Saving…" : idx + 1 >= questions.length ? "Submit & finish" : "Submit & next"}
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/mock-interviews">Exit</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </RequireAuth>
  );
}
