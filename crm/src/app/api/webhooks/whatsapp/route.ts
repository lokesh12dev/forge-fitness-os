import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeIndianPhone } from "@/lib/leads-math";

/**
 * Meta WhatsApp Business Cloud API Verification & Inbound Message Webhook
 * Routes incoming replies into InboxThread + InboxMessage & increments unreadCount.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifySecret = process.env.WHATSAPP_VERIFY_TOKEN || "forge_crm_whatsapp_verify";

  if (mode === "subscribe" && token === verifySecret && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    let ingested = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        const messages = Array.isArray(value?.messages) ? value.messages : [];
        const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
        const contactNameFallback = contacts[0]?.profile?.name as string | undefined;

        for (const msg of messages) {
          const fromDigits = normalizeIndianPhone(String(msg?.from ?? ""));
          const textBody = String(msg?.text?.body ?? msg?.button?.text ?? "[Media/Template reply]").trim();
          if (!fromDigits) continue;

          let thread = await prisma.inboxThread.findFirst({
            where: { contactPhone: { contains: fromDigits.slice(-10) } },
            orderBy: { lastMessageAt: "desc" },
          });

          if (!thread) {
            const matchedMember = await prisma.member.findFirst({
              where: { phone: { contains: fromDigits.slice(-10) }, deletedAt: null },
            });
            if (matchedMember) {
              thread = await prisma.inboxThread.create({
                data: {
                  orgId: matchedMember.orgId,
                  branchId: matchedMember.branchId,
                  memberId: matchedMember.id,
                  contactName: matchedMember.fullName,
                  contactPhone: matchedMember.phone,
                  channel: "WHATSAPP",
                  status: "OPEN",
                  unreadCount: 1,
                  lastPreview: textBody.slice(0, 120),
                },
              });
            }
          } else {
            await prisma.inboxThread.update({
              where: { id: thread.id },
              data: {
                unreadCount: { increment: 1 },
                status: "OPEN",
                lastPreview: textBody.slice(0, 120),
                lastMessageAt: new Date(),
              },
            });
          }

          if (thread) {
            await prisma.inboxMessage.create({
              data: {
                orgId: thread.orgId,
                threadId: thread.id,
                direction: "INBOUND",
                body: textBody,
                status: "DELIVERED",
                senderName: contactNameFallback ?? thread.contactName,
              },
            });
            ingested++;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, ingested });
  } catch {
    return NextResponse.json({ error: "Invalid WhatsApp webhook payload" }, { status: 400 });
  }
}
