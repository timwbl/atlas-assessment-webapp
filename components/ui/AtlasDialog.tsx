"use client";

import { useCallback, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  children: ReactNode;
  className: string;
  label: string;
  onDismiss?: () => void;
};

type Sample = { y: number; time: number };
type Drag = { pointer: number; start: number; offset: number; samples: Sample[] };

export function AtlasDialog({ children, className, label, onDismiss }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const position = useRef(0);
  const drag = useRef<Drag | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const movePanel = useCallback((y: number) => {
    position.current = y;
    if (panelRef.current) panelRef.current.style.translate = y === 0 ? "" : `0 ${y}px`;
  }, []);

  const settle = useCallback((target: number, velocity: number, onSettled?: () => void) => {
    cancelAnimationFrame(frame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      movePanel(target);
      onSettled?.();
      return;
    }

    const start = performance.now();
    const displacement = position.current - target;
    const frequency = 21;
    const slope = velocity + frequency * displacement;

    function tick(now: number) {
      const time = Math.max(0, (now - start) / 1000);
      const decay = Math.exp(-frequency * time);
      const delta = (displacement + slope * time) * decay;
      const speed = (velocity - frequency * slope * time) * decay;
      if (Math.abs(delta) < 0.5 && Math.abs(speed) < 12) {
        movePanel(target);
        onSettled?.();
        return;
      }
      movePanel(Math.max(-12, target + delta));
      frame.current = requestAnimationFrame(tick);
    }

    frame.current = requestAnimationFrame(tick);
  }, [movePanel]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement;
    dialog.showModal();
    const viewport = window.matchMedia("(max-width: 760px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function reset() {
      cancelAnimationFrame(frame.current);
      drag.current = null;
      movePanel(0);
    }

    if (viewport.matches && !motion.matches) {
      movePanel(32);
      settle(0, 0);
    }
    viewport.addEventListener("change", reset);
    motion.addEventListener("change", reset);

    return () => {
      viewport.removeEventListener("change", reset);
      motion.removeEventListener("change", reset);
      cancelAnimationFrame(frame.current);
      dialog.close();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [movePanel, settle]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    cancelAnimationFrame(frame.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      start: event.clientY,
      offset: position.current,
      samples: [{ y: event.clientY, time: event.timeStamp }]
    };
  }

  function updateDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const y = active.offset + event.clientY - active.start;
    active.samples = [
      ...active.samples.filter((sample) => event.timeStamp - sample.time <= 100),
      { y: event.clientY, time: event.timeStamp }
    ];
    movePanel(y >= 0 ? y : y * 44 / (44 + Math.abs(y)));
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const finalSample = active.samples[active.samples.length - 1];
    const firstSample = active.samples.find((sample) => event.timeStamp - sample.time <= 100) ?? finalSample;
    const elapsed = event.timeStamp - firstSample.time;
    const velocity = !cancelled && elapsed >= 16 && event.timeStamp - finalSample.time < 90
      ? Math.max(-2400, Math.min(2400, (event.clientY - firstSample.y) / elapsed * 1000))
      : 0;
    drag.current = null;

    const threshold = Math.min(132, (panelRef.current?.offsetHeight ?? 440) * 0.3);
    const projected = position.current + velocity * 0.16;
    if (!cancelled && position.current > 14 && projected >= threshold) {
      settle(panelRef.current?.offsetHeight ?? window.innerHeight, velocity, () => dismissRef.current?.());
    } else {
      settle(0, velocity);
    }
  }

  return createPortal(
    <dialog
      aria-label={label}
      className="atlas-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss?.();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss?.();
      }}
      ref={dialogRef}
    >
      <div className={`atlas-dialog-panel ${className}`} ref={panelRef}>
        {onDismiss && (
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
        {children}
      </div>
    </dialog>,
    document.body
  );
}
