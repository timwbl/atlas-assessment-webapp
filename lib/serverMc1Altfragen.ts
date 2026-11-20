import "server-only";
import { getStore } from "@netlify/blobs";
import { validateAssessment } from "./assessmentValidator";
import { MC1_CATALOGS, mc1Catalog } from "./mc1Altfragen";
import type { Assessment } from "./types";

const STORE = "atlas-altfragen";
const KEY = "hs2026-mc1";

function store() {
  return getStore({ name: STORE, consistency: "strong", region: "eu-central-1" });
}

export function validateMc1Catalogs(raw: unknown): Assessment[] {
  if (!Array.isArray(raw) || raw.length !== MC1_CATALOGS.length) {
    throw new Error("Erwartet wird eine JSON-Datei mit allen sechs MC1-Katalogen.");
  }

  const byId = new Map<string, Assessment>();
  const questionIds = new Set<string>();
  for (const item of raw) {
    const result = validateAssessment(item);
    if (!result.ok) throw new Error(result.errors.join(" "));
    const assessment = result.value;
    const spec = mc1Catalog(assessment.id);
    if (!spec || byId.has(assessment.id) || !assessment.active || assessment.questions.length !== spec.count) {
      throw new Error("Die Katalogkennungen oder Fragenzahlen stimmen nicht mit der MC1-Auswahl überein.");
    }
    const objectiveIds = new Set(assessment.learningObjectives.map((objective) => objective.id));
    for (const question of assessment.questions) {
      if (questionIds.has(question.id) || !question.explanation || !objectiveIds.has(question.learningObjectiveId)) {
        throw new Error("Die Fragen benötigen eindeutige Kennungen, Lernziele und Begründungen.");
      }
      questionIds.add(question.id);
    }
    const block = spec.blocks.length === 1 ? `J2 Block ${spec.blocks[0].slice(-1)}` : "J2 Blöcke 1–3";
    byId.set(assessment.id, { ...assessment, block: `Altfragen · ${block}` });
  }
  return MC1_CATALOGS.map(({ id }) => byId.get(id)!);
}

export async function loadMc1Catalogs(): Promise<Assessment[]> {
  const data = await store().get(KEY, { type: "json" });
  return data === null ? [] : validateMc1Catalogs(data);
}

export async function loadMc1Assessment(id: string): Promise<Assessment | null> {
  if (!mc1Catalog(id)) return null;
  return (await loadMc1Catalogs()).find((assessment) => assessment.id === id) || null;
}

export async function saveMc1Catalogs(catalogs: Assessment[]): Promise<boolean> {
  const storage = store();
  const result = await storage.setJSON(KEY, catalogs, { onlyIfNew: true });
  if (result.modified) return true;
  const saved = await storage.get(KEY, { type: "json" });
  return JSON.stringify(saved) === JSON.stringify(catalogs);
}
