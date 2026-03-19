"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { SavedContact } from "@/lib/payment-types";

const CONTACTS_STORAGE_KEY = "arclens:saved-contacts";

export function useSavedContacts() {
  const { isReady, value, setValue } = useLocalStorage<SavedContact[]>(
    CONTACTS_STORAGE_KEY,
    [],
  );

  const contacts = useMemo(
    () => [...value].sort((a, b) => a.name.localeCompare(b.name)),
    [value],
  );

  function saveContact(contact: SavedContact) {
    setValue((currentContacts) => {
      const normalizedAddress = contact.address.toLowerCase();
      const nextContacts = currentContacts.filter(
        (currentContact) =>
          currentContact.id !== contact.id &&
          currentContact.address.toLowerCase() !== normalizedAddress,
      );

      return [...nextContacts, contact];
    });
  }

  function removeContact(contactId: string) {
    setValue((currentContacts) =>
      currentContacts.filter((contact) => contact.id !== contactId),
    );
  }

  function hasDuplicateAddress(address: string, excludedId?: string) {
    const normalizedAddress = address.toLowerCase();

    return contacts.some(
      (contact) =>
        contact.id !== excludedId &&
        contact.address.toLowerCase() === normalizedAddress,
    );
  }

  return {
    contacts,
    hasDuplicateAddress,
    isReady,
    removeContact,
    saveContact,
  };
}
