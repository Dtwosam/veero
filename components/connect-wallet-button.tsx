"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { arcTestnet } from "@/lib/wagmi";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "We couldn't open your wallet. Try again and approve the request there.";
}

function isAlreadyConnectedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.toLowerCase().includes("connector already connected");
}

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [connectError, setConnectError] = useState<string | null>(null);
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const connector = useMemo(() => {
    return (
      connectors.find((item) => item.type === "injected") ??
      connectors.find((item) => item.id === "injected") ??
      connectors[0]
    );
  }, [connectors]);

  async function handleConnect() {
    if (!connector || isPending) {
      return;
    }

    setConnectError(null);

    try {
      await connectAsync({ connector });
    } catch (error) {
      if (isAlreadyConnectedError(error)) {
        try {
          await disconnectAsync();
          await connectAsync({ connector });
          return;
        } catch (retryError) {
          setConnectError(getErrorMessage(retryError));
          return;
        }
      }

      setConnectError(getErrorMessage(error));
    }
  }

  if (isConnected && address) {
    const isArcTestnet = chainId === arcTestnet.id;

    return (
      <div className="wallet-transition wallet-connect-celebrate flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <span
          className={`wallet-status rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] ${
            isArcTestnet
              ? "wallet-status-live border-aqua/30 bg-gradient-to-r from-aqua/18 via-cyan/14 to-violet/14 text-teal-700 shadow-[0_0_0_1px_rgba(69,230,209,0.06)]"
              : "wallet-status-warn border-coral/30 bg-gradient-to-r from-coral/18 via-blush/14 to-violet/12 text-rose-700 shadow-[0_0_0_1px_rgba(255,142,109,0.06)]"
          }`}
        >
          {isArcTestnet ? "Arc Testnet" : "Wrong Network"}
        </span>
        <button
          onClick={() => void disconnectAsync()}
          className="action-pill action-quiet wallet-transition"
        >
          {formatAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-transition flex flex-col items-start gap-2 sm:items-end">
      <button
        onClick={() => void handleConnect()}
        className={`action-pill action-primary wallet-transition ${isPending ? "button-busy" : ""}`}
        disabled={!connector || isPending}
      >
        {isPending ? "Opening wallet..." : connector ? "Connect wallet" : "Wallet unavailable"}
      </button>
      {connectError ? (
        <p className="max-w-[18rem] text-xs leading-5 text-rose-600 sm:text-right">
          {connectError}
        </p>
      ) : null}
    </div>
  );
}
