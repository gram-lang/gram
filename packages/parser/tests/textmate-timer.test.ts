import { describe, expect, it } from "bun:test";
import grammar from "../syntaxes/gram.tmLanguage.json";

// A small stand-in for a TextMate tokenizer, enough for a flat list of
// `match` rules: at each position the earliest match wins, then the first
// rule in order. The regexes are Oniguruma's, which reads these ones as
// JavaScript does (`\p{L}` needs the `u` flag).
type Pattern = {
	include?: string;
	match?: string;
	name?: string;
	captures?: Record<string, { name: string }>;
};
const repository = grammar.repository as Record<string, Pattern>;
// Includes are resolved; a rule with captures gives one token per group.
const rules = (grammar.repository["timer-content"].patterns as Pattern[])
	.map((p) => (p.include ? repository[p.include.slice(1)] : p) as Pattern)
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
		} else if (rule.scope) {
			out.push([m[0], short(rule.scope)]);
		}
		pos = best.index + m[0].length;
	}
	return out;
}

const NUM = "constant.numeric";
const UNIT = "keyword.other";
const OP = "keyword.operator";
const SEP = "punctuation.separator";
const SIGIL = "keyword.control";
const TARGET = "entity.name";

describe("TextMate: inside a timer", () => {
	it("is what the timers rule includes", () => {
		expect(grammar.repository.timers.patterns).toEqual([
			{ include: "#timer-content" },
		]);
	});

	it("tells the minutes of 1h30 from its unit", () => {
		expect(scopes("1h30")).toEqual([
			["1", NUM],
			["h", UNIT],
			["30", NUM],
		]);
		expect(scopes("1 hr. 30 mins")).toEqual([
			["1", NUM],
			["hr.", UNIT],
			["30", NUM],
			["mins", UNIT],
		]);
	});

	it("reads the clock, the primes and the signs", () => {
		expect(scopes("1:30 h")).toEqual([
			["1", NUM],
			[":", SEP],
			["30", NUM],
			["h", UNIT],
		]);
		expect(scopes(`5'30"`)).toEqual([
			["5", NUM],
			["'", UNIT],
			["30", NUM],
			['"', UNIT],
		]);
		expect(scopes("5’30''")).toEqual([
			["5", NUM],
			["’", UNIT],
			["30", NUM],
			["''", UNIT],
		]);
		expect(scopes("45 min – 1 h")).toEqual([
			["45", NUM],
			["min", UNIT],
			["–", OP],
			["1", NUM],
			["h", UNIT],
		]);
		expect(scopes("1h + 30min")).toEqual([
			["1", NUM],
			["h", UNIT],
			["+", OP],
			["30", NUM],
			["min", UNIT],
		]);
	});

	it("reads decimals, fractions and units in any script", () => {
		expect(scopes("1,5 heures")).toEqual([
			["1,5", NUM],
			["heures", UNIT],
		]);
		expect(scopes("1½h")).toEqual([
			["1", NUM],
			["½", NUM],
			["h", UNIT],
		]);
		expect(scopes("1時間30分")).toEqual([
			["1", NUM],
			["時間", UNIT],
			["30", NUM],
			["分", UNIT],
		]);
	});

	it("reads a proportional time: its slash and its target", () => {
		expect(scopes("15 min / 500 g @&roti")).toEqual([
			["15", NUM],
			["min", UNIT],
			["/", OP],
			["500", NUM],
			["g", UNIT],
			["@&", SIGIL],
			["roti", TARGET],
		]);
		expect(scopes("4 min / &côtelette")).toEqual([
			["4", NUM],
			["min", UNIT],
			["/", OP],
			["&", SIGIL],
			["côtelette", TARGET],
		]);
	});
});
