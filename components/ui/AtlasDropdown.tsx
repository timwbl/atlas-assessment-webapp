"use client";

import type { CSSProperties } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type AtlasDropdownOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type Props<T extends string = string> = {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onChange: (value: T) => void;
  options: AtlasDropdownOption<T>[];
  placeholder?: string;
  value: T;
};

export function AtlasDropdown<T extends string = string>({
  ariaLabel,
  className = "",
  disabled = false,
  fullWidth = true,
  onChange,
  options,
  placeholder = "Bitte auswählen",
  value
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);
  const enabledOptions = options.filter((option) => !option.disabled);

  useEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportPadding = 12;
      const preferredWidth = Math.min(Math.max(rect.width, 220), Math.min(420, window.innerWidth - viewportPadding * 2));
      const maxLeft = window.innerWidth - preferredWidth - viewportPadding;
      const left = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
      setMenuStyle({
        left,
        minWidth: preferredWidth,
        width: preferredWidth,
        top: rect.bottom + 8
      });
    }

    function closeOnOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    updateMenuPosition();
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  function moveSelection(direction: 1 | -1) {
    if (!enabledOptions.length) return;
    const currentIndex = enabledOptions.findIndex((option) => option.value === value);
    const nextIndex = currentIndex === -1
      ? direction === 1 ? 0 : enabledOptions.length - 1
      : (currentIndex + direction + enabledOptions.length) % enabledOptions.length;
    onChange(enabledOptions[nextIndex].value);
  }

  return (
    <div
      className={[
        "atlas-dropdown",
        fullWidth ? "atlas-dropdown--full" : "",
        open ? "is-open" : "",
        disabled ? "is-disabled" : "",
        className
      ].filter(Boolean).join(" ")}
      ref={rootRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        className="atlas-dropdown-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) setOpen(true);
            moveSelection(1);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) setOpen(true);
            moveSelection(-1);
          }
        }}
        ref={buttonRef}
        type="button"
      >
        <span>{selected?.label || placeholder}</span>
        <span className="atlas-dropdown-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && createPortal(
        <div className="atlas-dropdown-menu" id={listboxId} ref={menuRef} role="listbox" style={menuStyle}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                aria-selected={active}
                className={active ? "is-selected" : ""}
                disabled={option.disabled}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                role="option"
                type="button"
              >
                <span>{option.label}</span>
                {active && <span className="atlas-dropdown-check" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
