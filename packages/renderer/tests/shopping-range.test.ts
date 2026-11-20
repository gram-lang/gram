import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toMarkdown } from "../src/index";

// Since 1.5.0 ranges add up by their bounds: a shopping entry keeps its
// middle in `qty` and its bounds in `range`, shown by its bounds, never the
// middle. A section lists each mention as written.
function markdownOf(body: string): string {
	const source = `---\ntitle: 'T'\n---\n\n## Section\n\n${body}\n`;
	return toMarkdown(compile(getAST(source)));
}

describe("ranges added up by their bounds", () => {
	const md = markdownOf("Add @salt{2-3 g} then @salt{200 g}.");

	it("shows a shopping entry's bounds", () => {
		const shopping = md.slice(0, md.indexOf("## Instructions"));
		expect(shopping).toContain("**salt** (202-203 g)");
		expect(shopping).not.toContain("202.5");
	});

	it("lists a section's mentions as written, the range included", () => {
		const section = md.slice(md.indexOf("## Instructions"));
		expect(section).toContain("**salt** (2-3 g + 200 g)");
	});
});
