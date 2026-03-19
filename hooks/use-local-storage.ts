"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LOCAL_STORAGE_SYNC_EVENT = "arclens:local-storage-sync";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const initialValueRef = useRef(initialValue);
  const isReadyRef = useRef(false);
  const [value, setStoredValue] = useState<T>(initialValueRef.current);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    function readStoredValue() {
      try {
        const storedValue = window.localStorage.getItem(key);

        if (storedValue !== null) {
          setStoredValue(JSON.parse(storedValue) as T);
          return;
        }
      } catch {
        // Fall through to the initial value when storage is unavailable or malformed.
      }

      setStoredValue(initialValueRef.current);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key && event.key !== key) {
        return;
      }

      readStoredValue();
    }

    function handleLocalSync(event: Event) {
      const customEvent = event as CustomEvent<{ key?: string }>;

      if (customEvent.detail?.key !== key) {
        return;
      }

      readStoredValue();
    }

    readStoredValue();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalSync as EventListener);

    isReadyRef.current = true;
    setIsReady(true);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        LOCAL_STORAGE_SYNC_EVENT,
        handleLocalSync as EventListener,
      );
      isReadyRef.current = false;
    };
  }, [key]);

  const setValue = useCallback(
    (nextValue: T | ((currentValue: T) => T)) => {
      setStoredValue((currentValue) => {
        const resolvedValue =
          typeof nextValue === "function"
            ? (nextValue as (currentValue: T) => T)(currentValue)
            : nextValue;

        if (typeof window !== "undefined" && isReadyRef.current) {
          window.localStorage.setItem(key, JSON.stringify(resolvedValue));
          window.dispatchEvent(
            new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, {
              detail: { key },
            }),
          );
        }

        return resolvedValue;
      });
    },
    [key],
  );

  useEffect(() => {
    try {
      if (!isReadyRef.current) {
        return;
      }

      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Ignore storage write failures and keep the in-memory value available.
    }
  }, [key, value]);

  return { isReady, value, setValue };
}
