"use client";

import { useMemo, useState } from "react";
import { usePaymentHistory } from "@/hooks/use-payment-history";
import type {
  VeeroInsightInput,
  VeeroInsightsRequest,
  VeeroInsightsResponse,
} from "@/lib/insight-types";

function shortAddress(address: string | null) {
  if (!address) {
    return "--";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function VeeroInsightsSection() {
  const { history, isReady } = usePaymentHistory();
  const [insights, setInsights] = useState<VeeroInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const payments = useMemo<VeeroInsightInput[]>(
    () =>
      history.slice(0, 25).map((entry) => ({
        amount: entry.amount,
        note: entry.note,
        recipient: entry.recipient,
        recipientName: entry.recipientName,
        timestamp: entry.timestamp,
        token: entry.token,
      })),
    [history],
  );

  const hasUsefulHistory = payments.length >= 2;
  const canGenerate = isReady && hasUsefulHistory && !isLoading;

  async function handleGenerateInsights() {
    if (!canGenerate) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarning(null);

    try {
      const body: VeeroInsightsRequest = { payments };
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        warning?: string;
        insights?: VeeroInsightsResponse;
      };

      if (!response.ok || !result.ok || !result.insights) {
        throw new Error(result.error || "Unable to generate Veero Insights right now.");
      }

      setInsights(result.insights);
      setWarning(result.warning ?? null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Veero Insights are unavailable right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="section-frame fade-up-soft rounded-[1.1rem] p-3">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-kicker text-cyan">Insights</p>
            <h2 className="mt-1.5 text-[1.05rem] font-semibold tracking-[-0.04em] text-slate-900">
              Veero Insights
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-500">
              Short summaries from recent payment activity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateInsights()}
            disabled={!canGenerate}
            className="action-pill action-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Generating..." : "Generate Insights"}
          </button>
        </div>

        {!isReady ? (
          <div className="mt-3 rounded-[0.95rem] border border-slate-200 bg-white/85 px-3 py-2.5">
            <p className="text-sm font-medium text-slate-700">Loading activity...</p>
          </div>
        ) : null}

        {isReady && !hasUsefulHistory ? (
          <div className="mt-3 rounded-[0.95rem] border border-dashed border-slate-200 bg-white/80 px-3 py-2.5">
            <p className="text-sm font-medium text-slate-900">Not enough history yet</p>
            <p className="mt-1 text-[12px] leading-5 text-slate-500">
              Send at least two payments in Veero to generate useful insights.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-[0.95rem] border border-rose-200 bg-white px-3 py-2.5">
            <p className="text-sm font-medium text-slate-900">Insights unavailable</p>
            <p className="mt-1 text-[12px] leading-5 text-slate-500">
              Veero could not generate insights right now.
            </p>
            <p className="mt-1 text-[12px] leading-5 text-rose-700">{error}</p>
          </div>
        ) : null}

        {warning ? (
          <div className="mt-3 rounded-[0.95rem] border border-amber-200 bg-white px-3 py-2.5">
            <p className="text-sm font-medium text-slate-900">Limited insight</p>
            <p className="mt-1 text-[12px] leading-5 text-slate-500">
              Veero filled in a few gaps using local history.
            </p>
            <p className="mt-1 text-[12px] leading-5 text-slate-500">{warning}</p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-3 grid gap-2">
            <div className="rounded-[0.95rem] border border-slate-200 bg-white/88 px-3 py-3 loading-shimmer" />
            <div className="rounded-[0.95rem] border border-slate-200 bg-white/88 px-3 py-3 loading-shimmer" />
            <div className="rounded-[0.95rem] border border-slate-200 bg-white/88 px-3 py-3 loading-shimmer" />
          </div>
        ) : null}

        {insights && !isLoading ? (
          <div className="mt-3 grid gap-2">
            <div className="rounded-[0.95rem] border border-slate-200 bg-white/88 px-3 py-3">
              <p className="meta-label">Weekly Summary</p>
              <p className="mt-2 text-[13px] leading-5 text-slate-700">{insights.summary}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[0.95rem] border border-slate-200 bg-white/88 px-3 py-3">
                <p className="meta-label">Top Contact</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {insights.topContact.name || shortAddress(insights.topContact.address)}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">
                  {insights.topContact.reason}
                </p>
              </div>

              <div className="rounded-[0.95rem] border border-slate-200 bg-white/88 px-3 py-3">
                <p className="meta-label">Top Pattern</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {insights.topCategory.label || "No clear pattern yet"}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">
                  {insights.topCategory.reason}
                </p>
              </div>
            </div>

            <div className="rounded-[0.95rem] border border-slate-200 bg-white/88 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="meta-label">Note Cleanup</p>
                <span className="text-[11px] text-slate-400">
                  {insights.labelSuggestions.length} suggestion
                  {insights.labelSuggestions.length === 1 ? "" : "s"}
                </span>
              </div>

              {insights.labelSuggestions.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {insights.labelSuggestions.map((item, index) => (
                    <div
                      key={`${item.originalNote}-${index}`}
                      className="rounded-[0.8rem] border border-slate-200 bg-slate-50/90 px-2.5 py-2"
                    >
                      <p className="text-[12px] text-slate-500">{item.originalNote}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {item.suggestedLabel}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  Recent notes already look fairly clean.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
