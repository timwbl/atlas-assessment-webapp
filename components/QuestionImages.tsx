"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AtlasIcon } from "./AtlasIcon";
import { AtlasDialog } from "./ui/AtlasDialog";
import { isQuestionImageSource } from "@/lib/questionImages";
import type { AssessmentQuestionImage } from "@/lib/types";

export function QuestionImages({ images }: { images?: AssessmentQuestionImage[] }) {
  const [active, setActive] = useState<number | null>(null);
  const validImages = useMemo(() => images?.filter(({ src }) => isQuestionImageSource(src)) ?? [], [images]);
  if (!validImages.length) return null;

  return (
    <div className="question-figures" aria-label="Abbildungen zur Frage" role="group">
      {validImages.map((item, index) => (
        <QuestionThumbnail key={index} item={item} onOpen={() => setActive(index)} />
      ))}
      {active !== null && validImages[active] && (
        <AtlasDialog
          className="question-image-viewer"
          label="Abbildungen zur Frage"
          onDismiss={() => setActive(null)}
          presentation="fullscreen"
        >
          {(dismiss) => (
            <ImageViewer
              item={validImages[active]}
              index={active}
              total={validImages.length}
              onClose={dismiss}
              onNavigate={setActive}
            />
          )}
        </AtlasDialog>
      )}
    </div>
  );
}

function QuestionThumbnail({ item, onOpen }: { item: AssessmentQuestionImage; onOpen: () => void }) {
  const [failedSource, setFailedSource] = useState("");
  const failed = failedSource === item.src;

  return (
    <figure className="question-figure">
      {failed ? (
        <div className="question-image-unavailable" role="status">
          <strong>Abbildung konnte nicht geladen werden.</strong>
          <span>{item.alt}</span>
        </div>
      ) : (
        <button
          aria-label={`Abbildung vergrössern: ${item.alt}`}
          className="question-figure-trigger"
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true });
            onOpen();
          }}
          type="button"
        >
          {/* The assessed source may be embedded or hosted on an author-provided HTTPS origin. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={item.alt} decoding="async" loading="lazy" onError={() => setFailedSource(item.src)} referrerPolicy="no-referrer" src={item.src} />
          <span aria-hidden="true" className="question-figure-expand">↗</span>
        </button>
      )}
      {item.caption && <figcaption>{item.caption}</figcaption>}
    </figure>
  );
}

type Point = { x: number; y: number };
type View = Point & { scale: number };

const FITTED: View = { x: 0, y: 0, scale: 1 };
const MAX_ZOOM = 4;

function ImageViewer({
  item, index, total, onClose, onNavigate
}: {
  item: AssessmentQuestionImage;
  index: number;
  total: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [failedSource, setFailedSource] = useState("");
  const failed = failedSource === item.src;
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const view = useRef<View>(FITTED);
  const pointers = useRef(new Map<number, Point>());
  const dimensions = useRef({ stage: { width: 0, height: 0 }, image: { width: 0, height: 0 } });
  const stageCenter = useRef<Point>({ x: 0, y: 0 });

  const draw = useCallback((next: View) => {
    const { image, stage } = dimensions.current;
    const limitX = Math.max(0, (image.width * next.scale - stage.width) / 2);
    const limitY = Math.max(0, (image.height * next.scale - stage.height) / 2);
    const x = Math.max(-limitX, Math.min(limitX, next.x));
    const y = Math.max(-limitY, Math.min(limitY, next.y));
    view.current = { x, y, scale: next.scale };
    if (imageRef.current) {
      imageRef.current.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${next.scale})`;
    }
  }, []);

  useLayoutEffect(() => {
    pointers.current.clear();
    draw(FITTED);
    setZoom(1);
  }, [draw, item.src]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return;

    function measure() {
      if (!stage || !image) return;
      dimensions.current = {
        stage: { width: stage.clientWidth, height: stage.clientHeight },
        image: { width: image.offsetWidth, height: image.offsetHeight }
      };
      const rect = stage.getBoundingClientRect();
      stageCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      draw(view.current);
    }

    const resize = new ResizeObserver(measure);
    resize.observe(stage);
    resize.observe(image);
    measure();
    return () => resize.disconnect();
  }, [draw, failed, item.src]);

  function applyZoom(scale: number) {
    const next = boundedZoom(scale);
    const ratio = next / view.current.scale;
    draw({ x: view.current.x * ratio, y: view.current.y * ratio, scale: next });
    setZoom(next);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || pointers.current.size >= 2 || failed) return;
    if (!pointers.current.size) {
      const rect = event.currentTarget.getBoundingClientRect();
      stageCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);
    const current = view.current;

    if (pointers.current.size === 1) {
      if (current.scale > 1) {
        draw({ x: current.x + next.x - previous.x, y: current.y + next.y - previous.y, scale: current.scale });
      }
      return;
    }

    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1];
    if (!other) return;
    const distanceBefore = Math.hypot(previous.x - other.x, previous.y - other.y);
    if (distanceBefore < 4) return;
    const distanceAfter = Math.hypot(next.x - other.x, next.y - other.y);
    const scale = boundedZoom(current.scale * distanceAfter / distanceBefore);
    const ratio = scale / current.scale;
    const midX = (other.x + previous.x) / 2 - stageCenter.current.x;
    const midY = (other.y + previous.y) / 2 - stageCenter.current.y;
    draw({
      x: midX + (next.x - previous.x) / 2 - (midX - current.x) * ratio,
      y: midY + (next.y - previous.y) / 2 - (midY - current.y) * ratio,
      scale
    });
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (pointers.current.delete(event.pointerId)) setZoom(view.current.scale);
  }

  function onStageKey(event: KeyboardEvent<HTMLDivElement>) {
    if (failed) return;
    const current = view.current;
    if (event.key === "+" || event.key === "=") applyZoom(current.scale + 0.5);
    else if (event.key === "-") applyZoom(current.scale - 0.5);
    else if (event.key === "0") applyZoom(1);
    else if (current.scale > 1 && event.key.startsWith("Arrow")) {
      const horizontal = event.key === "ArrowLeft" ? 48 : event.key === "ArrowRight" ? -48 : 0;
      const vertical = event.key === "ArrowUp" ? 48 : event.key === "ArrowDown" ? -48 : 0;
      draw({ ...current, x: current.x + horizontal, y: current.y + vertical });
    } else return;
    event.preventDefault();
  }

  return (
    <>
      <header className="question-viewer-header">
        <h2>{total > 1 ? `Abbildung ${index + 1} von ${total}` : "Abbildung"}</h2>
        <button aria-label="Bildbetrachter schliessen" className="question-viewer-close btn-secondary" onClick={onClose} type="button">×</button>
      </header>
      <div
        aria-label="Bildfläche. Mit Plus und Minus zoomen, mit den Pfeiltasten verschieben."
        className="question-viewer-stage"
        onKeyDown={onStageKey}
        onLostPointerCapture={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        ref={stageRef}
        role="region"
        tabIndex={0}
      >
        {failed ? (
          <p className="question-image-unavailable" role="status">Abbildung konnte nicht geladen werden. {item.alt}</p>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img alt={item.alt} decoding="async" draggable={false} onError={() => setFailedSource(item.src)} ref={imageRef} referrerPolicy="no-referrer" src={item.src} />
        )}
      </div>
      {item.caption && <p className="question-viewer-caption">{item.caption}</p>}
      <footer className="question-viewer-toolbar">
        {total > 1 && (
          <div aria-label="Abbildungen durchblättern" className="question-viewer-pages" role="group">
            <button aria-label="Vorherige Abbildung" className="btn-secondary" disabled={index === 0} onClick={() => { onNavigate(index - 1); stageRef.current?.focus({ preventScroll: true }); }} type="button"><AtlasIcon name="chevronRight" /></button>
            <button aria-label="Nächste Abbildung" className="btn-secondary" disabled={index + 1 === total} onClick={() => { onNavigate(index + 1); stageRef.current?.focus({ preventScroll: true }); }} type="button"><AtlasIcon name="chevronRight" /></button>
          </div>
        )}
        <div aria-label="Bildgrösse" className="question-viewer-zoom" role="group">
          <button aria-label="Verkleinern" className="btn-secondary" disabled={failed || zoom <= 1} onClick={() => applyZoom(view.current.scale - 0.5)} type="button">−</button>
          <button aria-label={`Bild einpassen, ${Math.round(zoom * 100)} Prozent`} className="btn-secondary" disabled={failed} onClick={() => applyZoom(1)} type="button">{Math.round(zoom * 100)} %</button>
          <button aria-label="Vergrössern" className="btn-secondary" disabled={failed || zoom >= MAX_ZOOM} onClick={() => applyZoom(view.current.scale + 0.5)} type="button">+</button>
        </div>
      </footer>
    </>
  );
}

function boundedZoom(scale: number) {
  return Math.max(1, Math.min(MAX_ZOOM, scale));
}
