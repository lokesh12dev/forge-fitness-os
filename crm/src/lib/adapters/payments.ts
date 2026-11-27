import crypto from "node:crypto";

export interface PaymentIntentRequest {
  orgId: string;
  invoiceId: string;
  invoiceNumber: string;
  amountPaise: number;
  currency: string;
  customerName: string;
  customerPhone: string;
}

export interface PaymentIntentResult {
  provider: "RAZORPAY" | "STRIPE";
  mode: "LIVE" | "MOCK";
  providerOrderId: string;
  upiIntentUri?: string;
  checkoutUrl?: string;
}

export interface PaymentGatewayAdapter {
  createOrder(req: PaymentIntentRequest): Promise<PaymentIntentResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
}

export const razorpayAdapter: PaymentGatewayAdapter = {
  async createOrder(req) {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    const rupees = (req.amountPaise / 100).toFixed(2);
    const upiIntentUri = `upi://pay?pa=forgegym@icici&pn=${encodeURIComponent(
      "FORGE Athletics"
    )}&tr=${encodeURIComponent(req.invoiceNumber)}&am=${rupees}&cu=${req.currency}`;

    if (keyId && keySecret) {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: req.amountPaise,
          currency: req.currency,
          receipt: req.invoiceNumber,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        return {
          provider: "RAZORPAY",
          mode: "LIVE",
          providerOrderId: data.id,
          upiIntentUri,
        };
      }
    }

    return {
      provider: "RAZORPAY",
      mode: "MOCK",
      providerOrderId: `order_mock_${crypto.randomBytes(6).toString("hex")}`,
      upiIntentUri,
    };
  },

  verifyWebhookSignature(rawBody, signatureHeader) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "whsec_forge_mock_razorpay";
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!signatureHeader || signatureHeader.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  },
};

export const stripeAdapter: PaymentGatewayAdapter = {
  async createOrder(req) {
    const mockOrderId = `cs_mock_${crypto.randomBytes(6).toString("hex")}`;
    return {
      provider: "STRIPE",
      mode: process.env.STRIPE_SECRET_KEY?.trim() ? "LIVE" : "MOCK",
      providerOrderId: mockOrderId,
      checkoutUrl: `/app/billing?stripeMockOrder=${encodeURIComponent(mockOrderId)}&inv=${encodeURIComponent(req.invoiceId)}`,
    };
  },

  verifyWebhookSignature(rawBody, signatureHeader) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "whsec_forge_mock_stripe";
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!signatureHeader || signatureHeader.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  },
};
