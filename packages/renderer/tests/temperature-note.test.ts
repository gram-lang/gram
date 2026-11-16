import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import {
	formatElement,
	formatTemperature,
	toHTML,
	toMarkdown,
} from "../src/index";

// A temperature's note (`^{160°C}(fan)`, 1.5) is an instruction: it stays in
// the sentence in every format, never only in a tooltip.

const exact = {
	type: "temperature",
	quantity: { type: "single", value: 160, text: "160" },
	unit: "°C",
	note: "fan",
};
const inWords = { type: "temperature", text: "high", note: "covered" };
const icons = { thermometer: "T" };

describe("formatTemperature", () => {
	it("gives the value and unit, or the words, never the note", () => {
		expect(formatTemperature(exact)).toBe("160 °C");
		expect(formatTemperature(inWords)).toBe("high");
		expect(
			formatTemperature(
				{ quantity: { type: "single", value: 37.5 }, unit: "°C" },
				"fr",
			),
		).toBe("37,5 °C");
	});
});

describe("a temperature's note in each format", () => {
	it("text: after the value", () => {
		expect(formatElement(exact, "text")).toBe("160 °C (fan)");
		expect(formatElement(inWords, "text")).toBe("high (covered)");
	});

	it("Markdown: after the value, escaped", () => {
		expect(formatElement(exact, "md", { icons })).toBe("T160 °C (fan)");
		expect(
			formatElement({ ...exact, note: "<b>fan</b>" }, "md", { icons }),
		).not.toContain("<b>");
	});

	it("HTML: outside the pill, in a group the line may break inside", () => {
		expect(formatElement(exact, "html", { icons })).toBe(
			'<span class="temp-group"><span class="temp" data-value="160" data-unit="°C">T 160 °C</span> <span class="prep">(fan)</span></span>',
		);
		expect(formatElement(inWords, "html", { icons })).toBe(
			'<span class="temp-group"><span class="temp" data-semantic="high">T high</span> <span class="prep">(covered)</span></span>',
		);
	});

	it("HTML: takes the classes of the context", () => {
		const html = formatElement(exact, "html", {
			icons,
			classes: { temperatureGroup: "g", prepText: "n" },
		});
		expect(html).toStartWith('<span class="g">');
		expect(html).toContain('<span class="n">(fan)</span>');
	});

	it("HTML: a temperature without a note keeps its single pill", () => {
		const { note: _, ...plain } = exact;
		expect(formatElement(plain, "html", { icons })).toBe(
			'<span class="temp" data-value="160" data-unit="°C">T 160 °C</span>',
		);
	});
});

describe("a temperature's note in the recipe views", () => {
	const compiled = compile(
		getAST("## Four\n\nCuire à ^{160°C}(chaleur tournante).\n"),
	);

	it("is in the HTML, the punctuation glued to its parenthesis", () => {
		const html = toHTML(compiled);
		expect(html).toContain(
			'<span class="prep">(chaleur tournante)</span></span>.',
		);
	});

	it("is in the Markdown", () => {
		expect(toMarkdown(compiled)).toContain("160 °C (chaleur tournante).");
	});
});
