"use client";

import { X } from "lucide-react";
import type { PointerEvent, ReactNode } from "react";
import { useId, useRef } from "react";

import { useOverlayDialog } from "@/hooks/use-overlay-dialog";

type DrawerProps = Readonly<{
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  placement?: "bottom" | "right";
  title: string;
}>;

export function Drawer({
  children,
  isOpen,
  onClose,
  placement = "right",
  title,
}: DrawerProps) {
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  useOverlayDialog({ containerRef: drawerRef, isOpen, onClose });

  if (!isOpen) return null;

  function handleBackdropPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      className="ds-drawer-backdrop"
      onPointerDown={handleBackdropPointerDown}
    >
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className={`ds-drawer ds-drawer--${placement}`}
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
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
        {children}
      </aside>
    </div>
  );
}
