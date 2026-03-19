"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { PaymentHistoryEntry } from "@/lib/payment-types";

const PAYMENT_HISTORY_STORAGE_KEY = "arclens:payment-history";

export function usePaymentHistory() {
  const { isReady, value, setValue } = useLocalStorage<PaymentHistoryEntry[]>(
    PAYMENT_HISTORY_STORAGE_KEY,
    [],
  );

  function getEntryTimestamp(entry: PaymentHistoryEntry) {
    const legacyEntry = entry as PaymentHistoryEntry & { createdAt?: string };
    return legacyEntry.timestamp ?? legacyEntry.createdAt ?? "";
  }

  const history = useMemo(
    () =>
      [...value].sort(
        (a, b) =>
          new Date(getEntryTimestamp(b)).getTime() -
          new Date(getEntryTimestamp(a)).getTime(),
      ),
    [value],
  );

  function addEntry(entry: PaymentHistoryEntry) {
    setValue((currentEntries) => [entry, ...currentEntries].slice(0, 25));
  }

  function clearHistory() {
    setValue([]);
  }

  return {
    addEntry,
    clearHistory,
    history,
    isReady,
  };
}
