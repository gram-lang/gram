import { describe, expect, it } from "bun:test";
import { ASTNodeType, GramParseError, getAST } from "../src/index";

// An action, a temperature's text and a section anchor end on their line,
// like every element but a block comment: they used to run to the next `]`
// or `}` and keep the source line break (LF, CRLF or a lone CR), which the
// formatter writes as LF, so formatting changed the compiled recipe (#216).

// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const firstStep = (src: string): any =>
	// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
	(getAST(src).children as any[])[0];

// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const text = (step: any): string =>
	step.children
		// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		.filter((c: any) => c.type === ASTNodeType.Text)
		// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		.map((c: any) => c.value)
		.join("");

const BREAKS = ["\n", "\r\n", "\r"] as const;

describe("a line break inside an element (#216)", () => {
	for (const nl of BREAKS) {
		const name = JSON.stringify(nl);

		it(`ends an action on its line (${name})`, () => {
			const step = firstStep(`[Mix${nl}well] the dough.`);
			expect(step.action).toBeNull();
			expect(text(step)).toBe("[Mix well] the dough.");
		});

		it(`ends a temperature on its line (${name})`, () => {
			const step = firstStep(`Bake at ^{low${nl}heat}.`);
			expect(
				// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
				step.children.some((c: any) => c.type === ASTNodeType.Temperature),
			).toBe(false);
			expect(text(step)).toBe("Bake at ^{low heat}.");
		});

		it(`ends a section anchor on its line (${name})`, () => {
			expect(() => getAST(`## Dough ~{-1${nl}d}${nl}${nl}Mix.`)).toThrow(
				GramParseError,
			);
		});

		it(`reads a line break in a block comment as LF (${name})`, () => {
			const comment = firstStep(`Mix /* gently${nl}and slowly */ well.`)
				// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
				.children.find((c: any) => c.type === ASTNodeType.Comment);
			expect(comment.kind).toBe("block");
			expect(comment.value).toBe("gently\nand slowly");
		});
	}

	it("keeps an action, a temperature and an anchor written on one line", () => {
		const [section] = getAST(
			"## Dough ~{-1d}\n\n[Bake] at ^{180°C}(fan).",
			// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		).children as any[];
		expect(section.retroPlanning).not.toBeNull();
		const step = section.children[0];
		expect(step.action).toBe("Bake");
		const temp = step.children.find(
			// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
			(c: any) => c.type === ASTNodeType.Temperature,
		);
		expect(temp.unit).toBe("°C");
		expect(temp.note).toBe("fan");
	});
});
