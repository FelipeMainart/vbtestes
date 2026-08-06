"use client";

import { X } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useId, useRef } from "react";

import { useOverlayDialog } from "@/hooks/use-overlay-dialog";

type ModalProps = Readonly<{
  actions?: ReactNode;
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}>;

export function Modal({
  actions,
  children,
  isOpen,
  onClose,
  title,
}: ModalProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  useOverlayDialog({ containerRef: modalRef, isOpen, onClose });

  if (!isOpen) return null;

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="ds-modal-backdrop" onMouseDown={handleBackdropClick}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="ds-modal"
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="ds-modal__header">
          <h2 id={titleId}>{title}</h2>
          <button
            aria-label="Fechar"
            className="ds-icon-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </header>
        <div>{children}</div>
        {actions ? (
          <footer className="ds-modal__actions">{actions}</footer>
        ) : null}
      </div>
    </div>
  );
}
