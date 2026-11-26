import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { razorpayAdapter, stripeAdapter } from "@/lib/adapters/payments";
import { applyPaymentToInvoice } from "@/lib/dues-ledger";
import { logEvent, reportException } from "@/lib/observability";

const WebhookPayloadSchema = z.object({
  orgId: z.string().min(1),
  externalEventId: z.string().min(1),
  event: z.enum(["payment.captured", "payment.failed"]),
  invoiceId: z.string().min(1),
  amountPaise: z.number().int().positive(),
  providerPaymentId: z.string().min(1),
  method: z.enum(["UPI", "CARD", "CASH", "BANK_TRANSFER"]).default("UPI"),
  errorCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const providerHeader = req.headers.get("x-forge-provider")?.toUpperCase() === "STRIPE" ? "STRIPE" : "RAZORPAY";
  const sigHeader =
    req.headers.get("x-razorpay-signature") ??
    req.headers.get("stripe-signature") ??
    req.headers.get("x-forge-signature") ??
    "";

  const adapter = providerHeader === "STRIPE" ? stripeAdapter : razorpayAdapter;
  const signatureValid = adapter.verifyWebhookSignature(rawBody, sigHeader);

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON webhook payload" }, { status: 400 });
  }

  const parsed = WebhookPayloadSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid webhook schema", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Idempotent duplicate protection
  const existing = await prisma.webhookEvent.findUnique({
    where: {
      provider_externalEventId: {
        provider: providerHeader,
        externalEventId: data.externalEventId,
      },
    },
  });

  if (existing && existing.status === "PROCESSED") {
    return NextResponse.json({
      ok: true,
      idempotentReplay: true,
      webhookEventId: existing.id,
    });
  }

  if (!signatureValid) {
    const dlqRecord = await prisma.webhookEvent.upsert({
      where: {
        provider_externalEventId: {
          provider: providerHeader,
          externalEventId: data.externalEventId,
        },
      },
      update: {
        attempts: { increment: 1 },
        status: "DLQ",
        lastError: "Invalid HMAC signature verification failed",
      },
      create: {
        orgId: data.orgId,
        provider: providerHeader,
        externalEventId: data.externalEventId,
        signatureValid: false,
        payloadJson: parsedBody as object,
        status: "DLQ",
        attempts: 1,
        lastError: "Invalid HMAC signature verification failed",
      },
    });
    return NextResponse.json(
      { error: "Webhook signature verification failed", webhookEventId: dlqRecord.id },
      { status: 401 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: data.invoiceId, orgId: data.orgId },
      });
      if (!invoice) {
        throw new Error(`Invoice ${data.invoiceId} not found in org ${data.orgId}`);
      }

      if (data.event === "payment.captured") {
        const applied = applyPaymentToInvoice({
          totalPaise: invoice.totalPaise,
          paidSoFarPaise: invoice.paidPaise,
          paymentPaise: data.amountPaise,
        });
        if (!applied.ok) {
          throw new Error(applied.error);
        }

        await tx.payment.create({
          data: {
            orgId: invoice.orgId,
            branchId: invoice.branchId,
            memberId: invoice.memberId,
            invoiceId: invoice.id,
            amountPaise: data.amountPaise,
            method: data.method,
            provider: providerHeader,
            providerPaymentId: data.providerPaymentId,
            idempotencyKey: `wh_${providerHeader}_${data.externalEventId}`,
            status: "CAPTURED",
          },
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidPaise: applied.nextPaidPaise,
            balanceDuePaise: applied.nextBalanceDuePaise,
            status: applied.nextStatus,
          },
        });
      } else {
        await tx.dunningAttempt.create({
          data: {
            orgId: invoice.orgId,
            invoiceId: invoice.id,
            attemptNo: 1,
            scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: "RETRY_SCHEDULED",
            errorCode: data.errorCode ?? "PAYMENT_FAILED",
          },
        });
      }

      return tx.webhookEvent.upsert({
        where: {
          provider_externalEventId: {
            provider: providerHeader,
            externalEventId: data.externalEventId,
          },
        },
        update: {
          status: "PROCESSED",
          signatureValid: true,
          attempts: { increment: 1 },
          processedAt: new Date(),
        },
        create: {
          orgId: data.orgId,
          provider: providerHeader,
          externalEventId: data.externalEventId,
          signatureValid: true,
          payloadJson: parsedBody as object,
          status: "PROCESSED",
          attempts: 1,
          processedAt: new Date(),
        },
      });
    });

    logEvent("info", "Processed payment webhook", {
      provider: providerHeader,
      externalEventId: data.externalEventId,
      event: data.event,
    });

    return NextResponse.json({ ok: true, webhookEventId: result.id });
  } catch (err) {
    reportException(err, { externalEventId: data.externalEventId });
    await prisma.webhookEvent.upsert({
      where: {
        provider_externalEventId: {
          provider: providerHeader,
          externalEventId: data.externalEventId,
        },
      },
      update: {
        status: "DLQ",
        attempts: { increment: 1 },
        lastError: err instanceof Error ? err.message : "Processing failure",
      },
      create: {
        orgId: data.orgId,
        provider: providerHeader,
        externalEventId: data.externalEventId,
        signatureValid: true,
        payloadJson: parsedBody as object,
        status: "DLQ",
        attempts: 1,
        lastError: err instanceof Error ? err.message : "Processing failure",
      },
    });
    return NextResponse.json({ error: "Webhook queued in DLQ after processing error" }, { status: 500 });
  }
}
