"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Symbol/Illustration oben (z. B. ein Lucide-Icon). */
  icon?: React.ReactNode;
  /** Variante des Bestätigungs-Buttons. */
  variant?: "action" | "primary" | "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Moderner, zum System passender Bestätigungsdialog – ersetzt das native
 * `window.confirm()` durch ein gestyltes Modal.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  icon,
  variant = "action",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          {icon && (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0d5c63]/10 text-[#0d5c63]">
              {icon}
            </div>
          )}
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription className="leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading ? "Bitte warten…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
