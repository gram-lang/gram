import { describe, expect, it } from "bun:test";
import grammar from "../syntaxes/gram.tmLanguage.json";

// The same small stand-in for a TextMate tokenizer as textmate-timer.test.ts:
// at each position the earliest match wins, then the first rule in order. The
// `#number` include is resolved; the reference rule (captures, no name) is
// left out, no quantity below holds one.
type Pattern = { include?: string; match?: string; name?: string };
const repository = grammar.repository as Record<
	string,
	{ patterns?: Pattern[]; match?: string; name?: string }
>;
const rules = (repository["quantity-content"]?.patterns ?? [])
	.map((p) => (p.include ? repository[p.include.slice(1)] : p) as Pattern)
	.filter((p): p is Required<Pick<Pattern, "match" | "name">> =>
		Boolean(p.match && p.name),
	)
	.map((p) => ({ regex: new RegExp(p.match, "gu"), scope: p.name }));

function scopes(content: string): [string, string][] {
	const out: [string, string][] = [];
	let pos = 0;
	while (pos < content.length) {
		let best: { index: number; text: string; scope: string } | undefined;
		for (const { regex, scope } of rules) {
			regex.lastIndex = pos;
			const m = regex.exec(content);
			const text = m?.[0];
			if (m && text && (!best || m.index < best.index))
				best = { index: m.index, text, scope };
		}
		if (!best) break;
		const text = best.text.trim();
		if (text) out.push([text, best.scope.split(".").slice(0, 2).join(".")]);
		pos = best.index + best.text.length;
	}
	return out;
}

const NUM = "constant.numeric";
const UNIT = "keyword.other";
const OP = "keyword.operator";

describe("TextMate: inside an ingredient's braces", () => {
	it("is what ingredients, composites and references include", () => {
		const includes = (key: string) =>
			JSON.stringify(repository[key]).includes('"#quantity-content"');
		expect(includes("ingredients")).toBe(true);
		expect(includes("composites")).toBe(true);
		expect(includes("references")).toBe(true);
	});

	it("keeps a plain quantity as a number and a unit", () => {
		expect(scopes("200 g")).toEqual([
			["200", NUM],
			["g", UNIT],
		]);
		expect(scopes("1/2 c.à.s")).toEqual([
			["1/2", NUM],
			["c.à.s", UNIT],
		]);
	});

	it("tells the signs of a sum from its units", () => {
		expect(scopes("1 cup + 1 tbsp")).toEqual([
			["1", NUM],
			["cup", UNIT],
			["+", OP],
			["1", NUM],
			["tbsp", UNIT],
		]);
		expect(scopes("1 cup-2 tbsp")).toEqual([
			["1", NUM],
			["cup", UNIT],
			["-", OP],
			["2", NUM],
			["tbsp", UNIT],
		]);
		expect(scopes("1 kg + 1,5 fl oz")).toEqual([
			["1", NUM],
			["kg", UNIT],
			["+", OP],
			["1,5", NUM],
			["fl oz", UNIT],
		]);
	});

	it("reads the dash of a range as an operator, not a unit", () => {
		expect(scopes("1-2 cups")).toEqual([
			["1", NUM],
			["-", OP],
			["2", NUM],
			["cups", UNIT],
		]);
	});
});
