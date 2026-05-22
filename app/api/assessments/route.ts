import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { validateAssessment } from "@/lib/assessmentValidator";
import type { LoadedAssessment } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const directory = path.join(process.cwd(), "public", "assessments");
  const loaded: LoadedAssessment[] = [];

  let files: string[] = [];

  try {
    files = (await fs.readdir(directory))
      .filter((file) => file.toLowerCase().endsWith(".json"))
      .sort((a, b) => a.localeCompare(b, "de", { numeric: true, sensitivity: "base" }));
  } catch {
    return NextResponse.json({
      assessments: [],
      errors: ["Ordner /public/assessments wurde nicht gefunden."]
    });
  }

  for (const file of files) {
    const fullPath = path.join(directory, file);

    try {
      const raw = JSON.parse(await fs.readFile(fullPath, "utf8")) as unknown;
      const result = validateAssessment(raw);

      if (result.ok) {
        loaded.push({
          file,
          assessment: result.value.active === false ? null : result.value,
          errors: result.value.active === false ? ["Assessment ist deaktiviert."] : [],
          warnings: result.warnings
        });
      } else {
        loaded.push({ file, assessment: null, errors: result.errors, warnings: [] });
      }
    } catch (error) {
      loaded.push({
        file,
        assessment: null,
        errors: [error instanceof Error ? error.message : "JSON konnte nicht gelesen werden."],
        warnings: []
      });
    }
  }

  return NextResponse.json({ assessments: loaded });
}
