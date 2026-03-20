import { isAddress } from "viem";
import type {
  VeeroInsightInput,
  VeeroInsightsRequest,
  VeeroInsightsResponse,
} from "@/lib/insight-types";

const MAX_PAYMENTS = 25;
const MAX_NOTE_LENGTH = 140;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toAmountNumber(amount: string) {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNote(note?: string) {
  const trimmed = note?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, MAX_NOTE_LENGTH);
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function suggestFallbackLabel(note: string) {
  const normalized = note.trim().toLowerCase();

  if (!normalized) {
    return "General";
  }

  const canonicalMap: Record<string, string> = {
    api: "API",
    coffee: "Coffee",
    food: "Food",
    fuel: "Fuel",
    gas: "Gas",
    groceries: "Groceries",
    lunch: "Lunch",
    membership: "Membership",
    rent: "Rent",
    service: "Service",
    services: "Services",
    software: "Software",
    subscription: "Subscription",
    subscriptions: "Subscriptions",
    tool: "Tools",
    tools: "Tools",
    topup: "Top Up",
    "top-up": "Top Up",
    transport: "Transport",
    travel: "Travel",
    utiliy: "Utility",
    utility: "Utility",
    utilities: "Utilities",
  };

  if (normalized === "test" || normalized === "misc" || normalized === "stuff") {
    return "General";
  }

  if (canonicalMap[normalized]) {
    return canonicalMap[normalized];
  }

  const cleaned = normalized.replace(/[^a-z0-9\s-]/g, " ").trim();
  if (!cleaned) {
    return "General";
  }

  return toTitleCase(cleaned.split(/\s+/).slice(0, 2).join(" "));
}

export function validateInsightsRequest(body: unknown): VeeroInsightsRequest {
  if (typeof body !== "object" || body === null || !("payments" in body)) {
    throw new Error("Request body must include a payments array.");
  }

  const maybePayments = (body as { payments?: unknown }).payments;

  if (!Array.isArray(maybePayments)) {
    throw new Error("payments must be an array.");
  }

  const payments = maybePayments
    .slice(0, MAX_PAYMENTS)
    .map((item, index): VeeroInsightInput => {
      if (typeof item !== "object" || item === null) {
        throw new Error(`Payment at index ${index} is invalid.`);
      }

      const record = item as Partial<VeeroInsightInput>;

      if (!record.recipient || typeof record.recipient !== "string" || !isAddress(record.recipient)) {
        throw new Error(`Payment at index ${index} has an invalid recipient.`);
      }

      if (!record.amount || typeof record.amount !== "string") {
        throw new Error(`Payment at index ${index} has an invalid amount.`);
      }

      if (!record.timestamp || typeof record.timestamp !== "string") {
        throw new Error(`Payment at index ${index} has an invalid timestamp.`);
      }

      return {
        amount: record.amount,
        note: normalizeNote(record.note),
        recipient: record.recipient as `0x${string}`,
        recipientName:
          typeof record.recipientName === "string" && record.recipientName.trim()
            ? record.recipientName.trim().slice(0, 80)
            : undefined,
        timestamp: record.timestamp,
        token: "USDC",
      };
    });

  return { payments };
}

export function buildCompactPaymentContext(payments: VeeroInsightInput[]) {
  return payments.map((payment) => ({
    amount: payment.amount,
    contact: payment.recipientName ?? null,
    note: payment.note ?? null,
    recipient: payment.recipient,
    timestamp: payment.timestamp,
    token: payment.token,
  }));
}

export function buildPromptContext(payments: VeeroInsightInput[]) {
  const totalSpent = payments.reduce((sum, payment) => sum + toAmountNumber(payment.amount), 0);
  const contactMap = new Map<
    string,
    { count: number; name?: string; total: number; address: `0x${string}` }
  >();
  const noteCounts = new Map<string, number>();

  for (const payment of payments) {
    const key = payment.recipient.toLowerCase();
    const current = contactMap.get(key) ?? {
      count: 0,
      name: payment.recipientName,
      total: 0,
      address: payment.recipient,
    };

    current.count += 1;
    current.total += toAmountNumber(payment.amount);
    current.name = current.name ?? payment.recipientName;
    contactMap.set(key, current);

    if (payment.note) {
      const normalized = payment.note.toLowerCase();
      noteCounts.set(normalized, (noteCounts.get(normalized) ?? 0) + 1);
    }
  }

  const topContact = [...contactMap.values()].sort(
    (a, b) => b.count - a.count || b.total - a.total,
  )[0];

  return {
    paymentCount: payments.length,
    totalSpent: totalSpent.toFixed(2),
    topContact: topContact
      ? {
          address: topContact.address,
          count: topContact.count,
          name: topContact.name ?? null,
          total: topContact.total.toFixed(2),
        }
      : null,
    repeatedNotes: [...noteCounts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([note, count]) => ({ note, count })),
  };
}

export function buildFallbackInsights(payments: VeeroInsightInput[]): VeeroInsightsResponse {
  if (payments.length === 0) {
    return {
      summary: "There is not enough recent activity to summarize yet.",
      topContact: {
        address: null,
        name: null,
        reason: "There is not enough history to identify a repeat recipient.",
      },
      topCategory: {
        label: null,
        reason: "There is not enough note data to identify a spending pattern.",
      },
      labelSuggestions: [],
    };
  }

  const promptContext = buildPromptContext(payments);
  const paymentsThisWeek = payments.length;
  const contact = promptContext.topContact;
  const messyNotes = payments
    .map((payment) => payment.note)
    .filter((note): note is string => Boolean(note))
    .filter((note) => note.length > 0 && note.length < 24)
    .slice(0, 4);

  return {
    summary: `You sent about ${promptContext.totalSpent} USDC across ${paymentsThisWeek} recent payment${paymentsThisWeek === 1 ? "" : "s"}.`,
    topContact: contact
      ? {
          address: contact.address,
          name: contact.name,
          reason: `Your most frequent recipient was ${contact.name ?? shortAddress(contact.address)}.`,
        }
      : {
          address: null,
          name: null,
          reason: "There is no clear repeat recipient yet.",
        },
    topCategory: {
      label: messyNotes.length > 0 ? "Tools or services" : null,
      reason:
        messyNotes.length > 0
          ? "Most recent notes look like tools or service payments."
          : "There are not enough clear notes to identify a spending pattern.",
    },
    labelSuggestions: messyNotes.map((note) => ({
      originalNote: note,
      suggestedLabel: suggestFallbackLabel(note),
    })),
  };
}

export function buildInsightsMessages(payments: VeeroInsightInput[]) {
  const compactPayments = buildCompactPaymentContext(payments);
  const promptContext = buildPromptContext(payments);

  return [
    {
      role: "system",
      content:
        "You are Veero Insights. Analyze recent stablecoin payment history and respond with compact JSON only. Use plain English. Be cautious. Do not sound like a chatbot. Do not include markdown or explanation outside JSON.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Analyze recent Veero payment history.",
        outputSchema: {
          summary: "string",
          topContact: {
            name: "string | null",
            address: "string | null",
            reason: "string",
          },
          topCategory: {
            label: "string | null",
            reason: "string",
          },
          labelSuggestions: [
            {
              originalNote: "string",
              suggestedLabel: "string",
            },
          ],
        },
        rules: [
          "Return valid JSON only.",
          "Keep every field short and plain.",
          "Keep the summary to one short sentence.",
          "Avoid overconfident language.",
          "If data is weak, say so clearly instead of guessing.",
          "Top contact reason should read like a short utility statement.",
          "Top category reason should read like a short spending pattern summary.",
          "Label suggestions should read like practical cleanup advice.",
          "Do not use marketing language.",
        ],
        deterministicContext: promptContext,
        payments: compactPayments,
      }),
    },
  ];
}

function parseContentText(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (
          typeof item === "object" &&
          item !== null &&
          "text" in item &&
          typeof item.text === "string"
        ) {
          return item.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

function extractJsonObject(raw: string) {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model response did not contain JSON.");
  }

  return raw.slice(firstBrace, lastBrace + 1);
}

export function parseInsightsModelResponse(payload: unknown): VeeroInsightsResponse {
  if (typeof payload !== "object" || payload === null || !("choices" in payload)) {
    throw new Error("Unexpected OpenGradient response shape.");
  }

  const choices = (payload as { choices?: unknown }).choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("OpenGradient response did not include any choices.");
  }

  const firstChoice = choices[0] as {
    message?: {
      content?: unknown;
    };
  };

  const rawText = parseContentText(firstChoice.message?.content);
  const parsed = JSON.parse(extractJsonObject(rawText)) as Partial<VeeroInsightsResponse>;

  return {
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "No clear summary was returned.",
    topContact: {
      address:
        parsed.topContact?.address && typeof parsed.topContact.address === "string"
          ? (parsed.topContact.address as `0x${string}`)
          : null,
      name:
        parsed.topContact?.name && typeof parsed.topContact.name === "string"
          ? parsed.topContact.name
          : null,
      reason:
        parsed.topContact?.reason && typeof parsed.topContact.reason === "string"
          ? parsed.topContact.reason
          : "There is no clear top contact yet.",
    },
    topCategory: {
      label:
        parsed.topCategory?.label && typeof parsed.topCategory.label === "string"
          ? parsed.topCategory.label
          : null,
      reason:
        parsed.topCategory?.reason && typeof parsed.topCategory.reason === "string"
          ? parsed.topCategory.reason
          : "There is no clear spending pattern yet.",
    },
    labelSuggestions: Array.isArray(parsed.labelSuggestions)
      ? parsed.labelSuggestions
          .filter(
            (item): item is { originalNote: string; suggestedLabel: string } =>
              typeof item === "object" &&
              item !== null &&
              "originalNote" in item &&
              "suggestedLabel" in item &&
              typeof item.originalNote === "string" &&
              typeof item.suggestedLabel === "string",
          )
          .slice(0, 8)
      : [],
  };
}

export function mergeInsightsWithFallback(
  primary: VeeroInsightsResponse,
  fallback: VeeroInsightsResponse,
): VeeroInsightsResponse {
  return {
    summary:
      primary.summary && primary.summary !== "No clear summary was returned."
        ? primary.summary
        : fallback.summary,
    topContact: {
      address: primary.topContact.address ?? fallback.topContact.address,
      name: primary.topContact.name ?? fallback.topContact.name,
      reason:
        primary.topContact.reason &&
        primary.topContact.reason !== "There is no clear top contact yet."
          ? primary.topContact.reason
          : fallback.topContact.reason,
    },
    topCategory: {
      label: primary.topCategory.label ?? fallback.topCategory.label,
      reason:
        primary.topCategory.reason &&
        primary.topCategory.reason !== "There is no clear spending pattern yet."
          ? primary.topCategory.reason
          : fallback.topCategory.reason,
    },
    labelSuggestions:
      primary.labelSuggestions.length > 0
        ? primary.labelSuggestions
        : fallback.labelSuggestions,
  };
}
