import { describe, expect, it } from "bun:test";
import { formatGram } from "../src/index";

// A ratio with units is never a sum (rule 4b) and keeps the spaces around
// its slash as written: one side is enough (`1 /100 g`), and gluing both
// would turn `1 / 100` into the fraction `1/100`.
const format = (step: string) =>
	formatGram(
		`## Prep\n\nMix @flour{100 g}, @roast{1 kg} and @water{1 l}: ${step}.\n`,
	).content;

describe("format: ratios with units", () => {
	for (const ratio of [
		"@eggs{1 / 100 g @&flour}",
		"@eggs{1,5 / 100 g @&flour}",
		"@x{1/2 / 100 g @&flour}",
		"@x{15-20 g / 100 g @&flour}",
		"@x{1 /100 g @&flour}",
		"@x{1/ 100 g @&flour}",
		"@salt{2 g / 100 g @&chocolat-70}",
		"@salt{15 g / L @&water}",
		"&stock{250 ml / 100 g @&flour}",
		"~{15 min / 500 g @&roast}",
		"~{1:30 h / 1 kg @&roast}",
		"~{4 min / @&roast}",
	]) {
		it(`leaves ${ratio} as written, twice in a row`, () => {
			const once = format(ratio);
			expect(once).toContain(ratio);
			expect(format(ratio)).toBe(formatGram(once).content);
		});
	}
});
