"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/clientChunkRecovery";

type Props = {
  children: ReactNode;
  resetKey: string;
};

type State = {
  error: Error | null;
};

export class AdminContentBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error)) {
      void recoverFromChunkLoadError(error);
      return;
    }
    console.error("ATLAS admin section failed", { error, componentStack: info.componentStack });
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunkError = isChunkLoadError(this.state.error);
    return (
      <section className="card admin-error-boundary" role="alert">
        <div className="eyebrow">Admin-Bereich</div>
        <h2>{chunkError ? "Update wird neu geladen" : "Dieser Bereich konnte nicht geöffnet werden"}</h2>
        <p>
          {chunkError
            ? "ATLAS hat eine veraltete Programmdatei erkannt und lädt die aktuelle Version."
            : "Die übrigen Admin-Bereiche bleiben verfügbar. Du kannst den Bereich erneut öffnen oder die Seite aktualisieren."}
        </p>
        <div>
          <button className="btn-primary" onClick={() => window.location.reload()} type="button">Seite aktualisieren</button>
          <button className="btn-secondary" onClick={() => this.setState({ error: null })} type="button">Erneut versuchen</button>
        </div>
      </section>
    );
  }
}
