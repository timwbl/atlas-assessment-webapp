"use client";

import { useCallback, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const MOBILE_SHEET = "(max-width: 760px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const DRAG_INTENT = 8;
const VELOCITY_WINDOW = 90;
const SPRING_FREQUENCY = 25;

type Props = {
  children: ReactNode | ((dismiss: () => void) => ReactNode);
  className: string;
  label: string;
  onDismiss?: () => void;
  presentation?: "sheet" | "fullscreen";
};

type Sample = { y: number; time: number };
type Drag = {
  pointer: number;
  x: number;
  y: number;
  offset: number;
  height: number;
  tracking: boolean;
  samples: Sample[];
};

export function AtlasDialog({ children, className, label, onDismiss, presentation = "sheet" }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const position = useRef(0);
  const drag = useRef<Drag | null>(null);
  const dismissRef = useRef(onDismiss);
  const motion = useRef({ reduced: false, mobile: false, closing: false });

  useLayoutEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  const movePanel = useCallback((y: number, height: number) => {
    position.current = y;
    const shade = Math.max(0, 1 - Math.max(0, y) / height);
    dialogRef.current?.style.setProperty("--atlas-dialog-shade", String(shade));
    if (panelRef.current) {
      panelRef.current.style.translate = y && !motion.current.reduced ? `0 ${y}px` : "";
    }
  }, []);

  const settle = useCallback((target: number, height: number, velocity: number, closing = false) => {
    cancelAnimationFrame(frame.current);
    motion.current.closing = closing;
    if (motion.current.reduced || !motion.current.mobile) {
      movePanel(target, height);
      if (closing) dismissRef.current?.();
      return;
    }

    const start = performance.now();
    const displacement = position.current - target;
    // Critically damped spring with the release velocity as its initial slope.
    const slope = velocity + SPRING_FREQUENCY * displacement;

    function tick(now: number) {
      const time = Math.max(0, (now - start) / 1000);
      const decay = Math.exp(-SPRING_FREQUENCY * time);
      const delta = (displacement + slope * time) * decay;
      const speed = (velocity - SPRING_FREQUENCY * slope * time) * decay;
      if ((Math.abs(delta) < 0.75 && Math.abs(speed) < 18) || (closing && delta >= 0)) {
        movePanel(target, height);
        if (closing) dismissRef.current?.();
        return;
      }
      movePanel(Math.max(-18, target + delta), height);
      frame.current = requestAnimationFrame(tick);
    }

    frame.current = requestAnimationFrame(tick);
  }, [movePanel]);

  function dismiss() {
    if (!dismissRef.current || motion.current.closing) return;
    const height = panelRef.current?.offsetHeight || 1;
    settle(height, height, 0, true);
  }

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog || !panel) return;
    const previouslyFocused = document.activeElement;
    const viewport = window.matchMedia(MOBILE_SHEET);
    const preference = window.matchMedia(REDUCED_MOTION);

    function updatePreferences() {
      cancelAnimationFrame(frame.current);
      drag.current = null;
      const wasClosing = motion.current.closing;
      motion.current = { reduced: preference.matches, mobile: presentation === "sheet" && viewport.matches, closing: false };
      movePanel(0, panelRef.current?.offsetHeight || 1);
      if (wasClosing) dismissRef.current?.();
    }

    updatePreferences();
    dialog.showModal();
    const height = panel.offsetHeight || 1;
    if (motion.current.mobile && !preference.matches) {
      movePanel(Math.min(24, height * 0.08), height);
      settle(0, height, 0);
    }
    viewport.addEventListener("change", updatePreferences);
    preference.addEventListener("change", updatePreferences);

    return () => {
      viewport.removeEventListener("change", updatePreferences);
      preference.removeEventListener("change", updatePreferences);
      cancelAnimationFrame(frame.current);
      dialog.close();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [movePanel, presentation, settle]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    const height = panelRef.current?.offsetHeight;
    if (event.button !== 0 || !event.isPrimary || drag.current || !height) return;
    cancelAnimationFrame(frame.current);
    motion.current.closing = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset: position.current,
      height,
      tracking: false,
      samples: [{ y: event.clientY, time: event.timeStamp }]
    };
  }

  function updateDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const dy = event.clientY - active.y;
    if (!active.tracking) {
      if (Math.abs(dy) < DRAG_INTENT || Math.abs(dy) < Math.abs(event.clientX - active.x)) return;
      active.tracking = true;
    }

    const y = active.offset + dy;
    active.samples.push({ y: event.clientY, time: event.timeStamp });
    while (active.samples.length > 2 && event.timeStamp - active.samples[0].time > VELOCITY_WINDOW) {
      active.samples.shift();
    }
    movePanel(y >= 0 ? y : y * 44 / (44 + Math.abs(y)), active.height);
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    drag.current = null;
    const last = active.samples[active.samples.length - 1];
    const first = active.samples.find((sample) => sample !== last && last.time - sample.time <= VELOCITY_WINDOW)
      ?? active.samples[0];
    const elapsed = last.time - first.time;
    const releaseVelocity = !cancelled && elapsed >= 8 && event.timeStamp - last.time < 65
      ? Math.max(-1800, Math.min(1800, (last.y - first.y) / elapsed * 1000))
      : 0;
    const travel = position.current;
    const threshold = Math.min(146, active.height * 0.34);
    const projected = travel + releaseVelocity * 0.20;
    if (!cancelled && active.tracking && travel > 10 && projected >= threshold) {
      settle(active.height, active.height, releaseVelocity, true);
    } else {
      settle(0, active.height, active.tracking && !cancelled ? releaseVelocity : 0);
    }
  }

  return createPortal(
    <dialog
      aria-label={label}
      className="atlas-dialog"
      data-presentation={presentation}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
      ref={dialogRef}
    >
      <div className={`atlas-dialog-panel ${className}`} ref={panelRef}>
        {onDismiss && presentation === "sheet" && (
          <div
            aria-hidden="true"
            className="atlas-sheet-handle"
            onLostPointerCapture={(event) => finishDrag(event, true)}
            onPointerCancel={(event) => finishDrag(event, true)}
            onPointerDown={startDrag}
            onPointerMove={updateDrag}
            onPointerUp={(event) => finishDrag(event, false)}
          />
        )}
        {typeof children === "function" ? children(dismiss) : children}
      </div>
    </dialog>,
    document.body
  );
}
