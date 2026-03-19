type MetricCardProps = {
  label: string;
  value: string;
  caption: string;
  accent: string;
};

export function MetricCard({ label, value, caption, accent }: MetricCardProps) {
  const isEmpty = value === "--";
  const isLoading = value === "Loading...";
  const isWalletDisconnected = value === "Nothing here yet";
  const isNoBalance = value === "No balance yet";
  const isReady = !isEmpty && !isLoading && !isWalletDisconnected && !isNoBalance;
  const stateLabel = isLoading ? "Loading" : isEmpty ? "Unavailable" : isWalletDisconnected ? "Connect" : isNoBalance ? "Empty" : "Live";
  const isBalanceCard = label.includes("Balance");
  const tokenSymbol = label.startsWith("USDC") ? "USDC" : label.startsWith("EURC") ? "EURC" : "GAS";
  const tokenMark = tokenSymbol === "USDC" ? "$" : tokenSymbol === "EURC" ? "E" : "G";
  const tokenTone =
    tokenSymbol === "USDC"
      ? "from-cyan/10 via-white/70 to-white/90"
      : tokenSymbol === "EURC"
        ? "from-violet/10 via-white/70 to-white/90"
        : "from-slate-100 via-white/85 to-white/95";

  return (
    <div
      className={`panel panel-hover metric-shell rounded-[1.1rem] p-3 sm:p-3.5 ${
        isBalanceCard ? "balance-widget overflow-hidden rounded-[1.2rem] p-3 sm:p-3.5" : ""
      } ${isLoading ? "loading-shimmer" : ""} ${isReady && isBalanceCard ? "balance-success-pop" : ""}`}
      data-state={isLoading ? "loading" : isReady ? "ready" : "idle"}
      data-token={tokenSymbol.toLowerCase()}
    >
      {isBalanceCard ? (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br ${tokenTone} opacity-100`} />
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-white/55 via-white/15 to-transparent" />
        </>
      ) : null}
      <div
        className={`absolute rounded-full opacity-40 blur-2xl ${isBalanceCard ? "-right-10 top-2 h-28 w-28" : "-right-8 top-0 h-20 w-20"}`}
        style={{ background: accent }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {isBalanceCard ? (
              <div className="flex items-center gap-2.5">
                <div className="token-orb">
                  <span>{tokenMark}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="meta-label">{tokenSymbol}</p>
                  </div>
                  <p className="mt-1 text-[12px] font-normal text-slate-500">
                    {isWalletDisconnected ? "Connect your wallet to see this balance" : isLoading ? "Loading balances..." : caption}
                  </p>
                </div>
              </div>
            ) : (
              <p className="meta-label">{label}</p>
            )}
            <p
              className={`${
                isBalanceCard ? "mt-3 text-[1.8rem] leading-none sm:text-[2.15rem]" : "mt-2 text-[1.4rem] sm:text-[1.55rem]"
              } font-semibold tracking-[-0.06em] ${
                isEmpty ? "text-slate-400" : "text-slate-900"
              } ${isReady && isBalanceCard ? "value-rise" : ""}`}
            >
              {value}
            </p>
            {isBalanceCard ? (
              <div className="mt-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-slate-400">
                <span>{label}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>Arc Testnet</span>
              </div>
            ) : null}
          </div>
          <div
            className={`badge-pop ${isBalanceCard ? "shrink-0 bg-white/90" : ""} ${
              isReady ? "status-live" : isLoading ? "status-sync" : ""
            }`}
          >
            {stateLabel}
          </div>
        </div>
        {isBalanceCard ? (
          <div className="metric-footer mt-3 flex items-center justify-between gap-3 rounded-[0.8rem] border border-slate-200/80 bg-white/60 px-2.5 py-1.5 backdrop-blur-md">
            <div>
              <p className="meta-label">Status</p>
              <p className="mt-1 text-[12px] font-normal text-slate-600">
                {isReady ? "Ready to spend and send" : isWalletDisconnected ? "Connect your wallet to load this balance" : isNoBalance ? "No balance yet" : isLoading ? "Loading balances..." : "Switch to Arc to view the right balance"}
              </p>
            </div>
            <div className="rounded-full bg-slate-100/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
              {tokenSymbol}
            </div>
          </div>
        ) : (
          <div className="mt-2.5">
            <p className="max-w-xs text-[13px] leading-5 text-slate-500">{caption}</p>
          </div>
        )}
      </div>
    </div>
  );
}
