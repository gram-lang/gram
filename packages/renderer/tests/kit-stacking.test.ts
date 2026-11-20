import { afterEach, describe, expect, it } from "bun:test";
import { TOOLTIP_SCRIPT } from "../src/index";
import { watchListStacking } from "../src/shared/kit-stacking";

/** A list line: its name at `nameTop`, its amount at `qtyTop`. */
function line(nameTop: number, qtyTop: number) {
	const rect = (top: number) => ({ top, height: 20 });
	return {
		querySelector(selector: string) {
			if (selector.includes("kit-name"))
				return { getBoundingClientRect: () => rect(nameTop) };
			if (selector.includes("kit-qty"))
				return { getBoundingClientRect: () => rect(qtyTop) };
			return null;
		},
	};
}

function list(lines: ReturnType<typeof line>[]) {
	const classes = new Set<string>();
	return {
		classes,
		classList: {
			add: (c: string) => classes.add(c),
			remove: (...cs: string[]) => {
				for (const c of cs) classes.delete(c);
			},
		},
		querySelectorAll: () => lines,
	};
}

type Callback = (
	entries: { target: unknown; contentRect: { width: number } }[],
) => void;
let observed: { callback: Callback; targets: unknown[] } | null = null;
const g = globalThis as Record<string, unknown>;

function withResizeObserver(): void {
	g.ResizeObserver = class {
		targets: unknown[] = [];
		constructor(callback: Callback) {
			observed = { callback, targets: this.targets };
		}
		observe(target: unknown) {
			this.targets.push(target);
		}
		disconnect() {
			this.targets.length = 0;
		}
	};
}

afterEach(() => {
	delete g.ResizeObserver;
	observed = null;
});

describe("one layout per list (watchListStacking)", () => {
	it("stacks every line of a list once one amount sits under its name", () => {
		withResizeObserver();
		const tight = list([line(0, 0), line(30, 52), line(80, 80)]);
		const roomy = list([line(0, 0), line(30, 30)]);
		const root = { querySelectorAll: () => [tight, roomy] };
		const stop = watchListStacking(root as unknown as Document);
		observed?.callback([
			{ target: tight, contentRect: { width: 300 } },
			{ target: roomy, contentRect: { width: 300 } },
		]);
		expect(tight.classes.has("kit-list-single")).toBe(true);
		expect(tight.classes.has("kit-list-stacked")).toBe(true);
		// Another list of the page keeps its columns and its compact lines.
		expect(roomy.classes.has("kit-list-single")).toBe(false);
		expect(roomy.classes.has("kit-list-stacked")).toBe(false);
		stop();
	});

	it("tries one column first, and stacks only when a line still does not fit", () => {
		withResizeObserver();
		const classes = new Set<string>();
		// The amount falls under the name in a column, fits on a whole line.
		const fitsInOneColumn = {
			querySelector: (s: string) => ({
				getBoundingClientRect: () => ({
					top:
						s.includes("kit-qty") && !classes.has("kit-list-single") ? 22 : 0,
					height: 20,
				}),
			}),
		};
		const wide = {
			classes,
			classList: {
				add: (c: string) => classes.add(c),
				remove: (...cs: string[]) => {
					for (const c of cs) classes.delete(c);
				},
			},
			querySelectorAll: () => [fitsInOneColumn],
		};
		watchListStacking({ querySelectorAll: () => [wide] } as never);
		observed?.callback([{ target: wide, contentRect: { width: 700 } }]);
		expect(classes.has("kit-list-single")).toBe(true);
		expect(classes.has("kit-list-stacked")).toBe(false);
	});

	it("measures again only when the width changes, not the height", () => {
		withResizeObserver();
		let qtyTop = 52;
		const lines = [
			{
				querySelector: (s: string) => ({
					getBoundingClientRect: () => ({
						top: s.includes("kit-qty") ? qtyTop : 30,
						height: 20,
					}),
				}),
			},
		];
		const only = list(lines as never);
		const root = { querySelectorAll: () => [only] };
		watchListStacking(root as unknown as Document);
		const resize = (width: number) =>
			observed?.callback([{ target: only, contentRect: { width } }]);
		resize(300);
		expect(only.classes.has("kit-list-stacked")).toBe(true);
		qtyTop = 30;
		resize(300); // stacking made it taller: same width, nothing measured
		expect(only.classes.has("kit-list-stacked")).toBe(true);
		resize(600); // wider: everything fits again
		expect(only.classes.has("kit-list-stacked")).toBe(false);
		expect(only.classes.has("kit-list-single")).toBe(false);
	});

	it("does nothing without ResizeObserver, and the standalone script carries it", () => {
		const stop = watchListStacking({} as Document);
		expect(typeof stop).toBe("function");
		stop();
		expect(TOOLTIP_SCRIPT).toContain("kit-list-stacked");
		expect(() => new Function(TOOLTIP_SCRIPT)).not.toThrow();
	});
});
