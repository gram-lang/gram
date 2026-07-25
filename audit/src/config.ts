import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// audit/src/config.ts -> repo root is two levels up.
export const REPO_ROOT = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
);

const SYNTAX_DIR_EN = "packages/docs/src/reference/syntax";
const SYNTAX_DIR_FR = "packages/docs/src/fr/reference/syntax";

// The trusted vocabulary corpus: syntax reference pages the project owner has
// personally re-read and validated repeatedly (both locales — confirmed
// equally trusted, not just the EN original). `ai-generation-notes.md` is
// excluded here because its ❌/✅ pairs are handled separately as a self-test
// fixture set (see extract/self-test-cases.ts), not as plain trusted fences.
export const TRUSTED_SYNTAX_FILES: string[] = [
	"cheatsheet.md",
	"composite-ingredients.md",
	"cookware.md",
	"document-structure.md",
	"ingredients.md",
	"intermediate-variables.md",
	"relative-quantities.md",
	"temperatures.md",
	"times.md",
].flatMap((name) => [join(SYNTAX_DIR_EN, name), join(SYNTAX_DIR_FR, name)]);

export const AI_GENERATION_NOTES_FILES: string[] = [
	join(SYNTAX_DIR_EN, "ai-generation-notes.md"),
	join(SYNTAX_DIR_FR, "ai-generation-notes.md"),
];

// Narrative/tutorial doc directories (EN+FR) build up one continuous recipe
// across several sequential ```gram fences on the same page (e.g.
// first-recipe.md declares `->&pastry dough{}` in one fence, then reuses
// `&pastry dough{}` in a later one) — each fence is an intentionally
// incomplete excerpt, not a standalone example, unlike reference/syntax/*.md.
// Evaluating one in isolation for semantic warnings produces structural false
// positives (e.g. UNDEFINED_REFERENCE for something declared in an earlier
// fence), so the warnings check is skipped for fences under these roots.
export const NARRATIVE_DOC_DIRS: string[] = [
	"packages/docs/src/tutorials",
	"packages/docs/src/fr/tutorials",
	"packages/docs/src/how-to",
	"packages/docs/src/fr/how-to",
];

// Everything under here is scanned for ```gram fences; anything already in
// TRUSTED_SYNTAX_FILES / AI_GENERATION_NOTES_FILES is skipped by the scanner
// (see extract/markdown-fences.ts) so it isn't double-counted.
export const DOCS_ROOTS: string[] = ["packages/docs/src", "README.md"];

// Never descend into build output.
export const DOCS_EXCLUDE_DIRS: string[] = [".vitepress/dist"];

export const PHYSICAL_FIXTURES: string[] = [
	"packages/kitchen/tests/fixtures/valid/simple_recipe.gram",
	"packages/kitchen/tests/fixtures/valid/with_warnings.gram",
	"packages/renderer/tests/fixtures/sample.gram",
	"packages/docs/src/public/examples/canneles.gram",
	"packages/docs/src/public/examples/canneles-fr.gram",
	"packages/docs/src/public/examples/empanadas.gram",
	"packages/docs/src/public/examples/empanadas-fr.gram",
];

export const CONFORMANCE_CASES_DIR = "conformance/cases";

export const TEST_GLOB_ROOT = "packages";

// Call targets whose first argument is raw Gram source (or a Gram-formatting
// target, for formatGram). compile()/analyze() are deliberately excluded:
// they consume an already-parsed AST/CompilationResult, never a raw string.
export const RAW_SOURCE_CALL_TARGETS = [
	"getAST",
	"parseDocument",
	"formatGram",
] as const;

export const TMPFILE_WRITE_CALL_TARGETS = ["writeFile", "writeFileSync"] as const;

// Test files whose whole purpose is exercising the formatter on deliberately
// non-canonical input (that's what they're testing: formatGram fixing it) —
// a format-diff finding there is never a mistake to review.
export const FORMATTER_TEST_FILES: string[] = [
	"packages/format/tests/formatter.test.ts",
	"packages/language-server/tests/formatting-parity.test.ts",
];

// A string must contain at least one real Gram sigil to be considered
// plausible Gram content — NOT a bare newline, which matches almost any
// multi-line fixture regardless of language (e.g. a YAML ingredient database
// written via writeFileSync in a language-server test) and would misclassify
// it as Gram source.
export const GRAM_SIGNAL_PATTERN = /(@|#|~|\^|->&)/;
