import { isComment, isSection, type RecipeAST } from "@gram-lang/parser";
import type { LintDiagnostic, LintSeverity } from "./types";

/**
 * What a project may set for one code in `.gram/config.yaml`: turn it off,
 * or show it at another severity. Never `error`: the config lowers or
 * silences a check, it does not make one blocking (`--strict` does).
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */
export type LintRuleSetting = "off" | Exclude<LintSeverity, "error">;

/**
 * The `lint:` block of `.gram/config.yaml`, read.
 *
 * @experimental
 */
export interface LintConfig {
	/** By code: `UNKNOWN_INGREDIENT: off`. */
	rules: Record<string, LintRuleSetting>;
}

const SETTINGS: ReadonlySet<string> = new Set([
	"off",
	"hint",
	"info",
	"warning",
]);

/**
 * Reads the `lint:` block of a project config (`raw` is the whole parsed
 * `.gram/config.yaml`). Never throws: anything that
 * does not read (a value that is not one of the settings, a block that is
 * not a map) is left out, without hiding the rest. Shared by the CLI and the
 * language server, which each read the file their own way.
 *
 * @experimental
 */
export function parseLintConfig(raw: unknown): LintConfig {
	const config: LintConfig = { rules: {} };
	if (!isMap(raw) || !isMap(raw.lint) || !isMap(raw.lint.rules)) return config;
	const lint = raw.lint as { rules: Record<string, unknown> };
	for (const [code, setting] of Object.entries(lint.rules)) {
		if (typeof setting === "string" && SETTINGS.has(setting)) {
			config.rules[code] = setting as LintRuleSetting;
		}
	}
	return config;
}

function isMap(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

/** `// gram-ignore CODE, OTHER_CODE`: the codes it names, or null for any other comment. */
const IGNORE = /^gram-ignore\s+([A-Z][A-Z0-9_]*(?:[\s,]+[A-Z][A-Z0-9_]*)*)\s*$/;

/** One `// gram-ignore` and the block it covers. */
interface IgnoreRange {
	codes: ReadonlySet<string>;
	start: number;
	end: number;
}

/**
 * Where each `// gram-ignore CODE` applies: the block right after it (other
 * `// gram-ignore` lines in between are allowed, each naming its own codes).
 * That block is a step, the whole step; or a section heading, its line alone.
 * Nothing else can carry one: a comment inside the frontmatter would empty
 * it, and none may stand before a `@use`.
 */
export function ignoreRanges(ast: RecipeAST, text: string): IgnoreRange[] {
	const blocks: ({ codes: string[] } | { start: number; end: number })[] = [];
	const visit = (nodes: RecipeAST["children"] | readonly unknown[]) => {
		for (const node of nodes as RecipeAST["children"]) {
			if (isComment(node)) {
				const match = node.kind === "line" && IGNORE.exec(node.value.trim());
				blocks.push({ codes: match ? match[1]!.split(/[\s,]+/) : [] });
			} else if (isSection(node)) {
				if (node.loc) {
					const eol = text.indexOf("\n", node.loc.start);
					blocks.push({
						start: node.loc.start,
						end: eol === -1 ? text.length : eol,
					});
				}
				visit(node.children);
			} else if (node.loc) {
				blocks.push({ start: node.loc.start, end: node.loc.end });
			}
		}
	};
	visit(ast.children);

	const ranges: IgnoreRange[] = [];
	let pending: string[] = [];
	for (const block of blocks) {
		if ("codes" in block) {
			pending.push(...block.codes);
		} else {
			if (pending.length > 0) {
				ranges.push({ codes: new Set(pending), ...block });
			}
			pending = [];
		}
	}
	return ranges;
}

/**
 * The diagnostics the project keeps, at the severity it chose: a code set to
 * `off` or named by a `// gram-ignore` above its block is dropped, another
 * setting replaces its severity. An `error` is never touched, so a broken
 * recipe cannot be hidden.
 */
export function applyLintConfig(
	diagnostics: LintDiagnostic[],
	config: LintConfig | undefined,
	ignores: IgnoreRange[],
): LintDiagnostic[] {
	const kept: LintDiagnostic[] = [];
	for (const d of diagnostics) {
		if (d.severity === "error") {
			kept.push(d);
			continue;
		}
		const loc = d.loc;
		if (
			loc &&
			ignores.some(
				(r) => r.codes.has(d.code) && r.start <= loc.start && loc.start < r.end,
			)
		) {
			continue;
		}
		const setting = config?.rules[d.code];
		if (setting === "off") continue;
		kept.push(setting ? { ...d, severity: setting } : d);
	}
	return kept;
}
