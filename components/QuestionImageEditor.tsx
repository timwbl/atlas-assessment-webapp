"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { AssessmentQuestionImage } from "@/lib/types";
import { MAX_EMBEDDED_QUESTION_IMAGE_BYTES, QUESTION_IMAGE_MIME_TYPES } from "@/lib/questionImages";
import { QuestionImages } from "./QuestionImages";

export function QuestionImageEditor({
  images = [], onChange
}: { images?: AssessmentQuestionImage[]; onChange: (images: AssessmentQuestionImage[]) => void }) {
  const [message, setMessage] = useState("");
  const latest = useRef({ images, onChange });
  const reader = useRef<FileReader | null>(null);
  useLayoutEffect(() => { latest.current = { images, onChange }; }, [images, onChange]);
  useLayoutEffect(() => () => {
    const incoming = reader.current;
    if (incoming?.readyState === FileReader.LOADING) incoming.abort();
  }, []);

  function appendFile(file: File) {
    if (!QUESTION_IMAGE_MIME_TYPES.some((type) => type === file.type)) {
      setMessage("Wähle eine JPG-, PNG- oder WebP-Datei.");
      return;
    }
    if (file.size > MAX_EMBEDDED_QUESTION_IMAGE_BYTES) {
      setMessage("Bilddateien bis 1 MB lassen sich einbetten. Für grössere Bilder kannst du eine Bildadresse verwenden.");
      return;
    }
    reader.current?.abort();
    setMessage("");
    const incoming = new FileReader();
    reader.current = incoming;
    incoming.onload = () => {
      const src = incoming.result;
      if (typeof src === "string") {
        const current = latest.current;
        current.onChange([...current.images, { src, alt: "" }]);
      }
    };
    incoming.onerror = () => setMessage("Die Bilddatei konnte nicht gelesen werden.");
    incoming.readAsDataURL(file);
  }

  function update(index: number, changes: Partial<AssessmentQuestionImage>) {
    onChange(images.map((image, number) => number === index ? { ...image, ...changes } : image));
  }

  return (
    <details className="question-image-editor">
      <summary>{images.length ? `Abbildungen (${images.length})` : "Abbildungen hinzufügen"}</summary>
      {images.map((image, index) => (
        <fieldset className="question-image-fields" key={index}>
          <legend>Abbildung {index + 1}</legend>
          {image.src.startsWith("data:") ? (
            <span>Bilddatei eingebettet</span>
          ) : (
            <label>
              <span>Bildadresse</span>
              <input className="input" onChange={(event) => update(index, { src: event.target.value })} placeholder="https://… oder /assets/…" value={image.src} />
            </label>
          )}
          <label>
            <span>Bildbeschreibung für Screenreader</span>
            <textarea className="input" onChange={(event) => update(index, { alt: event.target.value })} rows={2} value={image.alt} />
          </label>
          <label>
            <span>Bildlegende (optional)</span>
            <input className="input" onChange={(event) => update(index, { caption: event.target.value })} value={image.caption ?? ""} />
          </label>
          <QuestionImages images={image.alt.trim() ? [image] : []} />
          <button className="btn-secondary" onClick={() => onChange(images.filter((_, position) => position !== index))} type="button">Abbildung entfernen</button>
        </fieldset>
      ))}
      <div className="question-image-editor-actions">
        <label>
          <span>Bilddatei anhängen</span>
          <input accept={QUESTION_IMAGE_MIME_TYPES.join(",")} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) appendFile(file);
            event.currentTarget.value = "";
          }} type="file" />
        </label>
        <button className="btn-secondary" onClick={() => onChange([...images, { src: "", alt: "" }])} type="button">Bildadresse hinzufügen</button>
      </div>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
