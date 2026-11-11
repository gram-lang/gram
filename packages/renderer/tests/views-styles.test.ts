import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { type ViewDefinition, prepareViews, views } from "../src/index";
import {
	SHARED_STYLESHEETS,
	folderOf,
	gramCss,
	screenStylesheetOf,
} from "../scripts/build-css.mjs";

// Each view styles only itself: its `screen.css` is one `@scope` on the class
// of its root element, and its html is written in that root. A rule of one
// view can then never reach another, whatever the surface shows them in. Fix
// the stylesheet or the markup, never this test.

const SRC = join(import.meta.dir, "../src");
const read = (path: string) => readFileSync(join(SRC, path), "utf8");
const rootOf = (view: ViewDefinition) => `gram-${folderOf(view.id)}`;
const stylesOf = (view: ViewDefinition) => read(screenStylesheetOf(view.id));

/** The stylesheet without its comments. */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The top-level blocks of a stylesheet: their prelude, before the `{`. */
function topLevelPreludes(css: string): string[] {
	const preludes: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < css.length; i++) {
		const c = css[i];
		if (c === "{") {
			if (depth === 0) preludes.push(css.slice(start, i).trim());
			depth++;
		} else if (c === "}") {
			depth--;
			if (depth === 0) start = i + 1;
		}
	}
	expect(depth).toBe(0);
	return preludes;
}

const RECIPE = `---
title: Country bread
portions: 2
---

## Dough ->&dough

[Mix] Mix @flour{500g} with @water{350g} in a #bowl{}, knead ~{20min}.

[Rise] Let it rise ~_{8h}.

## Bake

[Bake] Bake &dough{} at ^{240C} for ~{30min}.
`;

describe("the stylesheet of each view", () => {
	for (const view of views as readonly ViewDefinition[]) {
		const root = rootOf(view);

		it(`${view.id}: is one @scope on .${root}`, () => {
			const preludes = topLevelPreludes(strip(stylesOf(view)));
			const scopes = preludes.filter((p) => p.startsWith("@scope"));
			expect(scopes).toEqual([`@scope (.${root})`]);
			// Besides the scope, only keyframes named after the view (a
			// keyframes rule cannot sit inside a scope).
			for (const prelude of preludes.filter((p) => !p.startsWith("@scope"))) {
				expect(prelude).toStartWith(`@keyframes ${root}-`);
			}
		});

		it(`${view.id}: names no other view's root`, () => {
			for (const other of views as readonly ViewDefinition[]) {
				if (other === view) continue;
				expect(strip(stylesOf(view))).not.toContain(`.${rootOf(other)}`);
			}
		});

		it(`${view.id}: writes its html in its root`, () => {
			const input = prepareViews(compile(getAST(RECIPE)));
			const html = view.render(input, "html");
			expect(html).not.toBeNull();
			expect(html?.trimStart()).toMatch(new RegExp(`^<[a-z]+ class="${root}"`));
		});
	}
});

describe("the shared stylesheets", () => {
	const shared = SHARED_STYLESHEETS.map(read).join("\n");

	it("name no view's root", () => {
		for (const view of views as readonly ViewDefinition[]) {
			expect(strip(shared)).not.toContain(`.${rootOf(view)}`);
		}
	});

	it("are only tokens, the frame and the tooltip", () => {
		// No component of a view slips into them: they hold no class of a view.
		// `.gram-nobr` is the glue every view writes around a step element
		// (`nobr()` of `shared/utils.ts`), like the icons.
		for (const path of SHARED_STYLESHEETS) {
			const css = strip(read(path));
			for (const prelude of topLevelPreludes(css)) {
				expect(prelude).toMatch(
					/^(:root|\.dark|body\.vscode-dark|\.gram-preview|svg\.gicon|\.gram-nobr|:where\(\.gram-nobr|\.gram-tooltip-fixed|body\.gram-has-js-tooltips)/,
				);
			}
		}
	});
});

describe("gram.css", () => {
	it("is the shared stylesheets, then every view's, in the registry's order", () => {
		const ids = (views as readonly ViewDefinition[]).map((view) => view.id);
		const css = gramCss(ids);
		expect(css.startsWith(SHARED_STYLESHEETS.map(read).join("\n"))).toBe(true);
		let from = 0;
		for (const view of views as readonly ViewDefinition[]) {
			const at = css.indexOf(stylesOf(view), from);
			expect(at).toBeGreaterThanOrEqual(from);
			from = at;
		}
	});
});
