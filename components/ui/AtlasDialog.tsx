"use client";

import { useCallback, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const MOBILE_SHEET = "(max-width: 760px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const DRAG_INTENT = 8;
const VELOCITY_WINDOW = 90;
const SPRING_FREQUENCY = 25;
const SPRING_STEP = 16;
const SPRING_MAX_DURATION = 400;

type Dismiss = (source?: boolean | { detail: number }) => void;

type Props = {
  children: ReactNode | ((dismiss: Dismiss) => ReactNode);
  className: string;
  label: string;
  onDismiss?: () => void;
  onDismissMotion?: () => Animation | undefined;
  openingInput?: "keyboard" | "pointer";
  presentation?: "sheet" | "fullscreen";
};

type Sample = { y: number; time: number };
type SheetPosition = { y: number; shade: number };
type Drag = {
  pointer: number;
  x: number;
  y: number;
  height: number;
  start: SheetPosition;
  current: SheetPosition;
  tracking: boolean;
  samples: Sample[];
};

export function AtlasDialog({
  children, className, label, onDismiss, onDismissMotion, openingInput, presentation = "sheet"
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const drag = useRef<Drag | null>(null);
  const dismissRef = useRef(onDismiss);
  const initialInput = useRef(openingInput);
  const motion = useRef({ reduced: false, mobile: false, closing: false });
  const finished = useRef(false);

  const stopAnimations = useCallback(() => {
    const active = animations.current;
    animations.current = [];
    active.forEach((animation) => animation.cancel());
  }, []);

  useLayoutEffect(() => {
    dismissRef.current = onDismiss;
    if (onDismiss || !motion.current.closing) return;
    stopAnimations();
    motion.current.closing = false;
    panelRef.current?.style.removeProperty("translate");
    shadeRef.current?.style.removeProperty("opacity");
  }, [onDismiss, stopAnimations]);

  const completeDismiss = useCallback(() => {
    if (finished.current || !dismissRef.current) return;
    finished.current = true;
    dismissRef.current();
  }, []);

  const play = useCallback((active: Animation[], closing = false) => {
    animations.current = active;
    motion.current.closing = closing;
    void Promise.all(active.map((animation) => animation.finished)).then(() => {
      if (animations.current !== active) return;
      if (closing) completeDismiss();
      else stopAnimations();
    }, () => undefined);
  }, [completeDismiss, stopAnimations]);

  function readSheet(): SheetPosition {
    const panel = panelRef.current;
    const shade = shadeRef.current;
    const translate = panel && getComputedStyle(panel).translate;
    return {
      y: translate ? parseFloat(translate.split(/\s+/)[1] ?? "0") || 0 : 0,
      shade: shade ? Number(getComputedStyle(shade).opacity) : 1
    };
  }

  function moveSheet(position: SheetPosition) {
    if (panelRef.current) {
      panelRef.current.style.translate = position.y && !motion.current.reduced ? sheetTranslate(position.y) : "";
    }
    if (shadeRef.current) shadeRef.current.style.opacity = String(position.shade);
  }

  function settleSheet(start: SheetPosition, target: SheetPosition, velocity: number, closing = false) {
    const panel = panelRef.current;
    const shade = shadeRef.current;
    if (!panel || !shade) return;
    stopAnimations();
    if (typeof panel.animate !== "function") {
      moveSheet(target);
      if (closing) completeDismiss();
      return;
    }
    if (motion.current.reduced) {
      moveSheet({ y: 0, shade: closing ? start.shade : 1 });
      if (closing) {
        const timing = opacityTiming();
        play([
          panel.animate([{ opacity: 1 }, { opacity: 0 }], timing),
          shade.animate([{ opacity: start.shade }, { opacity: 0 }], timing)
        ], true);
      }
      return;
    }
    const { positions, duration } = springPositions(start, target, velocity, closing);
    moveSheet(target);
    play([
      panel.animate(positions.map(({ y }) => ({ translate: sheetTranslate(y) })), { duration, fill: "both" }),
      shade.animate(positions.map(({ shade }) => ({ opacity: shade })), { duration, fill: "both" })
    ], closing);
  }

  function dismiss(source: boolean | { detail: number } = true) {
    if (!dismissRef.current || finished.current) return;
    const animate = typeof source === "boolean" ? source : source.detail > 0;
    if (!animate) {
      stopAnimations();
      completeDismiss();
      return;
    }
    if (motion.current.closing) return;
    if (presentation === "fullscreen") {
      const customExit = !motion.current.reduced && onDismissMotion?.();
      if (customExit) play([customExit], true);
      else completeDismiss();
      return;
    }
    const panel = panelRef.current;
    const shade = shadeRef.current;
    const dialog = dialogRef.current;
    if (!panel || !shade || !dialog) return;
    if (typeof panel.animate !== "function") {
      completeDismiss();
      return;
    }
    if (motion.current.mobile) {
      settleSheet(readSheet(), { y: panel.offsetHeight || 1, shade: 0 }, 0, true);
      return;
    }
    const panelStyle = getComputedStyle(panel);
    const initialOpacity = panelStyle.opacity;
    const initialScale = panelStyle.scale;
    const shadeOpacity = getComputedStyle(shade).opacity;
    const timing = surfaceTiming(dialog, motion.current.reduced, 180);
    stopAnimations();
    play([
      panel.animate([
        { opacity: initialOpacity, scale: initialScale },
        { opacity: 0, scale: motion.current.reduced ? "none" : ".97" }
      ], timing),
      shade.animate([{ opacity: shadeOpacity }, { opacity: 0 }], timing)
    ], true);
  }

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const shade = shadeRef.current;
    if (!dialog || !panel || !shade) return;
    const previouslyFocused = document.activeElement;
    const enteredByKeyboard = initialInput.current === "keyboard" || (
      initialInput.current === undefined && previouslyFocused?.matches("button:focus-visible, a:focus-visible")
    );
    const viewport = window.matchMedia(MOBILE_SHEET);
    const preference = window.matchMedia(REDUCED_MOTION);
    finished.current = false;

    function updatePreferences() {
      stopAnimations();
      drag.current = null;
      const wasClosing = motion.current.closing;
      motion.current = { reduced: preference.matches, mobile: presentation === "sheet" && viewport.matches, closing: false };
      if (panel) panel.style.translate = "";
      if (shade) shade.style.opacity = "";
      if (wasClosing) completeDismiss();
    }

    updatePreferences();
    dialog.showModal();
    if (presentation === "sheet" && !enteredByKeyboard && typeof panel.animate === "function") {
      const timing = surfaceTiming(dialog, preference.matches, 240);
      let keyframes: Keyframe[] = [{ opacity: .45 }, { opacity: 1 }];
      if (!preference.matches) {
        keyframes = motion.current.mobile
          ? [{ translate: sheetTranslate(Math.min(32, panel.offsetHeight * .12)) }, { translate: "0 0" }]
          : [{ opacity: .45, scale: ".97" }, { opacity: 1, scale: "1" }];
      }
      play([
        panel.animate(keyframes, timing),
        shade.animate([{ opacity: 0 }, { opacity: 1 }], timing)
      ]);
    }
    viewport.addEventListener("change", updatePreferences);
    preference.addEventListener("change", updatePreferences);

    return () => {
      viewport.removeEventListener("change", updatePreferences);
      preference.removeEventListener("change", updatePreferences);
      stopAnimations();
      dialog.close();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [completeDismiss, play, presentation, stopAnimations]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    const height = panelRef.current?.offsetHeight;
    if (event.button !== 0 || !event.isPrimary || drag.current || finished.current || !height) return;
    const start = readSheet();
    stopAnimations();
    moveSheet(start);
    motion.current.closing = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      height,
      start,
      current: start,
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

    const raw = active.start.y + dy;
    const y = raw >= 0 ? raw : raw * 44 / (44 + Math.abs(raw));
    const shade = y >= active.start.y
      ? active.start.shade * Math.max(0, 1 - (y - active.start.y) / Math.max(1, active.height - active.start.y))
      : active.start.shade + (1 - active.start.shade) * Math.min(1, (active.start.y - y) / Math.max(1, active.start.y));
    active.current = { y, shade };
    active.samples.push({ y: event.clientY, time: event.timeStamp });
    while (active.samples.length > 2 && event.timeStamp - active.samples[0].time > VELOCITY_WINDOW) {
      active.samples.shift();
    }
    moveSheet(active.current);
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
    const threshold = Math.min(146, active.height * 0.34);
    const projected = active.current.y + releaseVelocity * 0.20;
    if (!cancelled && active.tracking && active.current.y > 10 && projected >= threshold) {
      settleSheet(active.current, { y: active.height, shade: 0 }, releaseVelocity, true);
    } else {
      settleSheet(active.current, { y: 0, shade: 1 }, active.tracking && !cancelled ? releaseVelocity : 0);
    }
  }

  return createPortal(
    <dialog
      aria-label={label}
      className="atlas-dialog"
      data-presentation={presentation}
      onCancel={(event) => {
        event.preventDefault();
        dismiss(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss(event);
      }}
      ref={dialogRef}
    >
      <div aria-hidden="true" className="atlas-dialog-shade" ref={shadeRef} />
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

function opacityTiming(): KeyframeAnimationOptions {
  return { duration: 120, fill: "both" };
}

function surfaceTiming(dialog: HTMLDialogElement, reduced: boolean, duration: number): KeyframeAnimationOptions {
  return {
    ...(reduced ? opacityTiming() : { duration, fill: "both" }),
    easing: getComputedStyle(dialog).getPropertyValue("--atlas-press-ease").trim()
  };
}

function sheetTranslate(y: number): string {
  return `0 ${y}px`;
}

function springPositions(start: SheetPosition, target: SheetPosition, velocity: number, closing: boolean) {
  const positions = [start];
  const displacement = start.y - target.y;
  // Sample the critically damped spring once so the compositor can play the release.
  const slope = velocity + SPRING_FREQUENCY * displacement;
  let elapsed = SPRING_STEP;
  for (; elapsed < SPRING_MAX_DURATION; elapsed += SPRING_STEP) {
    const seconds = elapsed / 1000;
    const decay = Math.exp(-SPRING_FREQUENCY * seconds);
    const delta = (displacement + slope * seconds) * decay;
    const speed = (velocity - SPRING_FREQUENCY * slope * seconds) * decay;
    if ((Math.abs(delta) < .75 && Math.abs(speed) < 18) || (closing && delta >= 0)) break;
    const y = Math.max(-18, target.y + delta);
    const progress = displacement ? Math.min(1, Math.max(0, (start.y - y) / displacement)) : 1 - decay;
    positions.push({ y, shade: start.shade + (target.shade - start.shade) * progress });
  }
  positions.push(target);
  return { positions, duration: elapsed };
}
