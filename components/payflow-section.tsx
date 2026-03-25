"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { useArcPayment } from "@/hooks/use-arc-payment";
import { usePaymentDraft } from "@/hooks/use-payment-draft";
import { usePaymentHistory } from "@/hooks/use-payment-history";
import { useRecentRecipients } from "@/hooks/use-recent-recipients";
import { useSavedContacts } from "@/hooks/use-saved-contacts";
import { getNoteSuggestion } from "@/lib/note-suggestions";
import type { SavedContact } from "@/lib/payment-types";
import { arcTestnet } from "@/lib/wagmi";

const CONTACT_EMOJI_OPTIONS = [
  "\u{1F642}",
  "\u{1F680}",
  "\u{1F4B8}",
  "\u{1F4BC}",
  "\u{1F4BB}",
  "\u{1F3AF}",
];

type FormState = {
  amount: string;
  note: string;
  recipient: string;
};

const EMPTY_FORM: FormState = {
  amount: "",
  note: "",
  recipient: "",
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return trimmed;
  }

  return parsed.toString();
}

function getStatusClasses(txStage: ReturnType<typeof useArcPayment>["txStage"]) {
  if (txStage === "preparing") {
    return {
      dotClass: "payflow-status-dot payflow-status-dot-preparing",
      shellClass: "payflow-inline-state payflow-inline-preparing",
    };
  }

  if (txStage === "wallet") {
    return {
      dotClass: "payflow-status-dot payflow-status-dot-wallet",
      shellClass: "payflow-inline-state payflow-inline-wallet",
    };
  }

  if (txStage === "confirming") {
    return {
      dotClass: "payflow-status-dot payflow-status-dot-confirming",
      shellClass: "payflow-inline-state payflow-inline-confirming",
    };
  }

  if (txStage === "success") {
    return {
      dotClass: "payflow-status-dot payflow-status-dot-success",
      shellClass: "payflow-inline-state payflow-inline-success",
    };
  }

  if (txStage === "failed") {
    return {
      dotClass: "payflow-status-dot payflow-status-dot-failed",
      shellClass: "payflow-inline-state payflow-inline-failed",
    };
  }

  return {
    dotClass: "payflow-status-dot",
    shellClass: "payflow-inline-state payflow-inline-idle",
  };
}

export function PayflowSection() {
  const { address: connectedAddress } = useAccount();
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
    submittedHash,
    statusLabel,
    successAmount,
    successNote,
    successRecipient,
    successRecipientName,
    isConfirmationDelayed,
    txStage,
  } = useArcPayment();
  const { contacts, hasDuplicateAddress, isReady: contactsReady, removeContact, saveContact } =
    useSavedContacts();
  const { hasRecipient, isReady: recentsReady, recipients } = useRecentRecipients();
  const { draft, hasDraft, isReady: draftReady, clearDraft, saveDraft } = usePaymentDraft();
  const { history } = usePaymentHistory();

  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [recipientName, setRecipientName] = useState("");
  const [draftPromptVisible, setDraftPromptVisible] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<keyof FormState, boolean>>({
    amount: false,
    note: false,
    recipient: false,
  });
  const [contactName, setContactName] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactEmoji, setContactEmoji] = useState(CONTACT_EMOJI_OPTIONS[0]);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [noteSuggestion, setNoteSuggestion] = useState<string | null>(null);
  const [noteSuggestionLoading, setNoteSuggestionLoading] = useState(false);
  const draftHydratedRef = useRef(false);
  const skipNextDraftSaveRef = useRef(true);

  useEffect(() => {
    if (!draftReady || draftHydratedRef.current) {
      return;
    }

    draftHydratedRef.current = true;

    if (hasDraft && !formState.recipient && !formState.amount && !formState.note) {
      setDraftPromptVisible(true);
    }
  }, [draftReady, formState.amount, formState.note, formState.recipient, hasDraft]);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextDraft = {
        amount: formState.amount.trim(),
        note: formState.note.trim(),
        recipient: formState.recipient.trim(),
      };

      if (!nextDraft.amount && !nextDraft.note && !nextDraft.recipient) {
        clearDraft();
        return;
      }

      saveDraft(nextDraft);
    }, 240);

    return () => window.clearTimeout(timeoutId);
  }, [clearDraft, draftReady, formState.amount, formState.note, formState.recipient, saveDraft]);

  useEffect(() => {
    const trimmedNote = formState.note.trim();
    if (!trimmedNote) {
      setNoteSuggestion(null);
      setNoteSuggestionLoading(false);
      return;
    }

    let cancelled = false;
    setNoteSuggestionLoading(true);

    const timeoutId = window.setTimeout(() => {
      void getNoteSuggestion(trimmedNote, formState.recipient.trim(), formState.amount.trim())
        .then((suggestion) => {
          if (!cancelled) {
            setNoteSuggestion(suggestion);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setNoteSuggestionLoading(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [formState.amount, formState.note, formState.recipient]);

  useEffect(() => {
    if (!showSuccessOverlay) {
      return;
    }

    setFormState(EMPTY_FORM);
    setRecipientName("");
    setReviewMode(false);
    setSubmittedOnce(false);
    setTouchedFields({
      amount: false,
      note: false,
      recipient: false,
    });
    setDraftPromptVisible(false);
    clearDraft();
  }, [clearDraft, showSuccessOverlay]);

  const amountSuggestions = useMemo(() => {
    const uniqueAmounts = new Set<string>();

    for (const item of history) {
      const normalized = normalizeAmount(item.amount);
      if (!normalized) {
        continue;
      }

      uniqueAmounts.add(normalized);
      if (uniqueAmounts.size === 3) {
        break;
      }
    }

    return [...uniqueAmounts];
  }, [history]);

  const recipientIsValid = useMemo(
    () => Boolean(formState.recipient.trim()) && isAddress(formState.recipient.trim()),
    [formState.recipient],
  );
  const normalizedAmount = useMemo(() => normalizeAmount(formState.amount), [formState.amount]);
  const amountValue = normalizedAmount ? Number(normalizedAmount) : Number.NaN;
  const amountIsValid = Number.isFinite(amountValue) && amountValue > 0;
  const isFirstTimeRecipient =
    recipientIsValid &&
    !hasRecipient(formState.recipient.trim()) &&
    !contacts.some(
      (contact) => contact.address.toLowerCase() === formState.recipient.trim().toLowerCase(),
    );

  const recipientError =
    (submittedOnce || touchedFields.recipient) && !recipientIsValid
      ? "That wallet address doesn't look right. Double-check it and try again."
      : null;

  const amountError =
    (submittedOnce || touchedFields.amount) && !formState.amount.trim()
      ? "Enter an amount to continue."
      : (submittedOnce || touchedFields.amount) && !amountIsValid
        ? "Enter a valid amount greater than zero."
        : null;

  const sameAddressWarning =
    recipientIsValid &&
    connectedAddress &&
    formState.recipient.trim().toLowerCase() === connectedAddress.toLowerCase()
      ? "You can't send a payment to your own wallet here."
      : null;

  const canReview = recipientIsValid && amountIsValid && !sameAddressWarning;
  const canSubmit = canReview && !isSubmitting;
  const statusMeta = getStatusClasses(txStage);

  function updateField(field: keyof FormState, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));

    if (field !== "note") {
      clearPaymentError();
    }
  }

  function markTouched(field: keyof FormState) {
    setTouchedFields((current) => ({
      ...current,
      [field]: true,
    }));
  }

  function applyDraft() {
    setFormState({
      amount: draft.amount,
      note: draft.note,
      recipient: draft.recipient,
    });
    setDraftPromptVisible(false);
  }

  function dismissDraft() {
    clearDraft();
    setDraftPromptVisible(false);
  }

  function applyAmountSuggestion(amount: string) {
    updateField("amount", amount);
    markTouched("amount");
  }

  function applyRecipient(address: string, label?: string) {
    updateField("recipient", address);
    markTouched("recipient");
    setRecipientName(label ?? "");
    clearPaymentError();
  }

  function handleUseSuggestion() {
    if (!noteSuggestion) {
      return;
    }

    updateField("note", noteSuggestion);
    markTouched("note");
    setNoteSuggestion(null);
  }

  function goToReview() {
    setSubmittedOnce(true);

    if (!canReview) {
      return;
    }

    setReviewMode(true);
  }

  async function confirmAndSend() {
    setSubmittedOnce(true);

    if (!canSubmit) {
      return;
    }

    await handlePay({
      amount: normalizeAmount(formState.amount),
      note: formState.note.trim() || undefined,
      recipient: formState.recipient.trim() as `0x${string}`,
      recipientName: recipientName || undefined,
    });
  }

  function startAnotherPayment() {
    resetSuccessState();
    clearPaymentError();
  }

  function resetContactEditor() {
    setContactName("");
    setContactAddress("");
    setContactEmoji(CONTACT_EMOJI_OPTIONS[0]);
    setEditingContactId(null);
    setContactError(null);
  }

  function handleEditContact(contact: SavedContact) {
    setEditingContactId(contact.id);
    setContactName(contact.name);
    setContactAddress(contact.address);
    setContactEmoji(contact.emoji || CONTACT_EMOJI_OPTIONS[0]);
    setContactError(null);
  }

  function handleSaveContact() {
    const trimmedName = contactName.trim();
    const trimmedAddress = contactAddress.trim();

    if (!trimmedName) {
      setContactError("Add a name before saving this contact.");
      return;
    }

    if (!isAddress(trimmedAddress)) {
      setContactError("Enter a valid wallet address to save this contact.");
      return;
    }

    if (hasDuplicateAddress(trimmedAddress, editingContactId ?? undefined)) {
      setContactError("That address is already saved.");
      return;
    }

    const contactId = editingContactId ?? `contact_${trimmedAddress.toLowerCase()}`;

    saveContact({
      address: trimmedAddress as `0x${string}`,
      emoji: contactEmoji,
      id: contactId,
      name: trimmedName,
    });

    if (formState.recipient.trim().toLowerCase() === trimmedAddress.toLowerCase()) {
      setRecipientName(trimmedName);
    }

    resetContactEditor();
  }

  return (
    <section className="section-frame rounded-[1rem] p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-kicker text-cyan">Send</p>
          <h2 className="mt-1 text-[1rem] font-semibold tracking-[-0.04em] text-slate-900">
            Send money
          </h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Recipient, amount, then confirm.
          </p>
        </div>
        {activeProductId ? (
          <p className="text-[11px] font-medium text-slate-400">USDC on Arc</p>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-2.5">
          {draftPromptVisible ? (
            <div className="payflow-inline-state">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-slate-900">Continue draft?</p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Your last recipient, amount, and note are still here.
                  </p>
                </div>
                <div className="payflow-compact-actions shrink-0">
                  <button
                    type="button"
                    className="mini-chip"
                    onClick={dismissDraft}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="mini-chip mini-chip-active"
                    onClick={applyDraft}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {recentsReady && recipients.length > 0 ? (
            <div className="compact-line-block">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Recent
                </p>
                <p className="text-[11px] text-slate-400">Tap to reuse</p>
              </div>
              <div className="recent-contact-row mt-2">
                {recipients.map((recipient) => (
                  <button
                    key={recipient.id}
                    type="button"
                    className="recent-contact-chip"
                    onClick={() => applyRecipient(recipient.address, recipient.label)}
                  >
                    <span className="recent-contact-avatar">
                      {(recipient.label || recipient.address).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate">
                      {recipient.label || shortAddress(recipient.address)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                Recipient
              </label>
              <div className="mt-1">
                <input
                  value={formState.recipient}
                  onChange={(event) => updateField("recipient", event.target.value)}
                  onBlur={() => markTouched("recipient")}
                  placeholder="Paste wallet address"
                  className="payflow-compact-input"
                />
              </div>
              {recipientError ? (
                <p className="mt-1 text-[12px] text-rose-600">{recipientError}</p>
              ) : null}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Amount
                </label>
                <span className="text-[11px] text-slate-400">USDC</span>
              </div>
              <div className="amount-input-row mt-1">
                <input
                  value={formState.amount}
                  onChange={(event) => updateField("amount", event.target.value)}
                  onBlur={() => markTouched("amount")}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="amount-input"
                />
                <span className="text-[12px] font-medium text-slate-400">USDC</span>
              </div>
              {amountSuggestions.length > 0 ? (
                <div className="inline-chip-row mt-2">
                  {amountSuggestions.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={`mini-chip ${
                        normalizeAmount(formState.amount) === amount ? "mini-chip-active" : ""
                      }`}
                      onClick={() => applyAmountSuggestion(amount)}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
              ) : null}
              {amountError ? <p className="mt-1 text-[12px] text-rose-600">{amountError}</p> : null}
            </div>

            <div>
              <label className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                Note
              </label>
              <textarea
                value={formState.note}
                onChange={(event) => updateField("note", event.target.value)}
                onBlur={() => markTouched("note")}
                placeholder="What is this payment for?"
                className="payflow-compact-input payflow-note-input mt-1"
              />
              {noteSuggestion || noteSuggestionLoading ? (
                <div className="inline-chip-row mt-2">
                  <span className="text-[11px] text-slate-400">Suggested</span>
                  {noteSuggestionLoading ? (
                    <span className="mini-chip">Checking...</span>
                  ) : (
                    <button
                      type="button"
                      className="mini-chip mini-chip-active"
                      onClick={handleUseSuggestion}
                    >
                      {noteSuggestion}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {isFirstTimeRecipient ? (
            <div className="payflow-inline-warning">
              First time sending to this address.
            </div>
          ) : null}

          {sameAddressWarning ? (
            <div className="payflow-inline-warning payflow-inline-warning-error">
              {sameAddressWarning}
            </div>
          ) : null}

          {statusLabel ? (
            <div className={statusMeta.shellClass}>
              <div className="flex items-center gap-2">
                <span className={statusMeta.dotClass} />
                <div>
                  <p className="text-[12px] font-semibold text-slate-900">{statusLabel}</p>
                  <p className="text-[11px] text-slate-500">This usually only takes a moment.</p>
                  {shortHash ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>Tx: {shortHash}</span>
                      {explorerHref ? (
                        <a
                          href={explorerHref}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4"
                        >
                          View on explorer
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {isConfirmationDelayed && submittedHash ? (
                    <p className="mt-1 text-[11px] text-amber-700">
                      Confirmation is taking longer than usual. The transaction may still be pending.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {paymentError ? (
            <div className="payflow-inline-warning payflow-inline-warning-error">
              {paymentError}
            </div>
          ) : null}

          {showSuccessOverlay && successAmount && successRecipient ? (
            <div className="payflow-inline-state payflow-inline-success">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-slate-900">Payment confirmed</p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {successAmount} USDC to{" "}
                    {successRecipientName || shortAddress(successRecipient)}
                  </p>
                  {successNote ? (
                    <p className="mt-1 text-[12px] text-slate-500">Note: {successNote}</p>
                  ) : null}
                  {shortHash ? (
                    <p className="mt-1 text-[11px] text-slate-400">Tx: {shortHash}</p>
                  ) : null}
                </div>
                <div className="payflow-compact-actions shrink-0">
                  {explorerHref ? (
                    <a
                      href={explorerHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mini-chip"
                    >
                      Explorer
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="mini-chip mini-chip-active"
                    onClick={startAnotherPayment}
                  >
                    Send another
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {reviewMode ? (
            <div className="payflow-inline-state">
              <p className="text-[12px] font-semibold text-slate-900">Review payment</p>
              <p className="mt-1 text-[12px] text-slate-500">
                Confirm the address and amount before sending on Arc.
              </p>

              <div className="mt-2">
                <div className="review-line">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">To</span>
                  <span className="text-right text-[12px] font-medium text-slate-900">
                    {recipientName || shortAddress(formState.recipient.trim())}
                  </span>
                </div>
                <div className="review-line">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    Amount
                  </span>
                  <span className="text-right text-[13px] font-semibold text-slate-900">
                    {normalizeAmount(formState.amount)} USDC
                  </span>
                </div>
                <div className="review-line review-line-note">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Note</span>
                  <span className="text-right text-[12px] text-slate-600">
                    {formState.note.trim() || "No note"}
                  </span>
                </div>
                <div className="review-line">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    Network
                  </span>
                  <span className="text-right text-[12px] font-medium text-slate-900">
                    {arcTestnet.name}
                  </span>
                </div>
              </div>

              <div className="payflow-action-bar">
                <div className="payflow-compact-actions">
                  <button
                    type="button"
                    className="action-pill action-secondary"
                    onClick={() => setReviewMode(false)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="action-pill action-primary"
                    onClick={() => void confirmAndSend()}
                    disabled={!canSubmit}
                  >
                    {isSubmitting ? "Sending..." : "Confirm and send"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="payflow-action-bar">
              <div className="payflow-compact-actions">
                <button
                  type="button"
                  className="action-pill action-secondary"
                  onClick={() => {
                    setFormState(EMPTY_FORM);
                    setRecipientName("");
                    setSubmittedOnce(false);
                    setTouchedFields({
                      amount: false,
                      note: false,
                      recipient: false,
                    });
                    clearDraft();
                    clearPaymentError();
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="action-pill action-primary"
                  onClick={goToReview}
                >
                  Review payment
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="compact-line-block">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                Saved contacts
              </p>
              <p className="text-[11px] text-slate-400">
                {contactsReady ? `${contacts.length} saved` : "Loading..."}
              </p>
            </div>

            {contactsReady && contacts.length > 0 ? (
              <div className="compact-contact-list mt-2">
                {contacts.map((contact) => (
                  <div key={contact.id} className="compact-contact-row">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="compact-contact-avatar">
                        {contact.emoji || contact.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-slate-900">
                          {contact.name}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {shortAddress(contact.address)}
                        </p>
                      </div>
                    </div>
                    <div className="inline-chip-row">
                      <button
                        type="button"
                        className="mini-chip mini-chip-active"
                        onClick={() => applyRecipient(contact.address, contact.name)}
                      >
                        Pay
                      </button>
                      <button
                        type="button"
                        className="mini-chip"
                        onClick={() => handleEditContact(contact)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="mini-chip"
                        onClick={() => removeContact(contact.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : contactsReady ? (
              <p className="mt-2 text-[12px] text-slate-500">
                Save frequent recipients here for faster repeat payments.
              </p>
            ) : null}
          </div>

          <div className="compact-line-block">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              {editingContactId ? "Edit contact" : "Add contact"}
            </p>

            <div className="mt-2 space-y-2">
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="Name"
                className="payflow-compact-input"
              />
              <input
                value={contactAddress}
                onChange={(event) => setContactAddress(event.target.value)}
                placeholder="Wallet address"
                className="payflow-compact-input"
              />
              <div className="inline-chip-row">
                {CONTACT_EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`mini-chip ${contactEmoji === emoji ? "mini-chip-active" : ""}`}
                    onClick={() => setContactEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {contactError ? <p className="text-[12px] text-rose-600">{contactError}</p> : null}
              <div className="payflow-compact-actions">
                {editingContactId ? (
                  <button
                    type="button"
                    className="action-pill action-secondary"
                    onClick={resetContactEditor}
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="button"
                  className="action-pill action-primary"
                  onClick={handleSaveContact}
                >
                  {editingContactId ? "Update contact" : "Save contact"}
                </button>
              </div>
            </div>
          </div>

          {isWrongNetwork ? (
            <div className="payflow-inline-warning">
              Wrong network. Veero will switch to Arc before sending.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
