import type { BloomLevel, QuestionDifficulty } from "./types";

export type BlockQuestionDesignRule = {
  blockId: string;
  title: string;
  avoid: readonly string[];
  prefer: readonly string[];
  difficultyDrivers: readonly string[];
  recallSignals: readonly RegExp[];
  transferSignals: readonly RegExp[];
};

export const TARGET_DIFFICULTY_DISTRIBUTION: Record<QuestionDifficulty, string> = {
  easy: "5–10%",
  medium: "35–45%",
  hard: "35–45%",
  very_hard: "10–20%"
};

export const TARGET_BLOOM_DISTRIBUTION: Partial<Record<BloomLevel, string>> = {
  recall: "maximal 10–15%",
  understanding: "maximal 20–25%",
  application: "zusammen mit Mechanismus, Transfer und klinischem Denken mindestens 60–70%",
  mechanism: "zusammen mit Anwendung, Transfer und klinischem Denken mindestens 60–70%",
  transfer: "zusammen mit Anwendung, Mechanismus und klinischem Denken mindestens 60–70%",
  clinical_reasoning: "zusammen mit Anwendung, Mechanismus und Transfer mindestens 60–70%"
};

const genericTransferSignals = [
  /\bwarum\b/i,
  /\bwelche folge\b/i,
  /\bwelche konsequenz\b/i,
  /\bam ehesten\b/i,
  /\bfall(?:beispiel|vignette)?\b/i,
  /\bpatient(?:in|en)?\b/i,
  /\bführt .* zu\b/i,
  /\bmechanismus\b/i,
  /\bvergleich\b/i,
  /\binterpret/i,
  /\bunter der annahme\b/i
];

export const BLOCK_QUESTION_DESIGN_RULES: Record<string, BlockQuestionDesignRule> = {
  block5: {
    blockId: "block5",
    title: "Medical Humanities",
    avoid: ["Autorennamen", "Jahreszahlen", "triviale Definitionen", "reine Faktenlisten"],
    prefer: [
      "ethische Konflikte und klinische Entscheidungssituationen",
      "Abwägung von Autonomie und Fürsorge",
      "Wissenschaftstheorie anwenden",
      "Krankheitsmodelle und philosophische Konsequenzen vergleichen"
    ],
    difficultyDrivers: ["Abwägung", "Anwendung", "Konsequenzen", "Konflikte", "Differenzierung"],
    recallSignals: [/\bwer (?:war|entwickelte|prägte|sagte|beschrieb)\b/i, /\bwelche[rs]? autor/i, /\bwelches jahr\b/i],
    transferSignals: genericTransferSignals
  },
  block6: {
    blockId: "block6",
    title: "Public Health / Umweltmedizin",
    avoid: ["Listenfragen", "Namensfragen", "triviale Epidemiologie-Definitionen"],
    prefer: [
      "Bias und Confounding anwenden",
      "Studiendesigns und Risiken interpretieren",
      "Screening- und Präventionsprobleme beurteilen",
      "Population und Individuum differenzieren"
    ],
    difficultyDrivers: ["Interpretation", "Fallvignetten", "Datenverständnis", "Studiendesign-Differenzierung"],
    recallSignals: [/\bwie lautet die definition\b/i, /\bwelche determinant/i, /\bwer (?:entwickelte|prägte)\b/i],
    transferSignals: [...genericTransferSignals, /\b(odds ratio|relatives risiko|confound|bias|screening)\b/i]
  },
  block7: {
    blockId: "block7",
    title: "Psychosoziale Medizin",
    avoid: ["reine Definitionen", "Autorennamen", "unscharfe Alles-stimmt-Fragen"],
    prefer: [
      "biopsychosoziale Dynamiken",
      "Stress, Coping und Resilienz klinisch anwenden",
      "Arzt-Patient-Interaktionen interpretieren",
      "ähnliche psychologische Konzepte differenzieren"
    ],
    difficultyDrivers: ["mehrdimensionale Fälle", "Interpretation", "Transfer", "Konzeptdifferenzierung"],
    recallSignals: [/\bwer (?:entwickelte|prägte|beschrieb)\b/i, /\bwie ist .* definiert\b/i],
    transferSignals: [...genericTransferSignals, /\b(coping|resilienz|bindung|interaktion|soziale determinante)\b/i]
  },
  block8: {
    blockId: "block8",
    title: "Muskel / Bewegung / Biomechanik",
    avoid: ["Proteinlisten", "reine Definitionsfragen"],
    prefer: [
      "Mehrschritt-Mechanismen und Ursache-Wirkung",
      "Reflexlogik und elektromechanische Kopplung",
      "Muskeltypen funktionell vergleichen",
      "pathophysiologische Konsequenzen und Kurven interpretieren"
    ],
    difficultyDrivers: ["Mehrschritt-Mechanismen", "Vergleiche", "klinische Konsequenzen", "Kurveninterpretation"],
    recallSignals: [/\bwelches protein\b/i, /\bwelche struktur bindet\b/i, /\bwie heisst\b/i],
    transferSignals: [...genericTransferSignals, /\b(kraft|geschwindigkeit|leistung|querbrücke|reflex|calcium|pathophysi)\b/i]
  },
  block9: {
    blockId: "block9",
    title: "Molekulargenetik / Entwicklung",
    avoid: ["Syndromlisten", "isolierte Gennamen-Abfragen"],
    prefer: [
      "genetische Mechanismen und Entwicklungslogik",
      "Imprinting, Repeat Expansion und UPD differenzieren",
      "Signalwege und Folgen genetischer Fehler verknüpfen",
      "Syndrome mechanistisch anhand von Fällen unterscheiden"
    ],
    difficultyDrivers: ["Mechanismuskombinationen", "klinische Anwendung", "Transfer", "Differenzierung"],
    recallSignals: [/\bwelches gen\b/i, /\bwelches syndrom ist\b/i, /\bwie heisst\b/i],
    transferSignals: [...genericTransferSignals, /\b(imprinting|repeat|upd|signalweg|vererbung|mutation|entwicklung)\b/i]
  }
};

export function blockQuestionDesignRule(blockId: string | null): BlockQuestionDesignRule | null {
  return blockId ? BLOCK_QUESTION_DESIGN_RULES[blockId] || null : null;
}
