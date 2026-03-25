"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { RecentRecipient } from "@/lib/payment-types";

const RECENT_RECIPIENTS_STORAGE_KEY = "veero:recent-recipients";

export function useRecentRecipients() {
  const { isReady, value, setValue } = useLocalStorage<RecentRecipient[]>(
    RECENT_RECIPIENTS_STORAGE_KEY,
    [],
  );

  const recipients = useMemo(
    () =>
      [...value]
        .sort(
          (a, b) =>
            new Date(b.lastPaidAt).getTime() - new Date(a.lastPaidAt).getTime(),
        )
        .slice(0, 8),
    [value],
  );

  function saveRecentRecipient(input: {
    address: `0x${string}`;
    label?: string;
  }) {
    setValue((currentRecipients) => {
      const normalizedAddress = input.address.toLowerCase();
      const nextRecipient: RecentRecipient = {
        id: `recent_${normalizedAddress}`,
        address: input.address,
        label: input.label,
        lastPaidAt: new Date().toISOString(),
      };

      const remainingRecipients = currentRecipients.filter(
        (recipient) => recipient.address.toLowerCase() !== normalizedAddress,
      );

      return [nextRecipient, ...remainingRecipients].slice(0, 8);
    });
  }

  function hasRecipient(address: string) {
    return recipients.some(
      (recipient) => recipient.address.toLowerCase() === address.trim().toLowerCase(),
    );
  }

  return {
    hasRecipient,
    isReady,
    recipients,
    saveRecentRecipient,
  };
}
