import { describe, expect, it } from "bun:test";
import grammar from "../syntaxes/gram.tmLanguage.json";

// The same small stand-in for a TextMate tokenizer as textmate-timer.test.ts:
// at each position the earliest match wins, then the first rule in order.
// Includes are resolved; a rule with captures gives one token per group.
type Pattern = {
	include?: string;
	match?: string;
	name?: string;
	captures?: Record<string, { name: string }>;
};
const repository = grammar.repository as Record<
	string,
	Pattern & { patterns?: Pattern[] }
>;
const rules = (repository["quantity-content"]?.patterns ?? [])
	.map((p) => (p.include ? repository[p.include.slice(1)] : p) as Pattern)
	.filter((p) => Boolean(p.match && (p.name || p.captures)))
	.map((p) => ({
		regex: new RegExp(p.match as string, "gu"),
		scope: p.name,
		captures: p.captures,
	}));

const short = (scope: string) => scope.split(".").slice(0, 2).join(".");

function scopes(content: string): [string, string][] {
	const out: [string, string][] = [];
	let pos = 0;
	while (pos < content.length) {
		let best:
			| { index: number; m: RegExpExecArray; rule: (typeof rules)[number] }
			| undefined;
		for (const rule of rules) {
			rule.regex.lastIndex = pos;
			const m = rule.regex.exec(content);
			if (m?.[0] && (!best || m.index < best.index))
				best = { index: m.index, m, rule };
		}
		if (!best) break;
		const { m, rule } = best;
		if (rule.captures) {
			for (const [group, { name }] of Object.entries(rule.captures)) {
				const text = m[Number(group)]?.trim();
				if (text) out.push([text, short(name)]);
			}
		} else {
			const text = m[0].trim();
			if (text && rule.scope) out.push([text, short(rule.scope)]);
		}
		pos = best.index + m[0].length;
	}
	return out;
}

const NUM = "constant.numeric";
const UNIT = "keyword.other";
const OP = "keyword.operator";
const SIGIL = "keyword.control";
const TARGET = "entity.name";

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

	it("reads the slash of a ratio and its target", () => {
		expect(scopes("1 / 100 g @&farine")).toEqual([
			["1", NUM],
			["/", OP],
			["100", NUM],
			["g", UNIT],
			["@&", SIGIL],
			["farine", TARGET],
		]);
		expect(scopes("1/2 / 100 g &pâte brisée")).toEqual([
			["1/2", NUM],
			["/", OP],
			["100", NUM],
			["g", UNIT],
			["&", SIGIL],
			["pâte brisée", TARGET],
		]);
		expect(scopes("15 g / L @&eau")).toEqual([
			["15", NUM],
			["g", UNIT],
			["/", OP],
			["L", UNIT],
			["@&", SIGIL],
			["eau", TARGET],
		]);
	});

	it("keeps the target of a percentage", () => {
		expect(scopes("70% @&farine")).toEqual([
			["70", NUM],
			["%", OP],
			["@&", SIGIL],
			["farine", TARGET],
		]);
	});

	it("stops a target at a multiplier", () => {
		expect(scopes("1 / 100 g @&steak * 2")).toContainEqual(["steak", TARGET]);
	});
});
