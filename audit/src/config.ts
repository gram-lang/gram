import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// audit/src/config.ts -> repo root is two levels up.
export const REPO_ROOT = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
);

// The Astro/Starlight content collection: `docs/` is English, `fr/docs/` French.
const DOCS_CONTENT_EN = "packages/docs/src/content/docs/docs";
const DOCS_CONTENT_FR = "packages/docs/src/content/docs/fr/docs";
const SYNTAX_DIR_EN = `${DOCS_CONTENT_EN}/reference/syntax`;
const SYNTAX_DIR_FR = `${DOCS_CONTENT_FR}/reference/syntax`;

// A page is `.md` or `.mdx` depending on whether it needs components; the
// same page keeps the same extension in both languages, but nothing here
// should depend on that. A page found in neither form is a hard error (see
// `missingConfiguredPaths`): silently skipping it is how this tool once kept
// running for weeks on an empty trusted corpus.
const docPage = (dir: string, name: string): string => {
	for (const ext of [".md", ".mdx"]) {
		const candidate = join(dir, `${name}${ext}`);
		if (existsSync(join(REPO_ROOT, candidate))) return candidate;
	}
	return join(dir, `${name}.md`);
};

// The trusted vocabulary corpus: syntax reference pages the project owner has
// personally re-read and validated repeatedly (both locales — confirmed
// equally trusted, not just the EN original). `ai-generation-notes.md` is
// excluded here because its ❌/✅ pairs are handled separately as a self-test
// fixture set (see extract/self-test-cases.ts), not as plain trusted fences.
export const TRUSTED_SYNTAX_FILES: string[] = [
	"cheatsheet",
	"composite-ingredients",
	"cookware",
	"document-structure",
	"ingredients",
	"intermediate-variables",
	"relative-quantities",
	"temperatures",
	"times",
].flatMap((name) => [
	docPage(SYNTAX_DIR_EN, name),
	docPage(SYNTAX_DIR_FR, name),
]);

export const AI_GENERATION_NOTES_FILES: string[] = [
	docPage(SYNTAX_DIR_EN, "ai-generation-notes"),
	docPage(SYNTAX_DIR_FR, "ai-generation-notes"),
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
	`${DOCS_CONTENT_EN}/tutorials`,
	`${DOCS_CONTENT_FR}/tutorials`,
	`${DOCS_CONTENT_EN}/how-to`,
	`${DOCS_CONTENT_FR}/how-to`,
];

// Everything under here is scanned for ```gram fences; anything already in
// TRUSTED_SYNTAX_FILES / AI_GENERATION_NOTES_FILES is skipped by the scanner
// (see extract/markdown-fences.ts) so it isn't double-counted.
export const DOCS_ROOTS: string[] = ["packages/docs/src", "README.md"];

// Never descend into dependencies or Astro's generated output.
export const DOCS_EXCLUDE_DIRS: string[] = ["node_modules", ".astro"];

export const PHYSICAL_FIXTURES: string[] = [
	"packages/kitchen/tests/fixtures/valid/simple_recipe.gram",
	"packages/kitchen/tests/fixtures/valid/with_warnings.gram",
	"packages/renderer/tests/fixtures/sample.gram",
	"packages/docs/public/examples/canneles.gram",
	"packages/docs/public/examples/canneles-fr.gram",
	"packages/docs/public/examples/empanadas.gram",
	"packages/docs/public/examples/empanadas-fr.gram",
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

/**
 * Every path the tool is configured to read that does not exist. The extractors
 * skip a missing file quietly (a recipe folder may legitimately be empty), so
 * without this check a docs reorganisation leaves the audit running on less
 * and less, and reporting on it as if nothing were wrong.
 */
export function missingConfiguredPaths(): string[] {
	const configured = [
		...TRUSTED_SYNTAX_FILES,
		...AI_GENERATION_NOTES_FILES,
		...NARRATIVE_DOC_DIRS,
		...DOCS_ROOTS,
		...PHYSICAL_FIXTURES,
		...FORMATTER_TEST_FILES,
		CONFORMANCE_CASES_DIR,
		TEST_GLOB_ROOT,
	];
	return configured.filter((path) => !existsSync(join(REPO_ROOT, path)));
}

