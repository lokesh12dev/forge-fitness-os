import crypto from "node:crypto";
import { prisma } from "../prisma";
import { logEvent } from "../observability";

export type OutreachChannel = "WHATSAPP" | "SMS" | "EMAIL";

export async function dispatchMemberMessage(input: {
  orgId: string;
  branchId: string;
  memberId: string;
  channel: OutreachChannel;
  recipient: string;
  templateCode?: string;
  body: string;
  skipConsentCheck?: boolean;
}): Promise<{
  ok: boolean;
  status: "MOCK_SENT" | "SENT" | "BLOCKED_OPT_OUT";
  providerMsgId: string | null;
}> {
  if (!input.skipConsentCheck) {
    const consent = await prisma.consentRecord.findFirst({
      where: {
        orgId: input.orgId,
        memberId: input.memberId,
        channel: input.channel,
      },
      orderBy: { recordedAt: "desc" },
    });
    if (consent && !consent.granted) {
      return {
        ok: false,
        status: "BLOCKED_OPT_OUT",
        providerMsgId: null,
      };
    }
  }

  let status: "MOCK_SENT" | "SENT" = "MOCK_SENT";
  let providerMsgId = `mock_${input.channel.toLowerCase()}_${crypto.randomBytes(5).toString("hex")}`;

  if (
    input.channel === "WHATSAPP" &&
    process.env.WHATSAPP_CLOUD_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.recipient.replace(/[^\d]/g, ""),
          type: "text",
          text: { body: input.body },
        }),
      }
    );
    if (res.ok) {
      const json = (await res.json()) as { messages?: Array<{ id?: string }> };
      status = "SENT";
      providerMsgId = json.messages?.[0]?.id ?? providerMsgId;
    }
  }

  await prisma.communicationLog.create({
    data: {
      orgId: input.orgId,
      branchId: input.branchId,
      memberId: input.memberId,
      channel: input.channel,
      direction: "OUTBOUND",
      templateCode: input.templateCode ?? null,
      body: input.body,
      status,
      providerMsgId,
    },
  });

  logEvent("info", "Dispatched member outreach message", {
    orgId: input.orgId,
    channel: input.channel,
    status,
  });

  return { ok: true, status, providerMsgId };
}
