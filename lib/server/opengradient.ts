import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { ExactEvmSchemeV1 } from "@x402/evm/v1";
import { x402Client } from "@x402/fetch";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const OPENGRADIENT_LLM_URL =
  process.env.OPENGRADIENT_BASE_URL?.trim() || "https://llm.opengradient.ai/v1";
const OPENGRADIENT_MODEL =
  process.env.OPENGRADIENT_MODEL?.trim() || "openai/gpt-5-mini";
const OPENGRADIENT_X402_NETWORK =
  process.env.OPENGRADIENT_X402_NETWORK?.trim() || "eip155:84532";
const OPENGRADIENT_X402_NETWORK_V1 =
  process.env.OPENGRADIENT_X402_NETWORK_V1?.trim() || "base-sepolia";
const OPENGRADIENT_FALLBACK_BASE_URL = "https://llmogevm.opengradient.ai/v1";

// OpenGradient x402 LLM payments are handled by a separate backend wallet.
// The wallet should be funded with Base Sepolia $OPG and have Permit2 approval.

let x402FetchSingleton:
  | ReturnType<typeof wrapFetchWithPayment>
  | null = null;

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error";
  }

  const parts = [error.message];
  const maybeCause = error.cause;

  if (maybeCause instanceof Error && maybeCause.message) {
    parts.push(`cause: ${maybeCause.message}`);
  } else if (typeof maybeCause === "string" && maybeCause.trim()) {
    parts.push(`cause: ${maybeCause.trim()}`);
  }

  return parts.filter(Boolean).join(" | ");
}

function getPrivateKey() {
  const privateKey = process.env.OPENGRADIENT_X402_PRIVATE_KEY?.trim();

  if (!privateKey) {
    throw new Error("Missing OPENGRADIENT_X402_PRIVATE_KEY.");
  }

  return privateKey as `0x${string}`;
}

function getX402Fetch() {
  if (x402FetchSingleton) {
    return x402FetchSingleton;
  }

  const account = privateKeyToAccount(getPrivateKey());
  const clientSigner = toClientEvmSigner(account);
  const client = new x402Client((_x402Version, accepts) => {
    const preferredRequirement = accepts.find(
      requirement =>
        requirement.network === OPENGRADIENT_X402_NETWORK ||
        requirement.network === OPENGRADIENT_X402_NETWORK_V1,
    );

    if (!preferredRequirement) {
      throw new Error(
        `OpenGradient did not offer the configured Base Sepolia payment route (${OPENGRADIENT_X402_NETWORK} / ${OPENGRADIENT_X402_NETWORK_V1}).`,
      );
    }

    return preferredRequirement;
  })
    .register(OPENGRADIENT_X402_NETWORK as `eip155:${string}`, new ExactEvmScheme(clientSigner))
    .registerV1(OPENGRADIENT_X402_NETWORK_V1, new ExactEvmSchemeV1(clientSigner));

  x402FetchSingleton = wrapFetchWithPayment(fetch, client);

  return x402FetchSingleton;
}

export function getOpenGradientModel() {
  return OPENGRADIENT_MODEL;
}

export async function createOpenGradientChatCompletion(input: {
  messages: Array<{ role: string; content: string }>;
}) {
  const x402Fetch = getX402Fetch();
  const payload = {
    model: OPENGRADIENT_MODEL,
    temperature: 0.2,
    max_tokens: 700,
    messages: input.messages,
  };

  async function requestCompletion(baseUrl: string) {
    return x402Fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  try {
    const response = await requestCompletion(OPENGRADIENT_LLM_URL);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenGradient request failed with ${response.status}: ${errorText.slice(0, 240)}`,
      );
    }

    return response.json();
  } catch (error) {
    const errorMessage = describeError(error);
    const shouldTryFallbackHost =
      OPENGRADIENT_LLM_URL !== OPENGRADIENT_FALLBACK_BASE_URL &&
      errorMessage.toLowerCase().includes("enotfound");

    if (shouldTryFallbackHost) {
      try {
        const fallbackResponse = await requestCompletion(OPENGRADIENT_FALLBACK_BASE_URL);

        if (!fallbackResponse.ok) {
          const errorText = await fallbackResponse.text();
          throw new Error(
            `OpenGradient request failed with ${fallbackResponse.status}: ${errorText.slice(0, 240)}`,
          );
        }

        return fallbackResponse.json();
      } catch (fallbackError) {
        throw new Error(
          `OpenGradient network request failed: primary ${describeError(error)} | fallback ${describeError(fallbackError)}`,
          { cause: fallbackError },
        );
      }
    }

    throw new Error(
      `OpenGradient network request failed: ${errorMessage}`,
      { cause: error },
    );
  }
}
