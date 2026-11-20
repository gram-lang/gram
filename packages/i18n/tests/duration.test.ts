import { describe, expect, it } from "bun:test";
import { parseDuration, tokenizeDuration } from "../src/duration";
import { TIME_BY_LANG, TIME_DICTIONARIES } from "../src/time";
import { COMMON_CASES, DURATION_CASES } from "./duration-cases";

const LANGUAGES = Object.keys(TIME_DICTIONARIES);

describe("parseDuration: the table of each language", () => {
	it("has a table for every language of TIME_DICTIONARIES, of at least 60 valid and 30 refused writings", () => {
		for (const lang of LANGUAGES) {
			const cases = DURATION_CASES[lang];
			expect(cases, `no table for "${lang}"`).toBeDefined();
			expect(cases?.valid.length).toBeGreaterThanOrEqual(60);
			expect(cases?.refused.length).toBeGreaterThanOrEqual(30);
		}
	});

	for (const [name, cases] of [
		["common", COMMON_CASES],
		...Object.entries(DURATION_CASES),
	] as const) {
		describe(name, () => {
			it.each(cases.valid)("reads %p", (text, expected) => {
				const result = parseDuration(text);
				if (!result.ok) throw new Error(`refused: ${result.reason}`);
				if (Array.isArray(expected)) {
					const [min, max] = expected;
					expect(result.range?.min).toBeCloseTo(min, 9);
					expect(result.range?.max).toBeCloseTo(max, 9);
					expect(result.minutes).toBeCloseTo((min + max) / 2, 9);
				} else {
					expect(result.range).toBeUndefined();
					expect(result.minutes).toBeCloseTo(expected, 9);
				}
			});

			it.each(cases.refused)("refuses %p (%s)", (text, reason) => {
				const result = parseDuration(text);
				expect(result.ok ? "accepted" : result.reason).toBe(reason);
			});
		});
	}
});

describe("parseDuration: what it returns", () => {
	it("keeps each term in the unit it was written in", () => {
		const result = parseDuration("1 hr 30 mins");
		expect(result).toEqual({
			ok: true,
			minutes: 90,
			sides: [
				{
					minutes: 90,
					parts: [
						{ value: 1, unit: "h" },
						{ value: 30, unit: "m" },
					],
					form: "units",
				},
			],
		});
	});

	it("gives the implied unit of a bare final number", () => {
		const result = parseDuration("5'30");
		expect(result.ok && result.sides[0].parts).toEqual([
			{ value: 5, unit: "m" },
			{ value: 30, unit: "s" },
		]);
		expect(result.ok && result.sides[0].form).toBe("prime");
	});

	it("tells the form of a clock and of a mix of units and primes", () => {
		const clock = parseDuration("0:04:30");
		expect(clock.ok && clock.sides[0].form).toBe("clock");
		expect(clock.ok && clock.sides[0].parts).toEqual([
			{ value: 0, unit: "h" },
			{ value: 4, unit: "m" },
			{ value: 30, unit: "s" },
		]);
		const mixed = parseDuration("1h 30'");
		expect(mixed.ok && mixed.sides[0].form).toBe("units");
	});

	it("keeps both sides of a range, the left one in the unit it inherits", () => {
		const result = parseDuration("1-2 h");
		expect(result).toEqual({
			ok: true,
			minutes: 90,
			range: { min: 60, max: 120 },
			sides: [
				{ minutes: 60, parts: [{ value: 1, unit: "h" }], form: "units" },
				{ minutes: 120, parts: [{ value: 2, unit: "h" }], form: "units" },
			],
		});
	});

	it("names the word it could not read as a unit", () => {
		expect(parseDuration("3 bananas")).toEqual({
			ok: false,
			reason: "unknownUnit",
			unit: "bananas",
		});
	});

	it("reads no sign and caps nothing: that is the compiler's job", () => {
		expect(parseDuration("-1h").ok).toBe(false);
		const long = parseDuration("2000000 d");
		expect(long.ok && long.minutes).toBe(2000000 * 1440);
	});
});

describe("tokenizeDuration", () => {
	const shape = (text: string) => {
		const result = tokenizeDuration(text);
		if (!result.ok) throw new Error(result.reason);
		return result.tokens.map((t) =>
			t.kind === "num"
				? `NUM(${t.text})`
				: t.kind === "word"
					? `UNIT(${t.unit ?? t.text})`
					: t.kind === "prime"
						? `PRIME(${t.unit})`
						: t.kind.toUpperCase(),
		);
	};

	it("sees ten writings of 1 h 30 as the same sequence: spaces carry no meaning", () => {
		const writings = [
			"1h30",
			"1 h 30",
			"1h 30",
			"1 h30",
			"1hr30",
			"1 hr 30",
			"1 hr. 30",
			"1 hour 30",
			"1 heure 30",
			"1 h 30",
		];
		for (const text of writings) {
			expect(shape(text)).toEqual(["NUM(1)", "UNIT(h)", "NUM(30)"]);
		}
	});

	it("reads a decimal point or comma only between two digits", () => {
		expect(shape("1,5 h")).toEqual(["NUM(1,5)", "UNIT(h)"]);
		expect(shape("1.5h")).toEqual(["NUM(1.5)", "UNIT(h)"]);
		expect(tokenizeDuration("1, 5 h").ok).toBe(false);
	});

	it("joins a whole number and a fraction across a space, and only there", () => {
		expect(shape("1 1/2 h")).toEqual(["NUM(1 1/2)", "UNIT(h)"]);
		expect(shape("1 ½ h")).toEqual(["NUM(1 ½)", "UNIT(h)"]);
		expect(shape("1½ h")).toEqual(["NUM(1½)", "UNIT(h)"]);
		expect(shape("1 30 min")).toEqual(["NUM(1)", "NUM(30)", "UNIT(m)"]);
	});

	it("drops the dot of an abbreviation, never the dot after a digit", () => {
		expect(shape("1 Std. 30")).toEqual(["NUM(1)", "UNIT(std)", "NUM(30)"]);
		expect(tokenizeDuration("1. h").ok).toBe(false);
	});

	it("reads a letter of any script as a unit", () => {
		expect(shape("1時間30分")).toEqual([
			"NUM(1)",
			"UNIT(時間)",
			"NUM(30)",
			"UNIT(分)",
		]);
	});

	it("reads the typographic variants of primes, dashes and the multiplication sign", () => {
		expect(shape("5′30″")).toEqual([
			"NUM(5)",
			"PRIME(m)",
			"NUM(30)",
			"PRIME(s)",
		]);
		expect(shape("5’30’’")).toEqual([
			"NUM(5)",
			"PRIME(m)",
			"NUM(30)",
			"PRIME(s)",
		]);
		expect(shape("1–2 h")).toEqual(["NUM(1)", "DASH", "NUM(2)", "UNIT(h)"]);
		expect(shape("2 × 2")).toEqual(["NUM(2)", "STAR", "NUM(2)"]);
	});
});

describe("TIME_DICTIONARIES", () => {
	it("never lets an abbreviation mean two different units in two languages", () => {
		const seen = new Map<string, { unit: string; lang: string }>();
		for (const lang of LANGUAGES) {
			for (const [alias, unit] of Object.entries(TIME_BY_LANG[lang] ?? {})) {
				const other = seen.get(alias);
				if (other) {
					expect(
						unit,
						`"${alias}" is ${other.unit} in ${other.lang}, ${unit} in ${lang}`,
					).toBe(other.unit);
				} else {
					seen.set(alias, { unit, lang });
				}
			}
		}
	});

	it("only holds abbreviations the tokenizer reads as one unit", () => {
		for (const lang of LANGUAGES) {
			for (const alias of Object.keys(TIME_BY_LANG[lang] ?? {})) {
				const result = tokenizeDuration(`1 ${alias}`);
				expect(result.ok && result.tokens[1]).toMatchObject({
					kind: "word",
					text: alias,
				});
			}
		}
	});
});
