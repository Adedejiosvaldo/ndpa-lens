"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";

/** Submit state for a form that calls the API: field errors + one top-level message. */
export function useApiForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError) {
        setFields(e.fieldErrors());
        setError(e.detail ? `${e.message}. ${e.detail}` : e.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, fields, run };
}
