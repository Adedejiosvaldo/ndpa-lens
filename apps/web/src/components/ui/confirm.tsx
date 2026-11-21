"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { type ReactNode, useState } from "react";
import { Button } from "./button";

/** Confirm dialog that names the item being changed (PRD §3.1). */
export function Confirm({
  trigger,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-bg p-6 shadow-xl">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-2 text-sm text-muted">{body}</div>
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
