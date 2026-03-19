"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arcTestnet } from "@/lib/wagmi";

function getStatusCopy(isConnected: boolean, chainId?: number) {
  if (!isConnected) {
    return {
      tone: "border-slate-200 bg-white/80 text-slate-900",
      title: "Arc network",
      body: "Best on Arc Testnet for now.",
    };
  }

  if (chainId === arcTestnet.id) {
    return {
      tone: "border-slate-200 bg-white/80 text-slate-900",
      title: "Arc ready",
      body: "Once you switch, everything updates automatically.",
    };
  }

  return {
    tone: "border-coral/20 bg-white/82 text-slate-900",
    title: "Wrong network",
    body: "Switch to Arc to see the right balances and payment flow.",
  };
}

export function NetworkStatusCard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending, error } = useSwitchChain();

  const status = getStatusCopy(isConnected, chainId);
  const isWrongNetwork = isConnected && chainId !== arcTestnet.id;

  return (
    <div className="section-frame network-surface fade-up-soft stagger-2 rounded-[1.45rem] p-3.5 sm:p-4">
      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="section-kicker text-cyan">Network</p>
          <h2 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.06em] text-slate-900 sm:text-[1.3rem]">
            Arc
          </h2>
        </div>

        <div className={`network-panel rounded-[1.2rem] border p-3.5 text-sm leading-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${status.tone} lg:max-w-sm`}>
          <div className="flex items-center gap-2.5">
            <span className={`network-dot ${isWrongNetwork ? "network-dot-warn" : isConnected ? "network-dot-live" : "network-dot-idle"}`} />
            <p className="text-base font-semibold tracking-[-0.03em]">{status.title}</p>
          </div>
          <p className="mt-1.5 text-[12px] text-slate-500">{status.body}</p>
          <div className="mt-3 grid gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:grid-cols-2">
            <p className="rounded-[0.9rem] border border-white/80 bg-white/70 px-3 py-1.5">Expected: {arcTestnet.id}</p>
            {isConnected ? <p className="rounded-[0.9rem] border border-white/80 bg-white/70 px-3 py-1.5">Current: {chainId}</p> : null}
          </div>
          {isWrongNetwork ? (
            <button
              onClick={() => switchChain({ chainId: arcTestnet.id })}
              disabled={isPending}
              className="action-pill action-primary mt-3 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Switching..." : "Switch to Arc"}
            </button>
          ) : null}
          {isWrongNetwork ? (
            <p className="mt-2 text-[11px] text-slate-400">
              Once you switch, everything updates automatically.
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 text-sm text-rose-700">
              We couldn&apos;t switch here. If your wallet asks, approve it there.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
