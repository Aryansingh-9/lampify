"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UpgradeModal({ open, onOpenChange }: Props) {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState<"WEEK" | "MONTH" | null>(null);

  async function pay(plan: "WEEK" | "MONTH") {
    setLoading(plan);
    try {
      const order = await apiFetch<{
        order_id: string;
        amount: number;
        currency: string;
        key_id: string;
        plan: string;
      }>("/payments/create-order", { method: "POST", json: { plan } });

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Razorpay script failed"));
      });

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Lampify",
        description: plan === "WEEK" ? "Weekly Pro" : "Monthly Pro",
        order_id: order.order_id,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          await apiFetch("/payments/verify", {
            method: "POST",
            json: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
          });
          await refreshProfile();
          onOpenChange(false);
        },
        theme: { color: "#4f46e5" },
      };

      const rzp = new window.Razorpay!(options);
      rzp.open();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade Lampify</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          You have used your free attempts. Subscribe to continue unlimited mock interviews and the Interview Wizard.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-4 flex flex-col gap-2">
            <div className="font-semibold">Weekly</div>
            <div className="text-2xl font-bold text-primary">₹99</div>
            <div className="text-xs text-muted-foreground">per week</div>
            <Button disabled={loading !== null} onClick={() => void pay("WEEK")}>
              {loading === "WEEK" ? "Opening…" : "Choose Weekly"}
            </Button>
          </div>
          <div className="rounded-lg border p-4 flex flex-col gap-2 ring-2 ring-primary/30">
            <div className="font-semibold">Monthly</div>
            <div className="text-2xl font-bold text-primary">₹249</div>
            <div className="text-xs text-muted-foreground">per month · best value</div>
            <Button disabled={loading !== null} onClick={() => void pay("MONTH")}>
              {loading === "MONTH" ? "Opening…" : "Choose Monthly"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
