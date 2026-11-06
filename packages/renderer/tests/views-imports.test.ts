import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// A view never imports another view: what two views share lives in `shared/`
// (or in the contract, the settings, the types and `prepareViews`), so a view
// can be added or removed without touching the others.

const SRC = resolve(import.meta.dir, "../src");
const VIEWS = join(SRC, "views");
const ALLOWED_OUTSIDE = new Set([
	"contract.ts",
	"prepare-views.ts",
	"settings.ts",
	"types.ts",
]);

const viewFolders = readdirSync(VIEWS, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

function importsOf(file: string): string[] {
	const source = readFileSync(file, "utf-8");
	return [...source.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)].map(
		(m) => m[1]!,
	);
}

function filesIn(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? filesIn(join(dir, entry.name))
			: entry.name.endsWith(".ts")
				? [join(dir, entry.name)]
				: [],
	);
}

describe("the import rule of the views", () => {
	it("finds the views", () => {
		expect(viewFolders).toContain("recipe");
		expect(viewFolders).toContain("work-plan");
	});

	for (const view of viewFolders) {
		it(`${view} imports only its own folder, shared/ and the pipeline`, () => {
			const folder = join(VIEWS, view);
			const offending: string[] = [];
			for (const file of filesIn(folder)) {
				for (const spec of importsOf(file)) {
					if (!spec.startsWith(".")) continue; // a package
					const target = resolve(dirname(file), spec);
					const inside = !relative(folder, target).startsWith("..");
					const fromSrc = relative(SRC, target);
					const allowed =
						inside ||
						fromSrc.startsWith("shared/") ||
						ALLOWED_OUTSIDE.has(fromSrc) ||
						ALLOWED_OUTSIDE.has(`${fromSrc}.ts`);
					if (!allowed) offending.push(`${relative(SRC, file)} → ${spec}`);
				}
			}
			expect(offending).toEqual([]);
		});
	}
});
