import { blockColor } from "./blockColors";
import { mc1Catalog, mc1CatalogBlockLabel } from "./mc1Altfragen";
import { examForBlock, type ExamId } from "./studyProgram";
import type { AssessmentSummary } from "./types";

type Catalog = Pick<AssessmentSummary, "id" | "block" | "title" | "lectureCode">;

function normalizedLabel(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function legacyBlock(value: string): string | null {
  const label = normalizedLabel(value).replace(/[_-]+/g, " ");
  const match = label.match(/^(?:alt(?:fragen)?[\s·]+)?(?:(j2|year\s*2)\s+)?block\s*([1-9])(?:\s*·.+)?$/);
  if (!match || (match[1] && Number(match[2]) > 6)) return null;
  return `${match[1] ? "j2-" : ""}block${match[2]}`;
}

export function altfragenCatalogBlocks(assessment: Catalog): readonly string[] {
  const known = mc1Catalog(assessment.id);
  if (known) return known.blocks;

  const labels = [assessment.block, assessment.title, assessment.lectureCode];
  const mixed = labels.some((value) => {
    const label = normalizedLabel(value);
    return /\b(blockubergreifend|blockuebergreifend|blocke|bloecke|querschnitt|mischserie|gemischt)\b/.test(label)
      || /\bblock\s*\d+\s*(?:[-–—/,+&]|und\b|oder\b|bis\b)\s*(?:block\s*)?\d/.test(label);
  });
  if (mixed) return [];

  const candidates = [...new Set(labels.map(legacyBlock).filter((id): id is string => !!id))];
  if (candidates.length <= 1) return candidates;
  const [explicitYear] = candidates.filter((id) => id.startsWith("j2-"));
  if (candidates.length === 2 && explicitYear && candidates.includes(explicitYear.slice(3))) {
    return [explicitYear];
  }
  return [];
}

export function altfragenCatalogExam(assessment: Catalog): ExamId | null {
  const exams = [...new Set(altfragenCatalogBlocks(assessment).map(examForBlock))];
  return exams.length === 1 ? exams[0] : null;
}

export function altfragenCatalogBlockLabel(assessment: Catalog): string | null {
  const knownLabel = mc1CatalogBlockLabel(assessment.id);
  if (knownLabel) return knownLabel;
  const [block] = altfragenCatalogBlocks(assessment);
  return block ? `Block ${block.slice(-1)}` : null;
}

export function altfragenBlockAccent(blocks: readonly string[]): string {
  const ids = [...new Set(blocks)];
  return blockColor(ids.length === 1 ? ids[0] : "Altfragen");
}
