"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type AtlasDropdownOption<T extends string = string> = {
  value: T;
  label: string;
  shortLabel?: string;
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
  const pointerEntry = useRef(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const enabledIndices = options.flatMap((option, index) => option.disabled ? [] : [index]);
  const open = !disabled && activeIndex !== null && enabledIndices.length > 0;
  const highlighted = activeIndex !== null && enabledIndices.includes(activeIndex)
    ? activeIndex
    : enabledIndices[0];
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const close = useCallback(() => {
    pointerEntry.current = false;
    setActiveIndex(null);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    let frame = 0;
    const viewport = window.visualViewport;

    function positionMenu() {
      const trigger = buttonRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const rect = trigger.getBoundingClientRect();
      const padding = 12;
      const gap = 6;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const width = Math.min(Math.max(rect.width, 220), 420, viewportWidth - padding * 2);
      const left = Math.max(viewportLeft + padding, Math.min(rect.left, viewportLeft + viewportWidth - padding - width));
      const roomBelow = viewportBottom - rect.bottom - padding - gap;
      const roomAbove = rect.top - viewportTop - padding - gap;
      const desiredHeight = Math.min(360, menu.scrollHeight + 2);
      const above = roomBelow < desiredHeight && roomAbove > roomBelow;
      const maxHeight = Math.max(0, Math.min(360, above ? roomAbove : roomBelow));

      if (maxHeight < 48) {
        close();
        return;
      }

      const originX = Math.min(width, Math.max(0, rect.left + rect.width / 2 - left));
      setMenuStyle({
        left,
        width,
        top: above ? undefined : rect.bottom + gap,
        bottom: above ? window.innerHeight - rect.top + gap : undefined,
        maxHeight,
        transformOrigin: `${originX}px ${above ? "bottom" : "top"}`
      });
    }

    function onViewportChange(event: Event) {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(positionMenu);
    }

    function closeOnOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    }

    positionMenu();
    document.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    viewport?.addEventListener("resize", onViewportChange);
    viewport?.addEventListener("scroll", onViewportChange);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      viewport?.removeEventListener("resize", onViewportChange);
      viewport?.removeEventListener("scroll", onViewportChange);
    };
  }, [open, options.length, close]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const option = menu?.querySelector<HTMLElement>(".is-highlighted");
    if (!menu || !option) return;
    const optionTop = option.offsetTop;
    if (optionTop < menu.scrollTop) menu.scrollTop = optionTop;
    const optionBottom = optionTop + option.offsetHeight;
    if (optionBottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = optionBottom - menu.clientHeight;
  }, [open, highlighted, menuStyle]);

  function openMenu(direction: 1 | -1 = 1) {
    const edgeIndex = direction === 1 ? enabledIndices[0] : enabledIndices.at(-1);
    const index = enabledIndices.includes(selectedIndex) ? selectedIndex : edgeIndex;
    if (index !== undefined) setActiveIndex(index);
  }

  function selectOption(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    close();
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open) openMenu(direction);
      else {
        const position = enabledIndices.indexOf(highlighted);
        const index = Math.max(0, Math.min(enabledIndices.length - 1, position + direction));
        setActiveIndex(enabledIndices[index]);
      }
    } else if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? enabledIndices[0] : enabledIndices[enabledIndices.length - 1]);
    } else if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectOption(highlighted);
    } else if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key.length === 1 && event.key.trim() && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const start = enabledIndices.indexOf(open ? highlighted : selectedIndex) + 1;
      const byLetter = [...enabledIndices.slice(start), ...enabledIndices.slice(0, start)].find(
        (index) => options[index].label.trimStart().toLocaleLowerCase("de-CH").startsWith(event.key.toLocaleLowerCase("de-CH"))
      );
      if (byLetter !== undefined) {
        event.preventDefault();
        setActiveIndex(byLetter);
      }
    }
  }

  return (
    <div className={[
      "atlas-dropdown",
      fullWidth ? "atlas-dropdown--full" : "",
      open ? "is-open" : "",
      disabled ? "is-disabled" : "",
      className
    ].filter(Boolean).join(" ")}>
      <button
        aria-activedescendant={open ? optionId(highlighted) : undefined}
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="atlas-dropdown-trigger"
        disabled={disabled}
        onBlur={close}
        onClick={(event) => {
          if (open) close();
          else {
            pointerEntry.current = event.detail > 0;
            buttonRef.current?.focus({ preventScroll: true });
            openMenu();
          }
        }}
        onKeyDown={handleKey}
        ref={buttonRef}
        role="combobox"
        type="button"
      >
        <span>{options[selectedIndex]?.shortLabel || options[selectedIndex]?.label || placeholder}</span>
        <span className="atlas-dropdown-chevron" aria-hidden="true" />
      </button>

      {open && createPortal(
        <div aria-label={ariaLabel || placeholder} className="atlas-dropdown-menu" data-pointer-entry={pointerEntry.current || undefined} id={listboxId} ref={menuRef} role="listbox" style={menuStyle}>
          {options.map((option, index) => (
            <button
              aria-selected={index === selectedIndex}
              className={[
                index === selectedIndex ? "is-selected" : "",
                index === highlighted ? "is-highlighted" : ""
              ].join(" ")}
              disabled={option.disabled}
              id={optionId(index)}
              key={option.value}
              onClick={() => selectOption(index)}
              onMouseDown={(event) => event.preventDefault()}
              role="option"
              tabIndex={-1}
              type="button"
            >
              <span>{option.label}</span>
              {index === selectedIndex && <span className="atlas-dropdown-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>,
        buttonRef.current?.closest("dialog") ?? document.body
      )}
    </div>
  );
}
