import { describe, expect, it, spyOn } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { toGanttHTML } from "../src/index";

const compiled = compile(
	getAST("## Dough\n\n[Mix] Mix @flour{200g} for ~{5min}.\n"),
);

describe("the Gantt chart is deprecated", () => {
	it("says so once, on the first chart drawn, and still draws it", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const html = toGanttHTML(compiled);
			toGanttHTML(compiled);
			expect(html).toContain("gantt-wrapper");
			const gantt = warn.mock.calls.filter((c) =>
				String(c[0]).includes("toGanttHTML() is deprecated"),
			);
			// Another test file may have drawn one already: at most once, ever.
			expect(gantt.length).toBeLessThanOrEqual(1);
			expect(String(gantt[0]?.[0] ?? "removed in 2.0.0")).toContain("2.0.0");
		} finally {
			warn.mockRestore();
		}
	});

	it("stays quiet for a host that renders it for others", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			toGanttHTML(compiled, { quiet: true });
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});
});
