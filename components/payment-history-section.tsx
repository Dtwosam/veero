"use client";

import { useMemo } from "react";
import { usePaymentHistory } from "@/hooks/use-payment-history";
import { arcTestnet } from "@/lib/wagmi";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function PaymentHistorySection() {
  const { history, isReady } = usePaymentHistory();

  const items = useMemo(() => history.slice(0, 12), [history]);

  return (
    <section id="activity" className="section-frame history-surface fade-up-soft stagger-2 overflow-hidden rounded-[1.45rem] p-3.5 sm:p-4">
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-cyan/16 via-violet/14 to-coral/14" />
      <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-aqua/16 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-blush/14 blur-3xl" />

      <div className="relative z-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker text-cyan">Activity</p>
            <h2 className="section-title mt-2 text-[1.2rem] text-slate-900 sm:text-[1.35rem]">
              Activity
            </h2>
          </div>
        </div>

        {!isReady ? (
          <div className="history-empty mt-3 rounded-[1.2rem] p-3.5 sm:p-4">
            <div>
              <p className="text-base font-semibold text-slate-900">Getting Veero ready...</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Loading activity...
              </p>
            </div>
          </div>
        ) : null}

        {isReady && items.length === 0 ? (
          <div className="history-empty mt-3 rounded-[1.2rem] p-3.5 sm:p-4">
            <div className="history-empty-illustration">
              <span className="history-empty-orb history-empty-orb-a" />
              <span className="history-empty-orb history-empty-orb-b" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">No activity yet</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Payments you send through Veero will show up here.
              </p>
            </div>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <article key={item.id} className="history-item rounded-[1rem] p-3 sm:p-3.5">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.recipientName || shortAddress(item.recipient)}
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{item.recipient}</p>
                        {item.note ? (
                          <div className="mt-2 rounded-[0.75rem] bg-slate-50/80 px-2.5 py-1.5">
                            <p className="meta-label">Note</p>
                            <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{item.note}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="history-amount-shell">
                    <p className="history-amount-value">{item.amount} {item.token}</p>
                  </div>
                </div>

                <div className="history-meta-grid mt-2.5">
                  <div className="history-meta-card">
                    <p className="meta-label">Time</p>
                    <p className="mt-2 text-[13px] font-medium text-slate-700">
                      {formatTimestamp(item.timestamp)}
                    </p>
                  </div>
                  <div className="history-meta-card">
                    <p className="meta-label">Transaction</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                      <p className="text-[13px] font-medium text-slate-700">
                        {shortHash(item.transactionHash)}
                      </p>
                      <a
                        href={`${arcTestnet.blockExplorers.default.url}/tx/${item.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="history-link"
                      >
                        View tx
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <p className="mt-3 text-[11px] text-slate-500">
          Only payments made in Veero are stored here.
        </p>
      </div>
    </section>
  );
}
