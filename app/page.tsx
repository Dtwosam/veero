import { BalanceOverview } from "@/components/balance-overview";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { NetworkStatusCard } from "@/components/network-status-card";
import { PayflowSection } from "@/components/payflow-section";
import { PaymentHistorySection } from "@/components/payment-history-section";
import { QuickLinkCard } from "@/components/quick-link-card";

const links = [
  {
    title: "Arc Faucet",
    description: "Top up your wallet with test funds and start exploring in a few taps.",
    href: "https://faucet.example.com",
  },
  {
    title: "Arc Explorer",
    description: "Follow payments, wallet activity, and what is moving across Arc.",
    href: "https://testnet.arcscan.app",
  },
  {
    title: "Arc Docs",
    description: "Get the basics, learn how Arc works, and go a little deeper when you want to.",
    href: "https://docs.example.com",
  },
];

export default function Home() {
  return (
    <main className="arc-shell min-h-screen pb-6">
      <div className="mesh-orb float-slow pulse-glow left-[-3rem] top-[8rem] h-36 w-36 bg-blush/30 sm:h-48 sm:w-48" />
      <div className="mesh-orb float-reverse pulse-glow-alt right-[-4rem] top-[18rem] h-40 w-40 bg-violet/25 sm:h-52 sm:w-52" />
      <div className="ambient-ribbon ambient-ribbon-a" />
      <div className="ambient-ribbon ambient-ribbon-b" />

      <section className="mx-auto max-w-7xl px-4 pb-2 pt-3 sm:px-6 sm:pb-3 sm:pt-4 lg:px-8">
        <div className="space-y-2.5">
          <div className="section-frame top-surface fade-up rounded-[1.2rem] p-3">
            <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="brand-lockup brand-lockup-premium">
                  <span className="brand-mark">V</span>
                  <div>
                    <p className="section-kicker text-cyan">Veero</p>
                    <p className="brand-subline mt-1 text-xs font-medium text-slate-600">
                      Move stablecoins instantly onchain.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <a href="#activity" className="action-pill action-secondary">
                  View activity
                </a>
                <ConnectWalletButton />
              </div>
            </div>
          </div>

          <BalanceOverview />
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-3 px-4 pb-10 sm:space-y-4 sm:px-6 lg:px-8">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_380px]">
          <div className="space-y-3">
            <PayflowSection />

            <section className="section-frame fade-up-soft rounded-[1.1rem] p-3">
              <div className="relative z-10">
                <p className="section-kicker text-cyan">Tools</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  <QuickLinkCard {...links[0]} />
                  <QuickLinkCard {...links[1]} />
                  <QuickLinkCard {...links[2]} />
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <PaymentHistorySection />
            <NetworkStatusCard />

            <section className="section-frame fade-up-soft overflow-hidden rounded-[1.1rem] p-3">
              <div className="relative z-10">
                <p className="section-kicker text-cyan">Arc</p>
                <div className="mt-2 rounded-[1rem] border border-slate-200/90 bg-white/88 p-3">
                  <div className="space-y-2 text-sm leading-6 text-slate-700">
                    <p>
                      Arc is experimenting with a model where stablecoins are part of how the chain itself is experienced.
                    </p>
                    <p>
                      By using USDC as native gas, payments feel more intuitive and closer to real economic usage.
                    </p>
                    <p className="font-medium text-slate-900">
                      Veero helps make that experience visible at a glance.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="section-frame fade-up-soft rounded-[1.1rem] p-3">
              <div className="relative z-10">
                <p className="section-kicker text-cyan">Gas</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[0.95rem] border border-slate-200/90 bg-white/90 p-3">
                    <p className="meta-label text-cyan">Native Gas Token</p>
                    <p className="mt-1.5 text-base font-semibold text-slate-900">USDC</p>
                  </div>
                  <div className="rounded-[0.95rem] border border-slate-200/90 bg-white/90 p-3">
                    <p className="meta-label text-cyan">Minimum Base Fee</p>
                    <p className="mt-1.5 text-base font-semibold text-slate-900">160 Gwei</p>
                  </div>
                  <div className="rounded-[0.95rem] border border-slate-200/90 bg-white/90 p-3 sm:col-span-2 xl:col-span-1">
                    <p className="meta-label text-cyan">Target Cost</p>
                    <p className="mt-1.5 text-base font-semibold text-slate-900">About $0.01</p>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="soft-pill footer-note rounded-[1.1rem] px-3.5 py-2 text-xs">
          <p className="font-medium text-slate-900">Veero - move stablecoins instantly onchain.</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Compact, fast, and built for confident payments. Built by{" "}
            <a
              href="https://x.com/wyckoffweb"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900"
            >
              wyckoffweb
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
