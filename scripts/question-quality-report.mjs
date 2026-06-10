import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const assessmentDirectory = path.resolve(process.cwd(), "public/assessments");
const files = (await readdir(assessmentDirectory)).filter((file) => file.endsWith(".json")).sort();
const totals = {
  files: 0,
  questions: 0,
  kprim: 0,
  allTrue: 0,
  allFalse: 0,
  missingExplanation: 0,
  recallHeavy: 0,
  nameRecall: 0
};
const blocks = new Map();
const findings = [];

for (const file of files) {
  let assessment;
  try {
    assessment = JSON.parse(await readFile(path.join(assessmentDirectory, file), "utf8"));
  } catch (error) {
    findings.push({ file, question: "-", flags: [`invalid_json: ${error.message}`] });
    continue;
  }
  totals.files += 1;
  const block = normalizeBlock(assessment.block || file) || "unmapped";
  const blockStats = blocks.get(block) || { questions: 0, kprim: 0, allTrue: 0, allFalse: 0, recallHeavy: 0 };

  for (const [index, question] of (assessment.questions || []).entries()) {
    totals.questions += 1;
    blockStats.questions += 1;
    const flags = [];
    if (question.type === "KPRIM") {
      totals.kprim += 1;
      blockStats.kprim += 1;
      const correct = (question.options || []).filter((option) => option.correct === true).length;
      if (correct === 4) {
        totals.allTrue += 1;
        blockStats.allTrue += 1;
        flags.push("all_true_kprim");
      }
      if (correct === 0) {
        totals.allFalse += 1;
        blockStats.allFalse += 1;
        flags.push("all_false_kprim");
      }
    }
    if (!String(question.explanation || "").trim() && !question.structuredExplanation) {
      totals.missingExplanation += 1;
      flags.push("missing_explanation");
    }
    if (isRecallHeavy(question.stem || "")) {
      totals.recallHeavy += 1;
      blockStats.recallHeavy += 1;
      flags.push("too_recall_heavy");
    }
    if ((block === "block5" || block === "block6") && isNameRecall(question.stem || "")) {
      totals.nameRecall += 1;
      flags.push("name_recall");
    }
    if (flags.length) {
      findings.push({
        file,
        block,
        question: question.id || `q${index + 1}`,
        flags
      });
    }
  }
  blocks.set(block, blockStats);
}

console.log("\nATLAS Question Quality Report\n");
console.table(totals);
console.log("\nBlocks");
console.table([...blocks.entries()].map(([block, values]) => ({ block, ...values })));
console.log(`\nReview findings: ${findings.length}`);
console.log("Use the Admin area → Fragenqualität for filtering, review status and direct editing.");

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ totals, blocks: Object.fromEntries(blocks), findings }, null, 2));
}

function normalizeBlock(value) {
  const match = String(value).toLowerCase().match(/block[\s_-]*([1-9])/);
  return match ? `block${match[1]}` : null;
}

function isRecallHeavy(stem) {
  const value = normalize(stem);
  return /^(wer|was|welches?|welche|wie heisst|wie lautet|wo befindet|wann)\b/.test(value)
    && !/\b(warum|folge|konsequenz|am ehesten|patient|fall|mechanismus|interpret)\b/.test(value);
}

function isNameRecall(stem) {
  return /\bwer (?:war|entwickelte|prägte|sagte|beschrieb|formulierte)\b/i.test(stem)
    || /\bwelche[rs]? (?:autor|forscher|philosoph|person)\b/i.test(stem);
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
