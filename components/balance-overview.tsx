"use client";

import { MetricCard } from "@/components/metric-card";
import { arcTestnet } from "@/lib/wagmi";
import { formatUnits, parseAbi } from "viem";
import { useAccount, useChainId, useEstimateFeesPerGas, useReadContracts } from "wagmi";

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const TOKENS = {
  usdc: {
    label: "USDC Balance",
    description: "Ready to spend",
    address: "0x3600000000000000000000000000000000000000" as const,
    accent: "linear-gradient(90deg, #7CF2C3 0%, #79D7FF 100%)",
  },
  eurc: {
    label: "EURC Balance",
    description: "Available in wallet",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as const,
    accent: "linear-gradient(90deg, #EDE6D6 0%, #79D7FF 100%)",
  },
} as const;

function formatTokenBalance(balance: bigint, decimals: number) {
  const formatted = Number(formatUnits(balance, decimals));

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: formatted >= 1000 ? 2 : 4,
  }).format(formatted);
}

function formatNativeGasValue(value?: bigint) {
  if (value === undefined) {
    return "--";
  }

  const formatted = Number(formatUnits(value, arcTestnet.nativeCurrency.decimals));

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: formatted >= 1 ? 4 : 6,
  }).format(formatted);
}

function getTokenState(args: {
  isConnected: boolean;
  isArcTestnet: boolean;
  balance?: bigint;
  decimals?: number;
  description: string;
}) {
  const { isConnected, isArcTestnet, balance, decimals, description } = args;

  if (!isConnected) {
    return {
      value: "Nothing here yet",
      caption: "",
    };
  }

  if (!isArcTestnet) {
    return {
      value: "--",
      caption: "",
    };
  }

  if (balance === undefined || decimals === undefined) {
    return {
      value: "Loading...",
      caption: "",
    };
  }

  if (balance === BigInt(0)) {
    return {
      value: "No balance yet",
      caption: description,
    };
  }

  return {
    value: formatTokenBalance(balance, decimals),
    caption: description,
  };
}

export function BalanceOverview() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isArcTestnet = chainId === arcTestnet.id;
  const shouldReadBalances = Boolean(address) && isArcTestnet;

  const { data: tokenReads } = useReadContracts({
    allowFailure: false,
    contracts: shouldReadBalances
      ? [
          {
            address: TOKENS.usdc.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address!],
            chainId: arcTestnet.id,
          },
          {
            address: TOKENS.usdc.address,
            abi: erc20Abi,
            functionName: "decimals",
            chainId: arcTestnet.id,
          },
          {
            address: TOKENS.eurc.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address!],
            chainId: arcTestnet.id,
          },
          {
            address: TOKENS.eurc.address,
            abi: erc20Abi,
            functionName: "decimals",
            chainId: arcTestnet.id,
          },
        ]
      : [],
    query: {
      enabled: shouldReadBalances,
      refetchInterval: 15000,
    },
  });

  const { data: gasInfo } = useEstimateFeesPerGas({
    chainId: arcTestnet.id,
    query: {
      enabled: isArcTestnet,
      refetchInterval: 15000,
    },
  });

  const usdc = getTokenState({
    isConnected,
    isArcTestnet,
    balance: tokenReads?.[0],
    decimals: tokenReads?.[1],
    description: TOKENS.usdc.description,
  });

  const eurc = getTokenState({
    isConnected,
    isArcTestnet,
    balance: tokenReads?.[2],
    decimals: tokenReads?.[3],
    description: TOKENS.eurc.description,
  });

  const gasValue =
    gasInfo?.formatted?.gasPrice ??
    `${formatNativeGasValue(gasInfo?.gasPrice)} ${arcTestnet.nativeCurrency.symbol}`;

  return (
    <section className="section-frame balance-section fade-up-soft stagger-1 rounded-[1.2rem] p-3 sm:p-3.5">
      <div className="relative z-10">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-kicker text-cyan">Balances</p>
            <h2 className="mt-1.5 text-[1.1rem] font-semibold tracking-[-0.05em] text-slate-900 sm:text-[1.2rem]">
              Your money, in view
            </h2>
          </div>
        </div>

        <div className="mt-2.5 grid gap-2 sm:mt-3 xl:grid-cols-3">
          <MetricCard
            label={TOKENS.usdc.label}
            value={usdc.value}
            caption={usdc.caption}
            accent={TOKENS.usdc.accent}
          />
          <MetricCard
            label={TOKENS.eurc.label}
            value={eurc.value}
            caption={eurc.caption}
            accent={TOKENS.eurc.accent}
          />
          <MetricCard
            label="Gas, but stable"
            value={isArcTestnet ? gasValue : "--"}
            caption={isArcTestnet ? "Stablecoins are part of the core Arc experience." : ""}
            accent="linear-gradient(90deg, #79D7FF 0%, #7CF2C3 100%)"
          />
        </div>
      </div>
    </section>
  );
}
