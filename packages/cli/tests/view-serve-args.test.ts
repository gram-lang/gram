import { describe, expect, it } from "bun:test";
import { CLI_VIEW_NAMES } from "../src/core/cli-views";
import { PREVIEW_VIEWS, resolveServeOptions } from "../src/services/view-serve";

const args = (extra: Record<string, unknown> = {}) => ({
	_: ["r.gram"],
	file: "r.gram",
	open: true,
	serve: false,
	...extra,
});

describe("resolveServeOptions", () => {
	it("is the terminal view without --serve", () => {
		expect(resolveServeOptions(args())).toBeNull();
		// --no-open alone is ignored: citty cannot tell it from the default.
		expect(resolveServeOptions(args({ open: false }))).toBeNull();
	});

	it("defaults to the recipe, the default port and opening the browser", () => {
		expect(resolveServeOptions(args({ serve: true }))).toEqual({
			open: true,
			view: "recipe",
		});
	});

	it("reads --port, --no-open and --view with --serve", () => {
		expect(
			resolveServeOptions(
				args({ serve: true, port: "8080", open: false, view: "run-sheet" }),
			),
		).toEqual({ port: 8080, open: false, view: "run-sheet" });
	});

	it("refuses --port and --view without --serve", () => {
		expect(() => resolveServeOptions(args({ port: "8080" }))).toThrow(
			"--port only applies with --serve",
		);
		expect(() => resolveServeOptions(args({ view: "run-sheet" }))).toThrow(
			"--view only applies with --serve",
		);
	});

	it("refuses a port out of range or not a number", () => {
		for (const port of ["0", "70000", "abc", "80.5", "-1", ""]) {
			expect(() => resolveServeOptions(args({ serve: true, port }))).toThrow(
				`Invalid --port value "${port}"`,
			);
		}
	});

	it("refuses a serving time written the gram plan way", () => {
		expect(() =>
			resolveServeOptions(
				args({ serve: true, _: ["r.gram", "2026-10-11 13:00"] }),
			),
		).toThrow('use gram plan --serve "<date>"');
	});

	it("refuses an unknown view, listing the views", () => {
		expect(() =>
			resolveServeOptions(args({ serve: true, view: "gantt" })),
		).toThrow(`Expected one of: ${CLI_VIEW_NAMES.join(", ")}`);
	});

	it("offers every view that has a screen layout", () => {
		expect(PREVIEW_VIEWS.length).toBeGreaterThan(1);
		for (const view of PREVIEW_VIEWS) {
			expect(view.formats).toContain("html");
		}
	});
});
