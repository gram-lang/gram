export type SourceKind =
	| "trusted-corpus" // reference/syntax/*.md (EN+FR) ✅ fences — known-good vocabulary
	| "self-test-bad" // ai-generation-notes.md ❌ examples — must be caught by the checks
	| "self-test-good" // ai-generation-notes.md ✅ examples — must NOT be flagged
	| "physical-fixture" // packages/*/tests/fixtures/**/*.gram + docs/src/public/examples/*.gram
	| "conformance-case" // conformance/cases/*/input.gram
	| "inline-test-literal" // getAST(...) / parseDocument(...) / formatGram(...) string args
	| "inline-test-tmpfile" // writeFile(...)/writeFileSync(...) gram-looking content in tests
	| "docs-fence-nontrusted"; // gram fences outside the trusted corpus (+ root README.md)

export type Expectation = "must-parse" | "must-throw" | "unclear";

export interface Snippet {
	id: string; // `${file}:${line}`
	sourceKind: SourceKind;
	file: string; // repo-relative path
	line?: number;
	content: string;
	label?: string; // conformance case name, or self-test mistake label
	expectation: Expectation;
	expectedWarningCodes?: string[]; // populated for conformance cases from their golden warnings
	warningsExpected?: boolean; // true: this snippet intentionally triggers warnings by design (e.g. a "with_warnings" fixture), don't flag any of them
}

export type CheckName =
	| "parse"
	| "warnings"
	| "format-diff"
	| "vocabulary"
	| "self-test";

export interface SkippedExtraction {
	file: string;
	line: number;
	reason: string;
}

export interface Finding {
	snippetId: string;
	check: CheckName;
	severity: "flag" | "info";
	summary: string;
	detail?: string;
	rank?: number; // used to sort format-diff findings by magnitude
}
