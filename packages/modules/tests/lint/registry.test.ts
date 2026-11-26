import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "@gram-lang/analyzer";
import { compile, WarningCode } from "@gram-lang/kitchen";
import { GramParseError, getAST } from "@gram-lang/parser";
import {
	allDiagnosticInfo,
	diagnosticInfoOf,
	docUrlOf,
	LINT_RULES,
	lintDocument,
} from "../../src/lint";
import { ModuleWarningCode } from "../../src/warnings";

const registered = new Set(allDiagnosticInfo().map((i) => i.code));

describe("allDiagnosticInfo", () => {
	it("lists each code once", () => {
		const codes = allDiagnosticInfo().map((i) => i.code);
		expect(new Set(codes).size).toBe(codes.length);
	});

	it("lists every compiler code (kitchen, analyzer, modules) and every lint rule", () => {
		for (const code of [
			...Object.values(WarningCode),
			...Object.values(ModuleWarningCode),
			...LINT_RULES.map((r) => r.code),
		]) {
			expect(registered.has(code)).toBe(true);
		}
	});

	it("tells a compiler code from a rule of the lint layer", () => {
		expect(diagnosticInfoOf("UNDEFINED_REFERENCE").origin).toBe("compiler");
		expect(diagnosticInfoOf("UNKNOWN_INGREDIENT").origin).toBe("lint");
		expect(diagnosticInfoOf("DEPRECATED_FRONTMATTER_KEY").deprecated).toBe(
			true,
		);
	});

	it("gives each code a summary with its placeholders in braces", () => {
		expect(diagnosticInfoOf("VARIABLE_NOT_FOUND").summary).toContain(
			"{targetName}",
		);
		for (const info of allDiagnosticInfo())
			expect(info.summary.length).toBeGreaterThan(0);
	});

	it("derives each code's docUrl from the code: its anchor on the warnings page", () => {
		expect(docUrlOf("UNKNOWN_INGREDIENT")).toBe(
			"https://gram-lang.org/docs/reference/api/warnings/#unknown_ingredient",
		);
	});
});

/** Every `.gram` file under `dir`, recursively. */
function gramFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory()
			? gramFiles(join(dir, e.name))
			: e.name.endsWith(".gram")
				? [join(dir, e.name)]
				: [],
	);
}

describe("every code lintDocument returns is registered", () => {
	const roots = [
		join(import.meta.dir, "../../../kitchen/tests/fixtures"),
		join(import.meta.dir, "../../../../conformance/cases"),
	];
	const files = roots.flatMap(gramFiles);

	it("over the kitchen fixtures and the conformance cases", () => {
		expect(files.length).toBeGreaterThan(100);
		const seen = new Set<string>();
		for (const file of files) {
			const text = readFileSync(file, "utf8");
			let diags: ReturnType<typeof lintDocument>;
			try {
				const ast = getAST(text);
				const compiled = compile(ast);
				diags = lintDocument({
					uri: file,
					text,
					ast,
					compilation: analyze(compiled, {}).result,
					ingredientDB: { flour: { name: "Flour" } as never },
				});
			} catch (e) {
				if (!(e instanceof GramParseError)) throw e;
				diags = lintDocument({
					uri: file,
					text,
					ast: null,
					parseError: { message: e.message, offset: e.offset },
				});
			}
			for (const d of diags) {
				seen.add(d.code);
				if (!registered.has(d.code))
					throw new Error(`${d.code} (from ${file}) is not registered`);
			}
		}
		// The walk reaches the lint layer's own codes, not only the compiler's.
		expect(seen.has("MISSING_TITLE")).toBe(true);
		expect(seen.has("UNKNOWN_INGREDIENT")).toBe(true);
		expect(seen.has("PARSE_ERROR")).toBe(true);
	});
});
