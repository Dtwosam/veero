"use client";

import { useMemo, useState } from "react";
import { formatUnits, isAddress, parseUnits } from "viem";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { useArcPayment } from "@/hooks/use-arc-payment";
import { useSavedContacts } from "@/hooks/use-saved-contacts";
import type { SavedContact } from "@/lib/payment-types";
import { USDC_CONTRACT, usdcAbi } from "@/lib/payments";
import { arcTestnet } from "@/lib/wagmi";

type FormErrors = {
  amount?: string;
  contactAddress?: string;
  contactName?: string;
  recipient?: string;
};

const CONTACT_EMOJI_OPTIONS = [
  "\u{1F642}",
  "\u{1F4B8}",
  "\u2728",
  "\u{1F7E2}",
  "\u{1F9E1}",
  "\u{1F30A}",
];

function createContactId() {
  return `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatUsdcBalance(balance?: bigint, decimals?: number) {
  if (balance === undefined || decimals === undefined) {
    return "--";
  }

  const formatted = Number(formatUnits(balance, decimals));

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: formatted >= 1000 ? 2 : 4,
    minimumFractionDigits: 0,
  }).format(formatted);
}

function shortAddress(address?: string | null) {
  if (!address) {
    return "--";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function PayflowSection() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isArcTestnet = chainId === arcTestnet.id;
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");
  const [hasTriedReview, setHasTriedReview] = useState(false);
  const [hasTouchedRecipient, setHasTouchedRecipient] = useState(false);
  const [hasTouchedAmount, setHasTouchedAmount] = useState(false);
  const [isContactEditorOpen, setIsContactEditorOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactEmoji, setContactEmoji] = useState(CONTACT_EMOJI_OPTIONS[0]);

  const {
    activeProductId,
    clearPaymentError,
    explorerHref,
    handlePay,
    isSubmitting,
    isWrongNetwork,
    paymentError,
    resetSuccessState,
    shortHash,
    showSuccessOverlay,
    statusLabel,
    successAmount,
    successNote,
    successRecipient,
    successRecipientName,
    txStage,
  } = useArcPayment();
  const {
    contacts,
    hasDuplicateAddress,
    isReady: areContactsReady,
    removeContact,
    saveContact,
  } = useSavedContacts();

  const shouldReadBalance = Boolean(address) && isArcTestnet;
  const selectedContact = useMemo(
    () =>
      contacts.find(
        (contact) => contact.address.toLowerCase() === recipient.trim().toLowerCase(),
      ) ?? null,
    [contacts, recipient],
  );

  const { data: usdcReads } = useReadContracts({
    allowFailure: false,
    contracts: shouldReadBalance
      ? [
          {
            address: USDC_CONTRACT,
            abi: usdcAbi,
            functionName: "balanceOf",
            args: [address!],
            chainId: arcTestnet.id,
          },
          {
            address: USDC_CONTRACT,
            abi: usdcAbi,
            functionName: "decimals",
            chainId: arcTestnet.id,
          },
        ]
      : [],
    query: {
      enabled: shouldReadBalance,
      refetchInterval: 15000,
    },
  });

  const availableBalance = usdcReads?.[0];
  const usdcDecimals = usdcReads?.[1];
  const estimatedRemainingBalance = useMemo(() => {
    if (!amount.trim() || availableBalance === undefined || usdcDecimals === undefined) {
      return null;
    }

    try {
      const parsedAmount = parseUnits(amount.trim(), usdcDecimals);

      if (parsedAmount > availableBalance) {
        return null;
      }

      return availableBalance - parsedAmount;
    } catch {
      return null;
    }
  }, [amount, availableBalance, usdcDecimals]);

  const errors = useMemo<FormErrors>(() => {
    const nextErrors: FormErrors = {};
    const trimmedRecipient = recipient.trim();
    const trimmedAmount = amount.trim();

    if (!trimmedRecipient) {
      nextErrors.recipient = "That wallet address doesn't look right. Double-check it and try again.";
    } else if (!isAddress(trimmedRecipient)) {
      nextErrors.recipient = "That wallet address doesn't look right. Double-check it and try again.";
    } else if (address && trimmedRecipient.toLowerCase() === address.toLowerCase()) {
      nextErrors.recipient = "You can't send a payment to your own wallet here.";
    }

    if (!trimmedAmount) {
      nextErrors.amount = "Enter an amount to continue.";
    } else {
      const numericAmount = Number(trimmedAmount);

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        nextErrors.amount = "Enter a valid amount greater than zero.";
      } else if (availableBalance !== undefined && usdcDecimals !== undefined) {
        try {
          const parsedAmount = parseUnits(trimmedAmount, usdcDecimals);

          if (parsedAmount > availableBalance) {
            nextErrors.amount = "You don't have enough USDC for this payment.";
          }
        } catch {
          nextErrors.amount = "Enter a valid amount greater than zero.";
        }
      }
    }

    if (isContactEditorOpen) {
      const trimmedContactName = contactName.trim();
      const trimmedContactAddress = contactAddress.trim();

      if (!trimmedContactName) {
        nextErrors.contactName = "Add a name for this contact.";
      }

      if (!trimmedContactAddress) {
        nextErrors.contactAddress = "Enter a valid wallet address to save this contact.";
      } else if (!isAddress(trimmedContactAddress)) {
        nextErrors.contactAddress = "Enter a valid wallet address to save this contact.";
      } else if (hasDuplicateAddress(trimmedContactAddress, editingContactId ?? undefined)) {
        nextErrors.contactAddress = "That address is already saved.";
      }
    }

    return nextErrors;
  }, [
    amount,
    availableBalance,
    contactAddress,
    contactName,
    editingContactId,
    hasDuplicateAddress,
    isContactEditorOpen,
    recipient,
    usdcDecimals,
  ]);

  const hasErrors = Boolean(errors.amount || errors.recipient);
  const reviewDisabled =
    isSubmitting ||
    hasErrors ||
    !isConnected ||
    isWrongNetwork ||
    !recipient.trim() ||
    !amount.trim();
  const showPendingState =
    activeProductId === "send-payment" &&
    (txStage === "preparing" || txStage === "wallet" || txStage === "confirming");

  function handleReview() {
    setHasTriedReview(true);

    if (reviewDisabled) {
      return;
    }

    setStep("review");
  }

  async function handleSubmit() {
    if (reviewDisabled || !isAddress(recipient.trim())) {
      return;
    }

    await handlePay({
      amount: amount.trim(),
      note: note.trim() || undefined,
      recipient: recipient.trim() as `0x${string}`,
      recipientName: selectedContact?.name,
    });
  }

  function handleResetAfterSuccess() {
    resetSuccessState();
    setRecipient("");
    setAmount("");
    setNote("");
    setStep("form");
    setHasTriedReview(false);
    setHasTouchedRecipient(false);
    setHasTouchedAmount(false);
  }

  function openNewContactEditor() {
    setEditingContactId(null);
    setContactName("");
    setContactAddress(recipient.trim());
    setContactEmoji(CONTACT_EMOJI_OPTIONS[0]);
    setIsContactEditorOpen(true);
  }

  function openEditContactEditor(contact: SavedContact) {
    setEditingContactId(contact.id);
    setContactName(contact.name);
    setContactAddress(contact.address);
    setContactEmoji(contact.emoji || CONTACT_EMOJI_OPTIONS[0]);
    setIsContactEditorOpen(true);
  }

  function closeContactEditor() {
    setEditingContactId(null);
    setContactName("");
    setContactAddress("");
    setContactEmoji(CONTACT_EMOJI_OPTIONS[0]);
    setIsContactEditorOpen(false);
  }

  function handleSelectContact(contact: SavedContact) {
    setRecipient(contact.address);
    setHasTouchedRecipient(true);
  }

  const showRecipientError = Boolean(errors.recipient) && (hasTouchedRecipient || hasTriedReview);
  const showAmountError = Boolean(errors.amount) && (hasTouchedAmount || hasTriedReview);

  function handleSaveContact() {
    if (errors.contactAddress || errors.contactName || !isAddress(contactAddress.trim())) {
      return;
    }

    saveContact({
      address: contactAddress.trim() as `0x${string}`,
      emoji: contactEmoji,
      id: editingContactId ?? createContactId(),
      name: contactName.trim(),
    });

    if (!recipient.trim()) {
      setRecipient(contactAddress.trim());
    }

    closeContactEditor();
  }

  return (
    <section className="section-frame payflow-surface fade-up-soft stagger-2 relative overflow-hidden rounded-[1.45rem] p-3.5 sm:p-4">
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-cyan/16 via-violet/10 to-coral/14" />
      <div className="absolute -left-12 top-8 h-24 w-24 rounded-full bg-cyan/16 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-violet/14 blur-3xl" />
      <div className="relative z-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker text-cyan">Veero Pay</p>
            <h2 className="section-title mt-2 text-[1.3rem] text-slate-900 sm:text-[1.45rem]">
              Send money
            </h2>
            <p className="mt-1.5 max-w-lg text-[12px] leading-5 text-slate-500">
              Fast, simple, and stablecoin-first
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 lg:grid-cols-[minmax(0,1.08fr)_250px]">
          <div
            className={`payflow-card fade-up-soft rounded-[1.35rem] bg-gradient-to-br from-white/90 via-violet/10 to-cyan/12 p-3.5 sm:p-4 ${
              showPendingState ? "loading-shimmer payflow-card-pending" : ""
            }`}
          >
            <div className="payflow-card-glow" />
            {statusLabel ? (
              <div>
                <div className={`payflow-status payflow-status-${txStage}`} aria-live="polite">
                  <span className="payflow-status-dot" />
                  {statusLabel}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {txStage === "confirming" ? "Finalizing payment..." : "This usually only takes a moment."}
                </p>
              </div>
            ) : null}

            <div className="payflow-icon payflow-icon-small">$</div>

            {step === "form" ? (
              <div className="relative z-10">
                <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
                    1 Recipient
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="rounded-full bg-slate-100 px-2 py-1">2 Amount</span>
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="rounded-full bg-slate-100 px-2 py-1">3 Review</span>
                </div>

                <div className="rounded-[1rem] border border-white/70 bg-white/78 px-3 py-3 shadow-[0_12px_26px_rgba(107,88,145,0.06)] sm:px-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="meta-label">Your money, in view</p>
                      <p className="mt-1 text-[1.4rem] font-semibold tracking-[-0.06em] text-slate-900 sm:text-[1.65rem]">
                        {formatUsdcBalance(availableBalance, usdcDecimals)}
                      </p>
                    </div>
                    <div className="rounded-full border border-slate-200/90 bg-slate-50/90 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                      USDC
                    </div>
                  </div>
                </div>

                <div className="mt-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="meta-label">Recipient</p>
                    <button
                      type="button"
                      onClick={selectedContact ? () => openEditContactEditor(selectedContact) : openNewContactEditor}
                      className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:text-slate-900"
                    >
                      {selectedContact ? "Edit" : "Add contact"}
                    </button>
                  </div>
                  <input
                    value={recipient}
                    onChange={(event) => {
                      setRecipient(event.target.value);
                      setHasTouchedRecipient(true);
                    }}
                    placeholder="Paste wallet address or choose a saved contact"
                    disabled={isSubmitting}
                    className="mt-1.5 w-full rounded-[0.85rem] border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan/20 focus:ring-2 focus:ring-cyan/8 disabled:opacity-70"
                  />
                  {showRecipientError ? (
                    <div className="payflow-state-error mt-2 rounded-[1rem] px-3 py-2 text-sm text-rose-700">
                      {errors.recipient}
                    </div>
                  ) : null}
                  {selectedContact ? (
                    <div className="contact-active-shell mt-2.5 rounded-[0.95rem] border border-slate-200 bg-slate-50/85 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-[0.9rem] bg-white/85 text-base shadow-[0_10px_22px_rgba(107,88,145,0.08)]">
                            {selectedContact.emoji || "\u{1F642}"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              Paying {selectedContact.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {selectedContact.address}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">Saved</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="payflow-input-shell mt-2.5 rounded-[1rem] border border-white/70 bg-white/74 px-3 py-3 shadow-[0_12px_26px_rgba(107,88,145,0.06)] sm:px-3.5 sm:py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="meta-label">Amount</p>
                    <span className="text-[11px] font-medium text-slate-400">USDC</span>
                  </div>
                  <div className="mt-2.5 flex items-end gap-3">
                    <input
                      value={amount}
                      onChange={(event) => {
                        setAmount(event.target.value);
                        setHasTouchedAmount(true);
                      }}
                      placeholder="0.00"
                      inputMode="decimal"
                      disabled={isSubmitting}
                      className="min-w-0 flex-1 bg-transparent text-[1.85rem] font-semibold tracking-[-0.08em] text-slate-900 outline-none placeholder:text-slate-300 sm:text-[2.15rem] disabled:opacity-70"
                    />
                    <span className="pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      USDC
                    </span>
                  </div>
                  {showAmountError ? (
                    <div className="payflow-state-error mt-3 rounded-[1rem] px-3 py-2 text-sm text-rose-700">
                      {errors.amount}
                    </div>
                  ) : (
                    <p className="mt-2.5 text-[12px] text-slate-400">
                      {availableBalance === undefined ? "Loading balances..." : `Available balance: ${formatUsdcBalance(availableBalance, usdcDecimals)} USDC`}
                    </p>
                  )}
                </div>

                <div className="mt-2">
                  <p className="meta-label">Add a note</p>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="What is this payment for?"
                    rows={1}
                    disabled={isSubmitting}
                    className="mt-1.5 w-full resize-none rounded-[0.85rem] border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan/30 focus:ring-2 focus:ring-cyan/10 disabled:opacity-70"
                  />
                </div>

                {paymentError ? (
                  <div className="payflow-state-error mt-3 rounded-[1rem] border border-coral/20 bg-white px-4 py-3 text-sm text-rose-700">
                    <p className="font-semibold text-slate-900">Payment failed</p>
                    <p className="mt-1 text-sm text-rose-700">Something interrupted the payment. Nothing was sent.</p>
                    <p className="mt-2 text-xs text-slate-600">{paymentError}</p>
                    <p className="mt-1 text-xs text-slate-500">Check your wallet, network, and balance, then retry.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => clearPaymentError()}
                        className="action-pill action-primary"
                      >
                        Try again
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep("form")}
                        className="action-pill action-secondary"
                      >
                        Go back
                      </button>
                    </div>
                  </div>
                ) : null}

                {isWrongNetwork ? (
                  <div className="payflow-state-warn mt-3 rounded-[1rem] border border-coral/20 bg-white px-4 py-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Wrong network</p>
                    <p className="mt-1">Veero is built for Arc. Switch to see the right balances and payment flow.</p>
                    <p className="mt-2 text-xs text-slate-500">Once you switch, everything updates automatically.</p>
                  </div>
                ) : null}

                <div className="payflow-action-bar mt-3.5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={handleReview}
                    disabled={reviewDisabled}
                    className="action-pill action-primary payflow-button payflow-button-ripple disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Processing..." : "Review payment"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="rounded-[1rem] border border-white/70 bg-white/80 px-3.5 py-3.5 shadow-[0_12px_26px_rgba(107,88,145,0.06)] sm:px-4">
                  <p className="meta-label">Review payment</p>
                  <p className="mt-2 text-[1.7rem] font-semibold tracking-[-0.08em] text-slate-900 sm:text-[1.95rem]">
                    {amount.trim()} <span className="text-slate-400">USDC</span>
                  </p>
                  <p className="mt-1.5 text-[13px] text-slate-500">
                    Check the recipient and amount, then confirm.
                  </p>
                  <div className="soft-divider mt-4" />
                </div>

                <div className="mt-2.5 grid gap-2">
                  <div className="rounded-[0.9rem] border border-slate-200 bg-white/75 px-3.5 py-3">
                    <p className="meta-label">To</p>
                    {selectedContact ? (
                      <>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {selectedContact.emoji ? `${selectedContact.emoji} ` : ""}
                          {selectedContact.name}
                        </p>
                        <p className="mt-1 break-all text-[12px] text-slate-400">
                          {selectedContact.address}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 break-all text-base font-medium text-slate-900">
                        {recipient.trim()}
                      </p>
                    )}
                  </div>
                  <div className="rounded-[0.9rem] border border-slate-200 bg-white/75 px-3.5 py-3">
                    <p className="meta-label">Amount</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.05em] text-slate-900">{amount.trim()} USDC</p>
                  </div>
                  <div className="rounded-[0.9rem] border border-slate-200 bg-white/75 px-3.5 py-2.5">
                    <p className="meta-label">Network</p>
                    <p className="mt-2 text-[13px] font-medium text-slate-700">
                      Arc Testnet
                    </p>
                    {estimatedRemainingBalance !== null ? (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatUsdcBalance(estimatedRemainingBalance, usdcDecimals)} USDC after this payment
                      </p>
                    ) : null}
                  </div>
                  {note.trim() ? (
                    <div className="rounded-[0.9rem] border border-slate-200 bg-white/75 px-3.5 py-2.5">
                      <p className="meta-label">Note</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{note.trim()}</p>
                    </div>
                  ) : null}
                </div>

                {paymentError ? (
                  <div className="payflow-state-error mt-3 rounded-[1rem] border border-coral/20 bg-white px-4 py-3 text-sm text-rose-700">
                    <p className="font-semibold text-slate-900">Payment failed</p>
                    <p className="mt-1 text-sm text-rose-700">Something interrupted the payment. Nothing was sent.</p>
                    <p className="mt-2 text-xs text-slate-600">{paymentError}</p>
                    <p className="mt-1 text-xs text-slate-500">Check your wallet, network, and balance, then retry.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        className="action-pill action-primary"
                      >
                        Try again
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearPaymentError();
                          setStep("form");
                        }}
                        className="action-pill action-secondary"
                      >
                        Go back
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="payflow-action-bar mt-3.5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => setStep("form")}
                    disabled={isSubmitting}
                    className="action-pill action-secondary payflow-button payflow-button-ripple disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting}
                    className="action-pill action-primary payflow-button payflow-button-ripple disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Confirming..." : "Confirm and send"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="grid gap-2.5">
            {isContactEditorOpen ? (
              <div className="panel rounded-[1rem] bg-white/82 p-3 sm:p-3.5">
                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-3">
                    <p className="meta-label">Saved contacts</p>
                    <button
                      type="button"
                      onClick={closeContactEditor}
                      className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:text-slate-900"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-3">
                    <p className="meta-label">Name</p>
                    <input
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder="e.g. Tobi"
                      className="mt-2 w-full rounded-[0.85rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan/30 focus:ring-2 focus:ring-cyan/10"
                    />
                    {errors.contactName ? (
                      <div className="payflow-state-error mt-2 rounded-[1rem] px-3 py-2 text-sm text-rose-700">
                        {errors.contactName}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <p className="meta-label">Wallet address</p>
                    <input
                      value={contactAddress}
                      onChange={(event) => setContactAddress(event.target.value)}
                      placeholder="Paste wallet address"
                      className="mt-2 w-full rounded-[0.85rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan/30 focus:ring-2 focus:ring-cyan/10"
                    />
                    {errors.contactAddress ? (
                      <div className="payflow-state-error mt-2 rounded-[1rem] px-3 py-2 text-sm text-rose-700">
                        {errors.contactAddress}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <p className="meta-label">Emoji or icon</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CONTACT_EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setContactEmoji(emoji)}
                          className={`flex h-10 w-10 items-center justify-center rounded-[0.9rem] border text-base transition ${
                            contactEmoji === emoji
                              ? "border-cyan/40 bg-gradient-to-br from-cyan/12 to-violet/10"
                              : "border-white/80 bg-white/72"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={handleSaveContact}
                      className="action-pill action-primary payflow-button payflow-button-ripple"
                    >
                      Save contact
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="panel rounded-[1rem] bg-white/82 p-3 sm:p-3.5">
              <div className="relative z-10">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="meta-label">Saved contacts</p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      Tap a contact to fill the recipient.
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400">{contacts.length} saved</span>
                </div>

                {!areContactsReady ? (
                  <div className="payflow-state-empty mt-2 rounded-[1rem] border border-dashed border-slate-200 bg-white/70 px-3 py-2.5 text-sm text-slate-600">
                    Loading contacts...
                  </div>
                ) : null}

                {areContactsReady && contacts.length === 0 ? (
                  <div className="payflow-state-empty mt-2 rounded-[1rem] border border-dashed border-slate-200 bg-white/70 px-3 py-2.5 text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">No contacts yet</p>
                    <p className="mt-1">Save someone once, then pay them faster next time.</p>
                  </div>
                ) : null}

                {contacts.length > 0 ? (
                  <div className="mt-2 grid gap-2 max-h-[220px] overflow-auto pr-1">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="contact-row flex items-center justify-between gap-2 rounded-[0.9rem] border border-slate-200 bg-white/72 px-2.5 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectContact(contact)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-[0.7rem] bg-slate-100 text-sm">
                            {contact.emoji || "\u{1F642}"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {contact.name}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">
                              {shortAddress(contact.address)}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditContactEditor(contact)}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-600 transition hover:text-slate-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeContact(contact.id)}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-rose-600 transition hover:text-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="panel rounded-[1rem] bg-white/82 p-3 sm:p-3.5">
              <div className="relative z-10">
                <p className="meta-label">Wallet</p>
                <p className="mt-2.5 text-base font-semibold tracking-[-0.05em] text-slate-900">
                  {isConnected ? shortAddress(address) : "Getting Veero ready..."}
                </p>
                <p className="mt-1.5 text-sm text-slate-600">
                  {isArcTestnet ? "Works best on Arc Testnet for now." : "Switch to Arc to send with the right setup."}
                </p>
              </div>
            </div>

            <div className="panel rounded-[1rem] bg-white/82 p-3 sm:p-3.5">
              <div className="relative z-10">
                <p className="meta-label">Available balance</p>
                <p className="mt-2.5 text-[1.55rem] font-semibold tracking-[-0.07em] text-slate-900">
                  {formatUsdcBalance(availableBalance, usdcDecimals)}
                </p>
                <p className="mt-1.5 text-sm text-slate-600">See what you can spend at a glance.</p>
              </div>
            </div>

              <div className="panel rounded-[1rem] bg-white/82 p-3 sm:p-3.5">
                <div className="relative z-10">
                <p className="meta-label">Veero</p>
                  <div className="mt-2.5 space-y-2 text-sm text-slate-700">
                    <p>Send and track stablecoin payments in one calm, simple view.</p>
                  </div>
                </div>
              </div>
          </aside>
        </div>
      </div>

      {showSuccessOverlay ? (
        <div className="payflow-success-overlay" aria-live="polite">
          <div className="payflow-success-shell payflow-success" role="status">
            <div className="payflow-success-burst payflow-success-burst-a" />
            <div className="payflow-success-burst payflow-success-burst-b" />

            <div className="payflow-success-mark payflow-coin-pulse">
              <div className="payflow-success-ring" />
              <svg
                viewBox="0 0 52 52"
                aria-hidden="true"
                className="payflow-success-check"
              >
                <path
                  d="M14 27.5 22.5 36 38 18.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="relative z-10 text-center">
              <p className="section-kicker text-cyan">Veero Pay</p>
              <h3 className="mt-4 text-[2rem] font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.5rem]">
                Payment sent
              </h3>
              <p className="mt-3 text-sm text-slate-600 sm:text-base">
                Your USDC payment was sent on Arc.
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">Nice. That felt smooth.</p>
            </div>

            <div className="relative z-10 mt-7 grid gap-3 sm:grid-cols-2">
              <div className="payflow-success-stat">
                <span className="meta-label">Amount</span>
                <strong>{successAmount} USDC</strong>
              </div>
              <div className="payflow-success-stat">
                <span className="meta-label">Recipient</span>
                <strong>
                  {successRecipientName || shortAddress(successRecipient)}
                </strong>
                {successRecipientName && successRecipient ? (
                  <span className="mt-1 block text-xs font-medium text-slate-500">
                    {successRecipient}
                  </span>
                ) : null}
              </div>
              {successNote ? (
                <div className="payflow-success-stat sm:col-span-2">
                  <span className="meta-label">Note</span>
                  <strong>{successNote}</strong>
                </div>
              ) : null}
              <div className="payflow-success-stat sm:col-span-2">
                <span className="meta-label">Transaction</span>
                <strong>{shortHash}</strong>
              </div>
            </div>

            <div className="relative z-10 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              {explorerHref ? (
                <a
                  href={explorerHref}
                  target="_blank"
                  rel="noreferrer"
                  className="action-pill action-secondary payflow-success-link payflow-button-ripple"
                >
                  Open in explorer
                </a>
              ) : null}
              <a href="#activity" className="action-pill action-secondary payflow-button-ripple">
                View activity
              </a>
              <button
                onClick={handleResetAfterSuccess}
                className="action-pill action-primary payflow-button-ripple"
              >
                Send another payment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
