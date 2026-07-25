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
	// true: don't run the warnings check on this snippet at all, because a more
	// reliable ground truth already exists elsewhere for it — either its own
	// bun test assertions (inline-test-literal/-tmpfile), or it's a narrative
	// doc excerpt not meant to be a complete, standalone, warning-free example
	// (tutorials/how-to fences that build on an earlier fence on the same
	// page), or it's a fixture that intentionally triggers warnings by design
	// (e.g. a "with_warnings" fixture).
	skipWarningsCheck?: boolean;
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
