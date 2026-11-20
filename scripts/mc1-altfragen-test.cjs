const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const modules = new Map();
let stored = null;

function load(file) {
  const filename = path.resolve(root, file);
  if (modules.has(filename)) return modules.get(filename).exports;
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  modules.set(filename, module);
  const localRequire = (name) => {
    if (name === "server-only") return {};
    if (name === "@netlify/blobs") return {
      getStore: () => ({
        get: async () => stored,
        setJSON: async (_key, value, options) => {
          assert.equal(options.onlyIfNew, true);
          if (stored) return { modified: false };
          stored = value;
          return { modified: true };
        },
      }),
    };
    if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
    if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), name + ".ts"));
    return require(name);
  };
  Function("require", "module", "exports", output)(localRequire, module, module.exports);
  return module.exports;
}

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-anon-key";
  global.fetch = async (input, options) => {
    const url = new URL(input);
    const role = options.headers.Authorization.slice(7);
    assert.equal(url.hostname, "auth.fixture.invalid");
    if (!["admin", "approved", "pending"].includes(role)) {
      return Response.json({}, { status: 401 });
    }
    if (url.pathname === "/auth/v1/user") return Response.json({ id: role });
    if (url.pathname === "/rest/v1/profiles") {
      return Response.json([{ id: role, role: role === "admin" ? "admin" : "student" }]);
    }
    assert.equal(url.pathname, "/rest/v1/altfragen_access_requests");
    return Response.json([{ status: role === "approved" ? "approved" : "pending" }]);
  };

  const list = load("app/api/altfragen/kataloge/route.ts");
  const detail = load("app/api/assessments/[id]/route.ts");
  const { MC1_CATALOGS } = load("lib/mc1Altfragen.ts");
  const {
    altfragenBlockAccent, altfragenCatalogBlockLabel, altfragenCatalogBlocks, altfragenCatalogExam,
  } = load("lib/altfragenCatalog.ts");
  const { blockColor } = load("lib/blockColors.ts");
  const j1Exams = ["eMC1", "eMC2", "eMC2", "eMC2", "eMC3", "eMC4", "eMC3", "eMC3", "eMC4"];
  for (const [index, exam] of j1Exams.entries()) {
    const number = index + 1;
    const fixture = JSON.parse(fs.readFileSync(
      path.join(root, "public/assessments", `Altfragen_Block_${number}_ATLAS_Assessment.json`), "utf8"
    ));
    const blocks = altfragenCatalogBlocks(fixture);
    assert.deepEqual(blocks, [`block${number}`]);
    assert.equal(altfragenCatalogBlockLabel(fixture), `Block ${number}`);
    assert.equal(altfragenCatalogExam(fixture), exam);
    assert.equal(altfragenBlockAccent(blocks), blockColor(`block${number}`));
  }
  for (const catalog of MC1_CATALOGS) {
    const fixture = { id: catalog.id, title: "MC1", lectureCode: "ALT-J2-MC1", block: "Altfragen" };
    const blocks = altfragenCatalogBlocks(fixture);
    assert.deepEqual(blocks, catalog.blocks);
    assert.equal(altfragenCatalogExam(fixture), "eMC1");
    assert.equal(altfragenBlockAccent(blocks), blockColor(blocks.length === 1 ? blocks[0] : "Altfragen"));
  }
  for (const [title, lectureCode] of [
    ["J2 · Sammlung 2026", "ALT-2026"],
    ["Altfragen Block 1–3", "ALT-BLOCK-1"],
    ["Altfragen Block 5 und Block 7", "ALT-BLOCK-5"],
    ["Altfragen Block 2", "ALT-BLOCK-3"],
  ]) {
    const fixture = { id: "unzugeordnet", title, lectureCode, block: "Altfragen" };
    assert.equal(altfragenCatalogExam(fixture), null);
    assert.equal(altfragenCatalogBlockLabel(fixture), null);
    assert.equal(altfragenBlockAccent(altfragenCatalogBlocks(fixture)), "#8e8e93");
  }
  if (process.argv[2]) {
    const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    const { validateMc1Catalogs } = load("lib/serverMc1Altfragen.ts");
    assert.equal(validateMc1Catalogs(payload).flatMap((catalog) => catalog.questions).length, 185);
  }
  const example = (catalog) => ({
    id: catalog.id, block: "Altfragen", title: "Synthetischer Katalog",
    lectureCode: catalog.id, learningObjectives: [{ id: "lo", text: "Testlernziel" }],
    questions: Array.from({ length: catalog.count }, (_, index) => ({
      id: `${catalog.id}-${index}`, stem: "Synthetischer Fragetext", type: "A",
      learningObjectiveId: "lo", explanation: "Synthetische Begründung",
      options: [{ id: "A", text: "Richtig", correct: true }, { id: "B", text: "Falsch", correct: false }],
    })),
  });
  const catalogs = MC1_CATALOGS.map(example);
  const request = (token, body) => new Request("https://atlas.fixture.invalid", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
  });
  const params = { params: Promise.resolve({ id: catalogs[0].id }) };

  assert.equal((await list.GET(request())).status, 401);
  assert.equal((await list.GET(request("pending"))).status, 403);
  assert.equal((await detail.GET(request(), params)).status, 401);
  assert.equal((await detail.GET(request("pending"), params)).status, 403);
  assert.equal((await list.POST(request("approved", catalogs))).status, 403);
  assert.equal((await list.POST(request("admin", catalogs.slice(1)))).status, 400);
  const count = await (await list.POST(request("admin", catalogs))).json();
  assert.deepEqual(count, { catalogCount: 6, questionCount: 185 });
  assert.equal((await list.POST(request("admin", catalogs))).status, 200);
  assert.equal((await list.POST(request("admin", [{ ...catalogs[0], title: "Anderer Titel" }, ...catalogs.slice(1)]))).status, 409);

  const catalog = await list.GET(request("approved"));
  assert.equal(catalog.status, 200);
  assert.match(catalog.headers.get("cache-control"), /private, no-store/);
  const { assessments } = await catalog.json();
  assert.equal(assessments.length, 6);
  assert.ok(assessments.every(({ assessment }) => !("questions" in assessment)));
  const authorized = await detail.GET(request("approved"), params);
  assert.equal(authorized.status, 200);
  assert.match(authorized.headers.get("cache-control"), /private, no-store/);
  assert.equal((await authorized.json()).assessment.questions.length, catalogs[0].questions.length);
  assert.equal((await detail.GET(request("pending"), params)).status, 403);
  console.log("MC1-Altfragen: Authentifizierung, Freigabe, Admin-Import und Cache-Schutz geprüft.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
