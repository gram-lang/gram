import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
	CONFORMANCE_CASES_DIR,
	PHYSICAL_FIXTURES,
	REPO_ROOT,
} from "../config";
import type { Snippet } from "../types";

export function extractPhysicalFixtures(): Snippet[] {
	const snippets: Snippet[] = [];
	for (const relPath of PHYSICAL_FIXTURES) {
		const absPath = join(REPO_ROOT, relPath);
		if (!existsSync(absPath)) continue;
		snippets.push({
			id: `${relPath}:1`,
			sourceKind: "physical-fixture",
			file: relPath,
			line: 1,
			content: readFileSync(absPath, "utf-8"),
			expectation: "must-parse",
			// e.g. kitchen/tests/fixtures/valid/with_warnings.gram is titled
			// "Recipe with ALL warnings" and deliberately triggers every
			// WarningCode on purpose (already snapshot-tested by
			// snapshots.test.ts) — flagging each one here would be pure noise.
			skipWarningsCheck: /warning/i.test(relPath),
		});
	}
	return snippets;
}

export function extractConformanceCases(): Snippet[] {
	const casesDir = join(REPO_ROOT, CONFORMANCE_CASES_DIR);
	if (!existsSync(casesDir)) return [];

	const snippets: Snippet[] = [];
	const caseNames = readdirSync(casesDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();

	for (const name of caseNames) {
		const caseDir = join(casesDir, name);
		const inputPath = join(caseDir, "input.gram");
		if (!existsSync(inputPath)) continue;

		const relPath = relative(REPO_ROOT, inputPath);
		const errorGoldenPath = join(caseDir, "error.json");
		// Only a genuine GramParseError (error.json.offset !== null) means
		// getAST() itself must throw. A ScaleError (error.json.code set,
		// offset null) is thrown later, during scale-target resolution with
		// options.json's scaleTarget — out of scope for a bare getAST check,
		// so those cases are still expected to parse cleanly here.
		let expectation: Snippet["expectation"] = "must-parse";
		if (existsSync(errorGoldenPath)) {
			try {
				const golden = JSON.parse(readFileSync(errorGoldenPath, "utf-8"));
				if (golden?.offset !== null && golden?.offset !== undefined) {
					expectation = "must-throw";
				}
			} catch {
				expectation = "must-throw"; // malformed golden — be conservative
			}
		}

		// Every conformance case's golden already records whatever warnings are
		// correct for it — not just warn-* cases (e.g. 021/022 are ordinary
		// numbered cases whose golden legitimately includes a MISSING_UNIT
		// warning for invalid retro-planning input). Read it for all of them.
		const expectedWarningCodes = readExpectedWarningCodes(caseDir);

		snippets.push({
			id: `${relPath}:1`,
			sourceKind: "conformance-case",
			file: relPath,
			line: 1,
			content: readFileSync(inputPath, "utf-8"),
			label: name,
			expectation,
			expectedWarningCodes,
		});
	}
	return snippets;
}

// warn-* cases record their intentional warnings in the golden compiled.json
// / analyzed.json — read those back rather than re-deriving what's
// "expected", so the check only ever flags genuinely new/unrecorded warnings.
function readExpectedWarningCodes(caseDir: string): string[] {
	const codes = new Set<string>();
	for (const goldenName of ["compiled.json", "analyzed.json"]) {
		const path = join(caseDir, goldenName);
		if (!existsSync(path)) continue;
		try {
			const golden = JSON.parse(readFileSync(path, "utf-8"));
			const warnings = golden?.warnings ?? golden?.result?.warnings;
			if (Array.isArray(warnings)) {
				for (const w of warnings) {
					if (w && typeof w.code === "string") codes.add(w.code);
				}
			}
		} catch {
			// malformed golden — leave codes as-is, the parse/warnings check
			// will surface the real problem elsewhere.
		}
	}
	return [...codes];
}
