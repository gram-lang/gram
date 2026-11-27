import { describe, expect, it } from "bun:test";
import { analyze, type IngredientData } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { GramParseError, getAST } from "@gram-lang/parser";
import { composeRecipe, finalizeComposed } from "../../src/compose";
import { loadModuleGraph } from "../../src/graph";
import {
	EDITOR_HIDDEN_CODES,
	type LintDiagnostic,
	type LintFix,
	lintDocument,
} from "../../src/lint";
import { createFakeHost } from "../fake-host";

const URI = "/recipe.gram";

const entry = (name: string): IngredientData =>
	({
		name,
		nutrition: { per100g: { kcal: 100 } },
	}) as unknown as IngredientData;

/** One file, parsed and compiled (analyzed when a database is given). */
function lintSource(
	text: string,
	db?: Record<string, IngredientData>,
): LintDiagnostic[] {
	try {
		const ast = getAST(text);
		const compiled = compile(ast);
		const compilation = db ? analyze(compiled, db).result : compiled;
		return lintDocument({
			uri: URI,
			text,
			ast,
			compilation,
			ingredientDB: db,
		});
	} catch (e) {
		if (!(e instanceof GramParseError)) throw e;
		return lintDocument({
			uri: URI,
			text,
			ast: null,
			parseError: { message: e.message, offset: e.offset },
		});
	}
}

/** Several files, composed as the language server and `gram check` do. */
async function lintFiles(
	files: Record<string, string>,
	db?: Record<string, IngredientData>,
) {
	const graph = await loadModuleGraph(URI, createFakeHost(files));
	const composed = composeRecipe(graph, { db: db ?? {} });
	const compiled = compile(composed.ast);
	const analyzed = analyze(compiled, {
		...composed.syntheticIngredients,
		...db,
	}).result;
	return lintDocument({
		uri: URI,
		text: files[URI]!,
		ast: graph.modules.get(URI)!.ast,
		compilation: finalizeComposed(analyzed, composed),
		moduleGraph: graph,
		...(db ? { ingredientDB: db } : {}),
	});
}

/** The text after applying one fix's patches to `text` (fixes of this file only). */
function apply(text: string, fix: LintFix, uri = URI): string {
	let out = text;
	for (const edit of fix.edits) {
		if (edit.kind !== "patch" || edit.uri !== uri) continue;
		for (const p of [...edit.patches].sort((a, b) => b.start - a.start))
			out = out.slice(0, p.start) + p.replacement + out.slice(p.end);
	}
	return out;
}

const TITLE = "---\ntitle: T\n---\n\n";

describe("lintDocument — what every diagnostic carries", () => {
	it("gives a parse error the PARSE_ERROR code, its offset and its docUrl", () => {
		const [d, ...rest] = lintSource(
			'@use "./a.gram" as &a\n\nMix.\n\n@use "./b.gram" as &b\n',
		);
		expect(rest).toEqual([]);
		expect(d!.code).toBe("PARSE_ERROR");
		expect(d!.severity).toBe("error");
		expect(d!.loc).toBeDefined();
		expect(d!.loc!.end).toBe(d!.loc!.start + 1);
		expect(d!.docUrl).toBe(
			"https://gram-lang.org/docs/reference/api/warnings/#parse_error",
		);
	});

	it("gives a compiler warning its severity, its data, its uri and its docUrl", () => {
		const text = `${TITLE}## Pasta\n\nBoil ~pasta{15%min}.\n`;
		const d = lintSource(text).find((x) => x.code === "INVALID_DURATION")!;
		expect(d.severity).toBe("warning");
		expect(d.uri).toBe(URI);
		expect(d.data).toEqual({ suggestion: "15 min" });
		expect(d.docUrl).toEndWith("#invalid_duration");
		expect(text.slice(d.loc!.start, d.loc!.end)).toBe("~pasta{15%min}");
		const [fix] = d.fixes!;
		expect(fix!.isPreferred).toBe(true);
		expect(apply(text, fix!)).toContain("~pasta{15 min}");
	});

	it("reports a COMPILE_ERROR at the top of the file", () => {
		const text = `${TITLE}Mix.\n`;
		const d = lintDocument({
			uri: URI,
			text,
			ast: getAST(text),
			compileError: "boom",
		});
		expect(d).toEqual([
			{
				code: "COMPILE_ERROR",
				message: "boom",
				uri: URI,
				severity: "error",
				docUrl:
					"https://gram-lang.org/docs/reference/api/warnings/#compile_error",
			},
		]);
	});

	it("marks a deprecated key as deprecated, on the key, with its rename", () => {
		const text = "---\ntitle: T\nservings: 4\n---\n\nMix @a{1}.\n";
		const d = lintSource(text).find(
			(x) => x.code === "DEPRECATED_FRONTMATTER_KEY",
		)!;
		expect(d.deprecated).toBe(true);
		expect(text.slice(d.loc!.start, d.loc!.end)).toBe("servings");
		expect(apply(text, d.fixes![0]!)).toContain("portions: 4");
	});

	it("keeps the codes with no position an editor hides, without a loc", () => {
		// A known ingredient with no nutrition and no mass: MISSING_MACROS,
		// UNKNOWN_MASS. (An unknown one is UNKNOWN_INGREDIENT, on its mention.)
		const text = `${TITLE}Mix @flour{100 g} and @egg{1}.\n`;
		const hidden = lintSource(text, {
			flour: entry("Flour"),
			egg: { name: "Egg" } as unknown as IngredientData,
		}).filter((d) => EDITOR_HIDDEN_CODES.has(d.code));
		expect(hidden.length).toBeGreaterThan(0);
		for (const d of hidden) expect(d.loc).toBeUndefined();
	});
});

describe("lintDocument — MISSING_INGREDIENT next to UNKNOWN_INGREDIENT", () => {
	it("leaves out the analyzer's verdict on an ingredient the file already flags", () => {
		const text = `${TITLE}Mix @flour{100 g} and @Brown sugar{50 g}.\n`;
		const diags = lintSource(text, { flour: entry("Flour") });
		const unknown = diags.filter((d) => d.code === "UNKNOWN_INGREDIENT");
		expect(unknown.map((d) => d.data?.name)).toEqual(["Brown sugar"]);
		expect(diags.map((d) => d.code)).not.toContain("MISSING_INGREDIENT");
	});

	it("keeps it for an ingredient only an imported module writes", async () => {
		const base = "## Dough ->&dough\n\nMix @flour{100 g} and @salt{2 g}.\n";
		const top = `@use "./base.gram" as &dough\n\n${TITLE}## Bake\n\nBake &dough{1} with @sugar{5 g}.\n`;
		const diags = await lintFiles(
			{ [URI]: top, "/base.gram": base },
			{ flour: entry("Flour") },
		);
		const missing = diags.filter((d) => d.code === "MISSING_INGREDIENT");
		expect(missing.map((d) => d.message)).toEqual([
			'Ingredient "salt" not found in database — nutritional metrics and density conversions unavailable.',
		]);
		expect(
			diags
				.filter((d) => d.code === "UNKNOWN_INGREDIENT")
				.map((d) => d.data?.name),
		).toEqual(["sugar"]);
	});
});

describe("lintDocument — a warning raised in a dependency", () => {
	it("is anchored on the @use line and points at its real place in `related`", async () => {
		const base = "## Dough ->&dough\n\nMix @flour{1 cup 5 tbsp}.\n";
		const top = '@use "./base.gram" as &dough\n\n## Bake\n\nBake &dough{1}.\n';
		const diags = await lintFiles({ [URI]: top, "/base.gram": base });
		const d = diags.find((x) => x.code === "INVALID_UNIT")!;
		// The declaration's loc runs to its line break.
		expect(top.slice(d.loc!.start, d.loc!.end).trimEnd()).toBe(
			'@use "./base.gram" as &dough',
		);
		expect(d.uri).toBe(URI);
		expect(d.fixes).toBeUndefined();
		const [related] = d.related!;
		expect(related!.uri).toBe("/base.gram");
		expect(base.slice(related!.loc!.start, related!.loc!.end)).toContain(
			"@flour",
		);
	});
});

describe("lintDocument — MODULE_EXPORT_NOT_FOUND in a destructured import", () => {
	// Both bindings are missing, on the same `@use` line (the warning's loc):
	// `&typo` names nothing, `&bouillon` is a private step-level `->&`.
	const sauce =
		"## Sauce ->&sauce\n\nReduce @stock{200g}.\n\n## Extra\n\nMix @cream{100g}. ->&bouillon\n";
	const top = (bindings: string) =>
		`@use "./sauce.gram" as { ${bindings} }\n\n## Dessert\n\nWhisk &bouillon{1} and &typo{1}.\n`;

	for (const bindings of ["&typo, &bouillon", "&bouillon, &typo"]) {
		it(`offers the re-export for &bouillon alone (as { ${bindings} })`, async () => {
			const diags = await lintFiles({
				[URI]: top(bindings),
				"/sauce.gram": sauce,
			});
			const missing = diags.filter((x) => x.code === "MODULE_EXPORT_NOT_FOUND");
			expect(missing).toHaveLength(2);
			const withFix = missing.filter((x) => x.fixes);
			expect(withFix).toHaveLength(1);
			expect(withFix[0]!.message).toContain("'&bouillon'");
			const [fix] = withFix[0]!.fixes!;
			expect(fix!.title).toBe(`Re-export '&bouillon' from "./sauce.gram"`);
			const [edit] = fix!.edits;
			expect(edit).toMatchObject({ kind: "patch", uri: "/sauce.gram" });
			expect(apply(sauce, fix!, "/sauce.gram")).toContain(
				"## Extra ->&bouillon\n",
			);
		});
	}
});

describe("lintDocument — fixes of the compiler's warnings", () => {
	it("declares the intermediate an UNDEFINED_REFERENCE names, sentence dot left out", () => {
		const text = `${TITLE}## Bake\n\nBake &dough.\n`;
		const d = lintSource(text).find((x) => x.code === "UNDEFINED_REFERENCE")!;
		const [fix] = d.fixes!;
		expect(fix!.title).toBe("Declare '->&dough{}'");
		expect(fix!.isPreferred).toBeUndefined();
	});

	it("declares the intermediate of an `@&name`", () => {
		const text = `${TITLE}## Bake\n\nAdd @&dough{100 g}.\n`;
		const d = lintSource(text).find((x) => x.code === "UNDEFINED_REFERENCE")!;
		expect(d.fixes![0]!.title).toBe("Declare '->&dough{}'");
	});
});

describe("lintDocument — the rules moved from the language server", () => {
	it("MISSING_TITLE adds a title to an existing frontmatter", () => {
		const text = "---\nportions: 2\n---\n\nMix.\n";
		const d = lintSource(text).find((x) => x.code === "MISSING_TITLE")!;
		expect(d.loc).toBeUndefined();
		expect(d.severity).toBe("warning");
		expect(apply(text, d.fixes![0]!)).toBe(
			"---\ntitle: \nportions: 2\n---\n\nMix.\n",
		);
	});

	it("MISSING_TITLE offers no fix without a frontmatter", () => {
		const d = lintSource("Mix.\n").find((x) => x.code === "MISSING_TITLE")!;
		expect(d.fixes).toBeUndefined();
	});

	it("UNUSED_INTERMEDIATE removes the step's `->&`", () => {
		const text = `${TITLE}## A\n\nMix @a{1}. ->&mix\n`;
		const d = lintSource(text).find((x) => x.code === "UNUSED_INTERMEDIATE")!;
		expect(text.slice(d.loc!.start, d.loc!.end)).toBe("->&mix");
		expect(apply(text, d.fixes![0]!)).toBe(`${TITLE}## A\n\nMix @a{1}. \n`);
	});

	it("UNKNOWN_INGREDIENT never prefers a spelling fix, even with one closest name", () => {
		const text = `${TITLE}Mix @flur{100 g}.\n`;
		const one = lintSource(text, { flour: entry("Flour") }).find(
			(x) => x.code === "UNKNOWN_INGREDIENT",
		)!;
		expect(one.severity).toBe("info");
		expect(one.data).toEqual({ name: "flur", suggestion: "Flour" });
		expect(one.fixes![0]!.isPreferred).toBeUndefined();
		expect(apply(text, one.fixes![0]!)).toContain("@Flour{100 g}");

		const two = lintSource(text, {
			flour: entry("Flour"),
			blur: entry("Flurr"),
		}).find((x) => x.code === "UNKNOWN_INGREDIENT")!;
		expect(two.fixes![0]!.isPreferred).toBeUndefined();
	});

	it("UNKNOWN_INGREDIENT needs a database", () => {
		const codes = lintSource(`${TITLE}Mix @flur{100 g}.\n`).map((d) => d.code);
		expect(codes).not.toContain("UNKNOWN_INGREDIENT");
	});
});
