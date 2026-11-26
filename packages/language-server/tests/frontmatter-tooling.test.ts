import { describe, expect, it } from "bun:test";
import {
	type CodeAction,
	type CompletionItem,
	DiagnosticTag,
	type MarkupContent,
	type TextEdit,
} from "vscode-languageserver";
import { WarningCode } from "@gram-lang/kitchen";
import { parseDocument } from "../src/document-state";
import { provideCodeActions } from "../src/features/code-actions";
import { provideCompletions } from "../src/features/completions";
import { provideDiagnostics } from "../src/features/diagnostics";
import { provideHover } from "../src/features/hover";
import { scanFrontmatter } from "@gram-lang/modules/lint";
import { positionToOffset } from "../src/utils/position";

const URI = "file:///recipe.gram";
const db = { flour: { name: "Flour" } };

/**
 * The completions with the cursor at `|` in `text`, as the server asks
 * them: the prefix and the whole text live, the state possibly older.
 */
function complete(
	text: string,
	options: { locale?: string; state?: string; snippets?: boolean } = {},
): CompletionItem[] {
	const offset = text.indexOf("|");
	const live = text.slice(0, offset) + text.slice(offset + 1);
	const before = live.slice(0, offset).split("\n");
	const position = {
		line: before.length - 1,
		character: before[before.length - 1]!.length,
	};
	const state = parseDocument(options.state ?? live);
	return provideCompletions(
		state,
		db,
		before[before.length - 1]!,
		URI,
		options.snippets ?? false,
		undefined,
		{ text: live, position, locale: options.locale },
	);
}

const labels = (items: CompletionItem[]) => items.map((i) => i.label);

describe("scanFrontmatter", () => {
	it("finds the keys of a closed block, where their names are written", () => {
		const text = "---\ntitle: Bread\nservings: 4\n---\n\n## Dough\n";
		const block = scanFrontmatter(text)!;
		expect(block.closed).toBe(true);
		expect(block.endLine).toBe(3);
		expect(block.keys.map((k) => [k.key, k.line])).toEqual([
			["title", 1],
			["servings", 2],
		]);
		const servings = block.keys[1]!;
		expect(text.slice(servings.start, servings.end)).toBe("servings");
		expect(text.slice(servings.lineStart, servings.lineEnd)).toBe(
			"servings: 4\n",
		);
	});

	it("tolerates a `# …` line and an indented line without taking them for keys", () => {
		const block = scanFrontmatter(
			"---\n# Functional fields\ntitle: X\n  - flour: 0.55\n---\n",
		)!;
		expect(block.closed).toBe(true);
		expect(block.keys.map((k) => k.key)).toEqual(["title"]);
	});

	it("stops an unclosed block at the first line a frontmatter cannot hold", () => {
		const block = scanFrontmatter("---\ntitle: X\n\nMix @flour{}.\n")!;
		expect(block.closed).toBe(false);
		expect(block.endLine).toBe(3);
		expect(block.keys.map((k) => k.key)).toEqual(["title"]);
	});

	it("reads past a byte order mark and a CRLF line break", () => {
		const block = scanFrontmatter("﻿---\r\ntitle: X\r\n---\r\n")!;
		expect(block.closed).toBe(true);
		expect(block.keys.map((k) => k.key)).toEqual(["title"]);
	});

	it("is null when the text opens no frontmatter", () => {
		expect(scanFrontmatter("")).toBeNull();
		expect(scanFrontmatter("## Dough\n\n---\n")).toBeNull();
	});
});

describe("completing a frontmatter key", () => {
	it("offers the canonical keys not written yet, in the registry's order", () => {
		const items = complete("---\ntitle: Bread\n|\n---\n\n## Dough\n");
		expect(labels(items)).not.toContain("title");
		expect(labels(items).slice(0, 2)).toEqual(["description", "tags"]);
		expect(labels(items)).toContain("portions");
		expect(labels(items)).toContain("language");
	});

	it("never offers a deprecated key", () => {
		const items = complete("---\n|\n---\n");
		for (const key of ["servings", "yield", "yields"]) {
			expect(labels(items)).not.toContain(key);
		}
	});

	it("counts a key written in its deprecated form as present", () => {
		const items = complete("---\nservings: 4\nyields: 24\n|\n---\n");
		expect(labels(items)).not.toContain("portions");
		expect(labels(items)).not.toContain("makes");
	});

	it("replaces the typed name with the key and its colon", () => {
		const items = complete("---\nport|\n---\n");
		const portions = items.find((i) => i.label === "portions")!;
		expect(portions.textEdit).toEqual({
			range: {
				start: { line: 1, character: 0 },
				end: { line: 1, character: 4 },
			},
			newText: "portions: ",
		});
	});

	it("describes each key in the editor's language", () => {
		const en = complete("---\n|\n---\n").find((i) => i.label === "portions")!;
		const fr = complete("---\n|\n---\n", { locale: "fr" }).find(
			(i) => i.label === "portions",
		)!;
		expect(en.detail).toBe("Number");
		expect((en.documentation as MarkupContent).value).toContain(
			"`portions: 4`",
		);
		expect((fr.documentation as MarkupContent).value).not.toBe(
			(en.documentation as MarkupContent).value,
		);
	});

	it("works on a block with no closing `---` yet (no AST)", () => {
		const items = complete("---\ntitle: X\nla|");
		expect(labels(items)).toContain("language");
	});

	it("completes nothing after a key's colon, on a `# …` line or an indented line", () => {
		expect(complete("---\ntitle: |\n---\n")).toEqual([]);
		expect(complete("---\n# note|\n---\n")).toEqual([]);
		expect(complete("---\n  ti|\n---\n")).toEqual([]);
	});

	it("offers no ingredient on `@` and no name on `#` inside the frontmatter", () => {
		expect(
			complete("---\ntitle: Mix @|\n---\n\n## A\n\nMix @flour{}.\n"),
		).toEqual([]);
		expect(
			complete("---\nnotes: #|\n---\n\n## A\n\nHeat the #pan{}.\n"),
		).toEqual([]);
	});

	it("leaves a recipe line after an unclosed block to the other completions", () => {
		const items = complete("---\ntitle: X\n\nMix @|");
		expect(labels(items)).toContain("Flour");
	});
});

describe("completing the names of the recipe", () => {
	const RECIPE = [
		"## Bake",
		"",
		"Heat the #large pot{} and the #pan{} with ^oven{180°C}.",
		"",
		"Bake ~_oven{20 min}, then rest ~cooling{10 min}.",
		"",
		"Again ~_oven{5 min}.",
		"",
	].join("\n");
	const at = (line: string) => complete(`${RECIPE}${line}|`, { state: RECIPE });

	it("offers the cookware after `#`, a multi-word name with its braces", () => {
		const items = at("Put it in a #");
		expect(labels(items).sort()).toEqual(["large pot", "pan"]);
		expect(items.find((i) => i.label === "large pot")!.textEdit).toMatchObject({
			newText: "large pot{}",
		});
		expect(items.find((i) => i.label === "pan")!.textEdit).toMatchObject({
			newText: "pan",
		});
	});

	it("offers the temperatures after `^`, with braces", () => {
		const items = at("Then ^");
		expect(labels(items)).toEqual(["oven"]);
		expect(items[0]!.textEdit).toMatchObject({ newText: "oven{}" });
	});

	it("offers every named timer after `~`, only the tracks after `~_`", () => {
		expect(labels(at("Wait ~")).sort()).toEqual(["cooling", "oven"]);
		expect(labels(at("Wait ~_"))).toEqual(["oven"]);
	});

	it("replaces from right after `~_`, so the `_` is kept", () => {
		const items = complete(`${RECIPE}Wait ~_ov|`, { state: RECIPE });
		const line = RECIPE.split("\n").length - 1;
		expect(items[0]!.textEdit).toEqual({
			range: {
				start: { line, character: "Wait ~_".length },
				end: { line, character: "Wait ~_ov".length },
			},
			newText: "oven{}",
		});
	});

	it("leaves the cursor between the braces for a client that expands snippets", () => {
		const items = complete(`${RECIPE}Wait ~|`, {
			state: RECIPE,
			snippets: true,
		});
		expect(items.find((i) => i.label === "oven")!.textEdit).toMatchObject({
			newText: "oven{$0}",
		});
	});

	it("does not offer back the name being typed, already in the AST", () => {
		const text = `${RECIPE}Use the #po|`;
		const state = text.replace("|", "");
		expect(labels(complete(text, { state }))).not.toContain("po");
	});

	it("completes no name on a section heading, inside braces or after `//`", () => {
		expect(complete(`${RECIPE}## Sauce #|`, { state: RECIPE })).toEqual([]);
		expect(labels(at("Add @salt{#"))).not.toContain("pan");
		expect(at("Done. // see #")).toEqual([]);
	});

	it("does not take `#` in the middle of a word for cookware", () => {
		expect(at("Learn C#")).toEqual([]);
	});

	it("takes the `#` typed after an ingredient for cookware, not the ingredient", () => {
		expect(labels(at("Add @salt #")).sort()).toEqual(["large pot", "pan"]);
	});
});

describe("hovering a frontmatter key", () => {
	const hover = (
		text: string,
		line: number,
		character: number,
		locale?: string,
	) => provideHover(parseDocument(text), { line, character }, {}, locale);

	it("shows what the key means and the kind of value it takes", () => {
		const h = hover("---\nportions: 4\n---\n\n## A\n\nMix.\n", 1, 3);
		const value = (h!.contents as MarkupContent).value;
		expect(value).toContain("**`portions`** · Number");
		expect(value).toContain("scaling");
		expect(h!.range).toEqual({
			start: { line: 1, character: 0 },
			end: { line: 1, character: 8 },
		});
	});

	it("speaks the editor's language", () => {
		const en = hover("---\nportions: 4\n---\n", 1, 3);
		const fr = hover("---\nportions: 4\n---\n", 1, 3, "fr");
		expect((fr!.contents as MarkupContent).value).not.toBe(
			(en!.contents as MarkupContent).value,
		);
	});

	it("adds the replacement of a deprecated key", () => {
		const h = hover("---\nservings: 4\n---\n", 1, 2);
		const value = (h!.contents as MarkupContent).value;
		expect(value).toContain("**`servings`**");
		expect(value).toContain("**`portions`** · Number");
	});

	it("works on a block the grammar did not take, and ignores the author's own keys", () => {
		expect(hover("---\n# note\ntitle: X\n---\n", 2, 1)).not.toBeNull();
		expect(hover("---\nchef: Me\n---\n", 1, 1)).toBeNull();
		expect(hover("---\ntitle: Bread\n---\n", 1, 10)).toBeNull();
	});
});

describe("DEPRECATED_FRONTMATTER_KEY in the editor", () => {
	const deprecated = (text: string) => {
		const state = parseDocument(text);
		return {
			state,
			diags: provideDiagnostics(state, URI).filter(
				(d) => d.code === WarningCode.DEPRECATED_FRONTMATTER_KEY,
			),
		};
	};

	/** The text once the preferred Quick Fix of `diag` is applied. */
	function applyFix(text: string, key: string) {
		const { state, diags } = deprecated(text);
		const diag = diags.find((d) => (d.data as { key: string }).key === key)!;
		const action = provideCodeActions(state, diag.range, [diag], URI, {}).find(
			(a: CodeAction) => a.isPreferred,
		)!;
		const [edit] = action.edit!.changes![URI] as TextEdit[];
		const start = positionToOffset(state.lineStarts, edit!.range.start);
		const end = positionToOffset(state.lineStarts, edit!.range.end);
		return {
			title: action.title,
			text: text.slice(0, start) + edit!.newText + text.slice(end),
		};
	}

	const BODY = "\n## A\n\nMix @flour{100 g}.\n";

	it("is anchored on the key's name and struck through", () => {
		const { diags } = deprecated(`---\ntitle: X\nservings: 4\n---\n${BODY}`);
		expect(diags).toHaveLength(1);
		expect(diags[0]!.range).toEqual({
			start: { line: 2, character: 0 },
			end: { line: 2, character: 8 },
		});
		expect(diags[0]!.tags).toEqual([DiagnosticTag.Deprecated]);
	});

	it("renames the key, keeping its value", () => {
		const fixed = applyFix(
			`---\ntitle: X\nservings: 4\n---\n${BODY}`,
			"servings",
		);
		expect(fixed.title).toBe("Rename 'servings' to 'portions'");
		expect(fixed.text).toBe(`---\ntitle: X\nportions: 4\n---\n${BODY}`);
		expect(deprecated(fixed.text).diags).toEqual([]);
	});

	it("removes the line when the replacement is already written", () => {
		const fixed = applyFix(
			`---\ntitle: X\nservings: 6\nportions: 4\n---\n${BODY}`,
			"servings",
		);
		expect(fixed.title).toBe("Remove 'servings' ('portions' is the key read)");
		expect(fixed.text).toBe(`---\ntitle: X\nportions: 4\n---\n${BODY}`);
	});

	it("renames the alias that wins and removes the other, so the value read stays", () => {
		const text = `---\ntitle: X\nyields: 12\nyield: 24\n---\n${BODY}`;
		expect(applyFix(text, "yield").text).toBe(
			`---\ntitle: X\nyields: 12\nmakes: 24\n---\n${BODY}`,
		);
		expect(applyFix(text, "yields").text).toBe(
			`---\ntitle: X\nyield: 24\n---\n${BODY}`,
		);
	});

	it("stays on the `@use` line of a module, with no strikethrough and no Quick Fix", () => {
		const text = `---\ntitle: X\n---\n${BODY}`;
		const state = parseDocument(text);
		const loc = { start: 4, end: 9 };
		state.compilation!.warnings.push({
			code: WarningCode.DEPRECATED_FRONTMATTER_KEY,
			message: "module key",
			loc,
			data: {
				key: "servings",
				suggestion: "portions",
				specifier: "./base.gram",
			},
		});
		const diag = provideDiagnostics(state, URI).find(
			(d) => d.code === WarningCode.DEPRECATED_FRONTMATTER_KEY,
		)!;
		expect(diag.range).toEqual({
			start: { line: 1, character: 0 },
			end: { line: 1, character: 5 },
		});
		expect(diag.tags).toBeUndefined();
		expect(provideCodeActions(state, diag.range, [diag], URI, {})).toEqual([]);
	});
});
