import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { type LintConfig, lintDocument, parseLintConfig } from "../../src/lint";

const URI = "/recipe.gram";

function lint(text: string, config?: LintConfig) {
	const ast = getAST(text);
	return lintDocument({
		uri: URI,
		text,
		ast,
		compilation: compile(ast),
		config,
	});
}

const codes = (text: string, config?: LintConfig) =>
	lint(text, config).map((d) => d.code);

describe("parseLintConfig", () => {
	it("reads the settings of `lint.rules`", () => {
		expect(
			parseLintConfig({
				timezone: "Europe/Paris",
				lint: {
					rules: {
						MISSING_TITLE: "off",
						UNKNOWN_INGREDIENT: "hint",
						UNUSED_INTERMEDIATE: "info",
						INVALID_DURATION: "warning",
					},
				},
			}),
		).toEqual({
			rules: {
				MISSING_TITLE: "off",
				UNKNOWN_INGREDIENT: "hint",
				UNUSED_INTERMEDIATE: "info",
				INVALID_DURATION: "warning",
			},
		});
	});

	it("drops what does not read, without hiding the rest", () => {
		expect(
			parseLintConfig({
				lint: {
					rules: {
						MISSING_TITLE: "error",
						UNKNOWN_INGREDIENT: true,
						UNUSED_INTERMEDIATE: "Off",
						INVALID_DURATION: "off",
					},
				},
			}),
		).toEqual({ rules: { INVALID_DURATION: "off" } });
	});

	it("never throws, whatever the file holds", () => {
		for (const raw of [
			null,
			undefined,
			"lint",
			42,
			[],
			{ lint: [] },
			{ lint: { rules: "off" } },
			{ rules: { MISSING_TITLE: "off" } },
		]) {
			expect(parseLintConfig(raw)).toEqual({ rules: {} });
		}
	});
});

describe("lint settings of the project", () => {
	const text = "## A\n\nMix @a{1}. ->&mix\n";

	it("turns a code off", () => {
		expect(codes(text)).toContain("MISSING_TITLE");
		expect(codes(text, { rules: { MISSING_TITLE: "off" } })).not.toContain(
			"MISSING_TITLE",
		);
	});

	it("shows a code at another severity", () => {
		const d = lint(text, { rules: { UNUSED_INTERMEDIATE: "hint" } }).find(
			(x) => x.code === "UNUSED_INTERMEDIATE",
		);
		expect(d?.severity).toBe("hint");
	});

	it("never touches an error", () => {
		const broken = "## A\n\nBake &dough{1}.\n";
		const d = lint(broken, { rules: { UNDEFINED_REFERENCE: "off" } }).find(
			(x) => x.code === "UNDEFINED_REFERENCE",
		);
		expect(d?.severity).toBe("error");
	});
});

describe("// gram-ignore", () => {
	it("silences the codes it names in the step right after it", () => {
		const text =
			"---\ntitle: T\n---\n\n## A\n\n// gram-ignore UNUSED_INTERMEDIATE\nMix @a{1}. ->&mix\n";
		expect(codes(text)).not.toContain("UNUSED_INTERMEDIATE");
	});

	it("covers the whole step, a blank line after the comment or not", () => {
		const text =
			"---\ntitle: T\n---\n\n## A\n\n// gram-ignore UNUSED_INTERMEDIATE\n\nMix @a{1},\nthen rest. ->&mix\n";
		expect(codes(text)).not.toContain("UNUSED_INTERMEDIATE");
	});

	it("leaves the next steps alone", () => {
		const text =
			"---\ntitle: T\n---\n\n## A\n\n// gram-ignore UNUSED_INTERMEDIATE\nMix @a{1}. ->&mix\n\nStir @b{1}. ->&stir\n";
		const left = lint(text).filter((d) => d.code === "UNUSED_INTERMEDIATE");
		expect(left.map((d) => d.message)).toEqual([
			"Intermediate '->&stir' is declared but never used.",
		]);
	});

	it("names several codes, and stacks over several lines", () => {
		const one =
			"## A\n\n// gram-ignore UNUSED_INTERMEDIATE, INVALID_DURATION\nMix @a{1} ~{15%min}. ->&mix\n";
		const two =
			"## A\n\n// gram-ignore UNUSED_INTERMEDIATE\n// gram-ignore INVALID_DURATION\nMix @a{1} ~{15%min}. ->&mix\n";
		for (const text of [one, two]) {
			const left = codes(text);
			expect(left).not.toContain("UNUSED_INTERMEDIATE");
			expect(left).not.toContain("INVALID_DURATION");
		}
	});

	it("has no effect without a code, or on another code", () => {
		for (const comment of ["// gram-ignore", "// gram-ignore MISSING_UNIT"]) {
			const text = `## A\n\n${comment}\nMix @a{1}. ->&mix\n`;
			expect(codes(text)).toContain("UNUSED_INTERMEDIATE");
		}
	});

	it("covers a section heading's line, not the steps below it", () => {
		const bare = "## Rest ~{15}\n\nWait ~{10}.\n";
		expect(lint(bare).filter((d) => d.code === "MISSING_UNIT")).toHaveLength(2);
		const text = `// gram-ignore MISSING_UNIT\n${bare}`;
		const left = lint(text).filter((d) => d.code === "MISSING_UNIT");
		expect(left).toHaveLength(1);
		expect(text.slice(left[0]!.loc!.start, left[0]!.loc!.end)).toBe("~{10}");
	});

	it("never silences an error, nor a diagnostic with no position", () => {
		const text =
			"## A\n\n// gram-ignore UNDEFINED_REFERENCE, MISSING_TITLE\nBake &dough{1}.\n";
		const left = codes(text);
		expect(left).toContain("UNDEFINED_REFERENCE");
		expect(left).toContain("MISSING_TITLE");
	});
});
