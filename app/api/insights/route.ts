import { NextRequest, NextResponse } from "next/server";
import {
  buildFallbackInsights,
  buildInsightsMessages,
  mergeInsightsWithFallback,
  parseInsightsModelResponse,
  validateInsightsRequest,
} from "@/lib/insights";
import { createOpenGradientChatCompletion, getOpenGradientModel } from "@/lib/server/opengradient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payments } = validateInsightsRequest(body);

    if (payments.length === 0) {
      return NextResponse.json({
        ok: true,
        provider: "OpenGradient",
        model: getOpenGradientModel(),
        insights: buildFallbackInsights([]),
      });
    }

    const fallbackInsights = buildFallbackInsights(payments);

    try {
      const completion = await createOpenGradientChatCompletion({
        messages: buildInsightsMessages(payments),
      });

      const insights = mergeInsightsWithFallback(
        parseInsightsModelResponse(completion),
        fallbackInsights,
      );

      return NextResponse.json({
        ok: true,
        provider: "OpenGradient",
        model: getOpenGradientModel(),
        insights,
      });
    } catch (modelError) {
      const message = getErrorMessage(
        modelError,
        "OpenGradient returned an unreadable response, so fallback insights were used.",
      );

      console.error("[Veero Insights] OpenGradient request failed:", message);

      if (message.includes("Missing OPENGRADIENT_X402_PRIVATE_KEY")) {
        return NextResponse.json(
          {
            ok: false,
            error: message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          provider: "OpenGradient",
          model: getOpenGradientModel(),
          insights: fallbackInsights,
          warning: "Using local history for now while live insights are unavailable.",
        },
        { status: 200 },
      );
    }
  } catch (error) {
    const message = getErrorMessage(error, "Unable to generate Veero Insights.");

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
