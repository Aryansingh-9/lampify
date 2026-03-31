import { Router, raw } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

function getRazorpay() {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new Error("Razorpay keys not configured");
  return new Razorpay({ key_id: key, key_secret: secret });
}

const orderSchema = z.object({
  plan: z.enum(["WEEK", "MONTH"]),
});

router.post("/payments/create-order", requireAuth, async (req: AuthRequest, res) => {
  const parse = orderSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const amountPaise = parse.data.plan === "WEEK" ? 9900 : 24900;
  const rp = getRazorpay();
  const order = await rp.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `lampify_${req.userId!.slice(0, 8)}_${Date.now()}`,
    notes: { user_id: req.userId!, plan: parse.data.plan },
  });

  await prisma.payment.create({
    data: {
      userId: req.userId!,
      amount: amountPaise,
      planType: parse.data.plan === "WEEK" ? "WEEK" : "MONTH",
      razorpayOrderId: order.id,
      status: "CREATED",
    },
  });

  res.json({
    order_id: order.id,
    amount: amountPaise,
    currency: "INR",
    key_id: process.env.RAZORPAY_KEY_ID,
    plan: parse.data.plan,
  });
});

const verifySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

router.post("/payments/verify", requireAuth, async (req: AuthRequest, res) => {
  const parse = verifySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Payment not configured" });
    return;
  }
  const body = `${parse.data.razorpay_order_id}|${parse.data.razorpay_payment_id}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (expected !== parse.data.razorpay_signature) {
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  const payment = await prisma.payment.findFirst({
    where: {
      userId: req.userId!,
      razorpayOrderId: parse.data.razorpay_order_id,
      status: "CREATED",
    },
  });
  if (!payment) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "PAID",
      razorpayPaymentId: parse.data.razorpay_payment_id,
    },
  });

  const tier = payment.planType === "WEEK" ? "WEEKLY" : "MONTHLY";
  await prisma.user.update({
    where: { id: req.userId! },
    data: { subscriptionTier: tier },
  });

  res.json({ ok: true, subscription_tier: tier });
});

export const paymentsWebhookMiddleware = raw({ type: "application/json" });

export async function paymentsWebhookHandler(req: import("express").Request, res: import("express").Response) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Webhook not configured" });
    return;
  }
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  if (!signature) {
    res.status(400).json({ error: "No signature" });
    return;
  }
  const rawBody = req.body as Buffer;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected !== signature) {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; notes?: { user_id?: string } } };
    };
  };
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  if (payload.event === "payment.captured" && payload.payload?.payment?.entity) {
    const ent = payload.payload.payment.entity;
    const userId = ent.notes?.user_id;
    if (userId && ent.order_id) {
      const p = await prisma.payment.findFirst({
        where: { razorpayOrderId: ent.order_id, userId },
      });
      if (p && p.status !== "PAID") {
        await prisma.payment.update({
          where: { id: p.id },
          data: { status: "PAID", razorpayPaymentId: ent.id },
        });
        const tier = p.planType === "WEEK" ? "WEEKLY" : "MONTHLY";
        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionTier: tier },
        });
      }
    }
  }

  res.json({ received: true });
}

export default router;
