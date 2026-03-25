"use client";

import { useEffect, useMemo, useState } from "react";
import { usePaymentHistory } from "@/hooks/use-payment-history";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRelativeTime(timestamp: string, now: number) {
  const date = new Date(timestamp);
  const diffMs = now - date.getTime();

  if (Number.isNaN(date.getTime()) || diffMs < 0) {
    return "now";
  }

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "now";
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}m ago`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h ago`;
  }

  return `${Math.floor(diffMs / day)}d ago`;
}

export function PaymentHistorySection() {
  const { history, isReady } = usePaymentHistory();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const items = useMemo(() => history.slice(0, 20), [history]);

  return (
    <section id="activity" className="section-frame rounded-[1rem] p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker text-cyan">Activity</p>
          <h2 className="mt-1 text-[1rem] font-semibold tracking-[-0.04em] text-slate-900">
            Activity
          </h2>
        </div>
        <p className="text-[11px] text-slate-400">Recent payments</p>
      </div>

      {!isReady ? (
        <div className="timeline-shell mt-2">
          <p className="text-[12px] text-slate-500">Loading activity...</p>
        </div>
      ) : null}

      {isReady && items.length === 0 ? (
        <div className="timeline-shell mt-2">
          <p className="text-sm font-medium text-slate-900">No activity yet</p>
          <p className="mt-1 text-[12px] text-slate-500">
            Payments you send through Veero will appear here.
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="timeline-shell mt-2">
          <div className="timeline-list">
            {items.map((item) => (
              <article key={item.id} className="timeline-row">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900">
                    {item.recipientName || shortAddress(item.recipient)}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span>{formatRelativeTime(item.timestamp, now)}</span>
                    {item.note ? <span>- {item.note}</span> : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-slate-900">
                    {item.amount} {item.token}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] text-slate-400">
        Only payments sent through Veero are stored here.
      </p>
    </section>
  );
}
