"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseGwei, parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { usePaymentHistory } from "@/hooks/use-payment-history";
import { useRecentRecipients } from "@/hooks/use-recent-recipients";
import { USDC_CONTRACT, usdcAbi } from "@/lib/payments";
import type { PendingPayment, SendPaymentInput, TxStage } from "@/lib/payment-types";
import { arcTestnet } from "@/lib/wagmi";

const ARC_MIN_BASE_FEE = parseGwei("160");
const ARC_DEFAULT_PRIORITY_FEE = parseGwei("10");
const ARC_DEFAULT_MAX_FEE = parseGwei("330");

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null) {
    const maybeShortMessage = "shortMessage" in error ? error.shortMessage : undefined;

    if (typeof maybeShortMessage === "string" && maybeShortMessage.length > 0) {
      return maybeShortMessage;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function isAlreadyConnectedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.toLowerCase().includes("connector already connected");
}

export function useArcPayment() {
  const queryClient = useQueryClient();
  const { addEntry } = usePaymentHistory();
  const { saveRecentRecipient } = useRecentRecipients();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const {
    error: writeError,
    isPending: isWriting,
    writeContractAsync,
  } = useWriteContract();
  const [submittedHash, setSubmittedHash] = useState<`0x${string}` | null>(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: submittedHash ?? undefined,
  });

  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [successAmount, setSuccessAmount] = useState<string | null>(null);
  const [successRecipient, setSuccessRecipient] = useState<`0x${string}` | null>(null);
  const [successRecipientName, setSuccessRecipientName] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [txStage, setTxStage] = useState<TxStage>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment>(null);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const lastStoredHashRef = useRef<`0x${string}` | null>(null);

  const connector = useMemo(() => {
    return (
      connectors.find((item) => item.type === "injected") ??
      connectors.find((item) => item.id === "injected") ??
      connectors[0]
    );
  }, [connectors]);
  const isWrongNetwork = isConnected && chainId !== arcTestnet.id;
  const isSubmitting = isConnecting || isSwitching || isWriting || isConfirming;

  useEffect(() => {
    if (!isSuccess || !submittedHash) {
      return;
    }

    if (lastStoredHashRef.current !== submittedHash && successAmount && successRecipient) {
      addEntry({
        id: `payment_${Date.now()}_${submittedHash.slice(-6)}`,
        timestamp: new Date().toISOString(),
        amount: successAmount,
        token: "USDC",
        recipient: successRecipient,
        recipientName: successRecipientName ?? undefined,
        note: successNote ?? undefined,
        transactionHash: submittedHash,
        status: "success",
      });
      saveRecentRecipient({
        address: successRecipient,
        label: successRecipientName ?? undefined,
      });
      lastStoredHashRef.current = submittedHash;
    }

    setTxStage("success");
    queryClient.invalidateQueries();
  }, [
    addEntry,
    isSuccess,
    queryClient,
    submittedHash,
    successAmount,
    successNote,
    successRecipient,
    successRecipientName,
    saveRecentRecipient,
  ]);

  useEffect(() => {
    if (isConfirming && submittedHash) {
      setTxStage("confirming");
      return;
    }

    if (isWriting && activeProductId) {
      setTxStage("wallet");
      return;
    }

    if ((isConnecting || isSwitching) && activeProductId) {
      setTxStage("preparing");
    }
  }, [activeProductId, isConfirming, isConnecting, isSwitching, isWriting, submittedHash]);

  useEffect(() => {
    if (!writeError) {
      return;
    }

    setTxStage("failed");
    setPaymentError(getErrorMessage(writeError, "Payment failed."));
    setPendingPayment(null);
  }, [writeError]);

  useEffect(() => {
    if (txStage !== "confirming" || !submittedHash || submittedAt === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTxStage("failed");
      setPaymentError(
        "Arc did not confirm this transaction in time. It may have been dropped before reaching the network.",
      );
    }, 90_000);

    return () => window.clearTimeout(timeoutId);
  }, [submittedAt, submittedHash, txStage]);

  useEffect(() => {
    if (
      !pendingPayment ||
      !isConnected ||
      chainId !== arcTestnet.id ||
      !address ||
      isWriting ||
      isConfirming
    ) {
      return;
    }

    void submitPayment(pendingPayment, address);
  }, [address, chainId, isConfirming, isConnected, isWriting, pendingPayment]);

  const explorerHref = useMemo(() => {
    if (!submittedHash) {
      return null;
    }

    return `${arcTestnet.blockExplorers.default.url}/tx/${submittedHash}`;
  }, [submittedHash]);

  const shortHash = useMemo(() => {
    if (!submittedHash) {
      return null;
    }

    return `${submittedHash.slice(0, 6)}...${submittedHash.slice(-4)}`;
  }, [submittedHash]);

  const showSuccessOverlay = Boolean(isSuccess && submittedHash && successAmount);
  const isConfirmationDelayed =
    txStage === "confirming" &&
    submittedAt !== null &&
    Date.now() - submittedAt > 45_000;
  const statusLabel =
    txStage === "preparing"
      ? "Preparing payment..."
      : txStage === "wallet"
        ? "Waiting for wallet confirmation..."
        : txStage === "confirming"
          ? "Sending on Arc..."
          : txStage === "success"
            ? "Confirmed"
            : txStage === "failed"
              ? "Failed"
            : null;

  async function submitPayment(input: SendPaymentInput, accountAddress: `0x${string}`) {
    setPendingPayment(null);
    setActiveProductId("send-payment");
    setSuccessAmount(input.amount);
    setSuccessRecipient(input.recipient);
    setSuccessRecipientName(input.recipientName ?? null);
    setSuccessNote(input.note ?? null);
    setSubmittedHash(null);
    setTxStage("wallet");

    const estimatedFees = await publicClient?.estimateFeesPerGas();
    const estimatedMaxFee = estimatedFees?.maxFeePerGas ?? estimatedFees?.gasPrice;
    const estimatedPriorityFee =
      estimatedFees?.maxPriorityFeePerGas ?? ARC_DEFAULT_PRIORITY_FEE;
    const maxFeePerGas =
      estimatedMaxFee && estimatedMaxFee > ARC_MIN_BASE_FEE
        ? estimatedMaxFee
        : ARC_DEFAULT_MAX_FEE;
    const maxPriorityFeePerGas =
      estimatedPriorityFee > ARC_DEFAULT_PRIORITY_FEE
        ? estimatedPriorityFee
        : ARC_DEFAULT_PRIORITY_FEE;

    const nextSubmittedHash = await writeContractAsync({
      address: USDC_CONTRACT,
      abi: usdcAbi,
      functionName: "transfer",
      args: [input.recipient, parseUnits(input.amount, arcTestnet.nativeCurrency.decimals)],
      chainId: arcTestnet.id,
      account: accountAddress,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    if (nextSubmittedHash) {
      setSubmittedHash(nextSubmittedHash);
      setSubmittedAt(Date.now());
      setTxStage("confirming");
    }
  }

  async function handlePay(input: SendPaymentInput) {
    setSuccessAmount(null);
    setSuccessRecipient(null);
    setSuccessRecipientName(null);
    setSuccessNote(null);
    setSubmittedHash(null);
    setSubmittedAt(null);
    setTxStage(null);
    setPaymentError(null);
    setActiveProductId("send-payment");
    setPendingPayment(null);

    try {
      let accountAddress = address;
      let currentChainId = chainId;

      if (!isConnected) {
        setTxStage("preparing");

        if (!connector) {
          throw new Error("No wallet was found. Open a browser wallet and try again.");
        }

        try {
          const connected = await connectAsync({ connector });
          accountAddress = connected.accounts[0];
          currentChainId = connected.chainId;
        } catch (connectError) {
          if (!isAlreadyConnectedError(connectError)) {
            throw connectError;
          }

          await disconnectAsync();

          const connected = await connectAsync({ connector });
          accountAddress = connected.accounts[0];
          currentChainId = connected.chainId;
        }
      }

      if (currentChainId !== arcTestnet.id) {
        setTxStage("preparing");
        setPendingPayment(input);
        await switchChainAsync({ chainId: arcTestnet.id });
        return;
      }

      if (!accountAddress) {
        throw new Error("Wallet address unavailable. Reconnect and try again.");
      }

      await submitPayment(input, accountAddress);
    } catch (error) {
      setTxStage("failed");
      setPendingPayment(null);

      const message = getErrorMessage(
        error,
        "Something interrupted the payment before it could complete.",
      );

      if (!/user rejected|rejected the request|denied/i.test(message)) {
        setPaymentError(message);
      }
    }
  }

  function resetSuccessState() {
    setActiveProductId(null);
    setSuccessAmount(null);
    setSuccessRecipient(null);
    setSuccessRecipientName(null);
    setSuccessNote(null);
    setSubmittedHash(null);
    setSubmittedAt(null);
    setTxStage(null);
    setPaymentError(null);
    setPendingPayment(null);
    lastStoredHashRef.current = null;
  }

  function clearPaymentError() {
    setPaymentError(null);
  }

  return {
    activeProductId,
    clearPaymentError,
    explorerHref,
    handlePay,
    isConnected,
    isSubmitting,
    isWrongNetwork,
    paymentError,
    resetSuccessState,
    shortHash,
    showSuccessOverlay,
    submittedHash,
    successNote,
    successRecipientName,
    statusLabel,
    successAmount,
    successRecipient,
    isConfirmationDelayed,
    txStage,
  };
}
