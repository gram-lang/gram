import { describe, expect, it } from "bun:test";
import grammar from "../syntaxes/gram.tmLanguage.json";

// A small stand-in for a TextMate tokenizer, enough for a flat list of
// `match` rules: at each position the earliest match wins, then the first
// rule in order. The regexes are Oniguruma's, which reads these ones as
// JavaScript does (`\p{L}` needs the `u` flag).
const rules = grammar.repository["timer-content"].patterns.map((p) => ({
	regex: new RegExp(p.match, "gu"),
	scope: p.name,
}));

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
		out.push([best.text, best.scope.split(".").slice(0, 2).join(".")]);
		pos = best.index + best.text.length;
	}
	return out;
}

const NUM = "constant.numeric";
const UNIT = "keyword.other";
const OP = "keyword.operator";
const SEP = "punctuation.separator";

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
});
