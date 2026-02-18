import 'dotenv/config';
import fs from "fs";
import OpenAI from "openai";

// AI agent for Playwright testing, by Thomas Segercrantz

console.log("AI agent started...");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const REPORT_PATH = "playwright-report/report.json";
const OUT_PATH = "ai-report.md";

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY env var.");
  process.exit(1);
}

if (!fs.existsSync(REPORT_PATH)) {
  console.error(`No report found at ${REPORT_PATH}. Run tests first.`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf-8"));

const bestTitle = (spec, t) =>
  (Array.isArray(t?.titlePath) && t.titlePath.filter(Boolean).join(" › ")) ||
  t?.title ||
  spec?.title ||
  spec?.file ||
  "Unnamed test";


function heuristicReport(summaryInput) {
  const failures = summaryInput.failures || [];
  if (!failures.length) {
    return `# AI QA Agent Report (Fallback)\n\n All tests passed.\n`;
  }

  let md = `# AI QA Agent Report (Fallback)\n\nFound **${failures.length}** failing test(s).\n\n`;
  failures.forEach((f, i) => {
    md += `## ${i + 1}) ${f.title}\n`;
    if (f.stack) md += `**Stack:**\n\`\`\`\n${f.stack}\n\`\`\`\n\n`;


    if (f.error.includes("strict mode violation")) {
      md += `**Likely cause:** Locator matched multiple elements.\n**Fix:** Scope the locator (e.g. \`main\`, a parent container) or use \`.first()\` / \`.nth()\`.\n\n`;
    } else if (f.error.toLowerCase().includes("timeout")) {
      md += `**Likely cause:** Waiting for the wrong condition or UI is slower.\n**Fix:** Assert on a stable element with \`expect(...).toBeVisible()\` / \`toHaveURL()\` instead of timeouts.\n\n`;
    } else if (f.error.toLowerCase().includes("viewport")) {
      md += `**Likely cause:** Element is inside a scrollable container.\n**Fix:** Scroll the container, or click the associated label rather than the hidden input.\n\n`;
    } else {
      md += `**Fix:** Open the Playwright HTML report and refine the selector/wait.\n\n`;
    }
  });

  return md;
}


function collectFailures(suite, out = []) {
  if (!suite) return out;

  const stripAnsi = (s = "") => s.replace(/\u001b\[[0-9;]*m/g, "");

  const bestTitle = (spec, t) =>
    (Array.isArray(t?.titlePath) && t.titlePath.filter(Boolean).join(" › ")) ||
    t?.title ||
    spec?.title ||
    spec?.file ||
    "Unnamed test";

  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      for (const r of t.results || []) {
        if (r.status === "failed") {
          out.push({
            title: bestTitle(spec, t),
            file: spec.file,
            error: stripAnsi(r.error?.message || "Unknown error"),
            stack: stripAnsi(r.error?.stack || ""),
          });
        }
      }
    }
  }

  for (const child of suite.suites || []) collectFailures(child, out);
  return out;
}


const rootSuite = report.suite || report;
const failures = collectFailures(rootSuite);

const summaryInput = {
  total: report.stats?.total ?? undefined,
  expected: report.stats?.expected ?? undefined,
  unexpected: report.stats?.unexpected ?? undefined,
  skipped: report.stats?.skipped ?? undefined,
  failures,
};

// If everything passed, still generate a short “all good” report (nice for CI)
const prompt = failures.length
  ? `You are a QA automation assistant. Summarize these Playwright test failures for a developer.
Return Markdown with:
1) Quick summary (1-3 bullets)
2) For each failing test: probable cause + actionable fix suggestions (Playwright-specific)
3) If locator issues: propose better locator strategy (roles, scoping, avoiding strict-mode issues)
4) If waits/timeouts: propose stable waits (expect().toHaveURL/toBeVisible etc.)
Keep it concise and practical.

Here is the JSON test result data:
${JSON.stringify(summaryInput, null, 2)}`
  : `You are a QA automation assistant. Generate a short Markdown report stating all tests passed.
Include a “what was verified” summary based on the test names/files:
${JSON.stringify(summaryInput, null, 2)}`;

let md;

try {
  const response = await client.responses.create({
    model: "gpt-5",
    input: prompt,
  });

  md = response.output_text || "No output received.";
} catch (err) {
  console.warn("OpenAI call failed, using fallback.");
  md = heuristicReport(summaryInput);
}


fs.writeFileSync(OUT_PATH, md);
console.log(`AI report written to ${OUT_PATH}`);
