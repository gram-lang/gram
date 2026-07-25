import type { Finding, Snippet, SkippedExtraction } from "./types";

export interface ReportInput {
	calibration: { ok: boolean; failures: Finding[] };
	selfTest: { findings: Finding[]; staleness: string | null };
	needsClassification: Snippet[];
	findings: Finding[];
	skipped: SkippedExtraction[];
	totalSnippets: number;
	snippetsById: Map<string, Snippet>;
}

function locate(snippetsById: Map<string, Snippet>, snippetId: string): string {
	const s = snippetsById.get(snippetId);
	if (!s) return snippetId;
	return s.line ? `${s.file}:${s.line}` : s.file;
}

function printSection(
	title: string,
	items: string[],
): void {
	if (items.length === 0) return;
	console.log(`\n${title} (${items.length})`);
	console.log("-".repeat(title.length));
	for (const item of items) console.log(`  ${item}`);
}

export function printReport(input: ReportInput): void {
	const { calibration, selfTest, needsClassification, findings, skipped, totalSnippets, snippetsById } =
		input;

	console.log(`Gram audit — ${totalSnippets} snippet(s) scanned.\n`);

	if (!calibration.ok) {
		console.log("!! CALIBRATION FAILURE !!");
		console.log(
			"The formatter changed content in the trusted syntax corpus — every",
			"format-diff finding below is unverified until this is resolved:",
		);
		for (const f of calibration.failures) {
			console.log(`  ${locate(snippetsById, f.snippetId)} — ${f.summary}`);
		}
		console.log();
	}

	if (selfTest.staleness) {
		console.log(`(info) ${selfTest.staleness}\n`);
	}

	printSection(
		"Self-test gaps / anomalies (tool coverage)",
		selfTest.findings.map((f) => f.summary),
	);

	printSection(
		"Needs manual classification (ambiguous must-parse/must-throw)",
		needsClassification.map((s) => `${s.file}:${s.line ?? "?"} (${s.sourceKind}, ${s.label ?? ""})`),
	);

	printSection(
		"Parse failures",
		findings
			.filter((f) => f.check === "parse" && f.severity === "flag")
			.map((f) => `${locate(snippetsById, f.snippetId)} — ${f.summary}`),
	);

	printSection(
		"Unexpected semantic warnings",
		findings
			.filter((f) => f.check === "warnings")
			.map((f) => `${locate(snippetsById, f.snippetId)} — ${f.summary}`),
	);

	printSection(
		"Construct vocabulary — never seen in the trusted corpus",
		findings
			.filter((f) => f.check === "vocabulary")
			.map((f) => `${locate(snippetsById, f.snippetId)} — ${f.summary}`),
	);

	const formatFindings = findings
		.filter((f) => f.check === "format-diff")
		.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
	printSection(
		"Format round-trip diffs (ranked by size)",
		formatFindings.map((f) => `${locate(snippetsById, f.snippetId)} — ${f.summary}`),
	);

	printSection(
		"Skipped (dynamic arguments, not extracted)",
		skipped.map((s) => `${s.file}:${s.line} — ${s.reason}`),
	);

	console.log(
		`\n${findings.filter((f) => f.severity === "flag").length} flag(s), ` +
			`${findings.filter((f) => f.severity === "info").length} info signal(s).`,
	);
}
