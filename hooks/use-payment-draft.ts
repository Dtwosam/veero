"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { PaymentDraft } from "@/lib/payment-types";

const PAYMENT_DRAFT_STORAGE_KEY = "veero:payment-draft";

const EMPTY_DRAFT: PaymentDraft = {
  recipient: "",
  amount: "",
  note: "",
  updatedAt: "",
};

export function usePaymentDraft() {
  const { isReady, value, setValue } = useLocalStorage<PaymentDraft>(
    PAYMENT_DRAFT_STORAGE_KEY,
    EMPTY_DRAFT,
  );

  const hasDraft = useMemo(
    () => Boolean(value.recipient || value.amount || value.note),
    [value.amount, value.note, value.recipient],
  );

  function saveDraft(nextDraft: Omit<PaymentDraft, "updatedAt">) {
    setValue({
      ...nextDraft,
      updatedAt: new Date().toISOString(),
    });
  }

  function clearDraft() {
    setValue(EMPTY_DRAFT);
  }

  return {
    clearDraft,
    draft: value,
    hasDraft,
    isReady,
    saveDraft,
  };
}
