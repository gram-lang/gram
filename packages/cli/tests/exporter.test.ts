import { describe, it, expect, afterEach } from "bun:test";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getView } from "@gram-lang/renderer";
import type { PipelineResult } from "../src/core/pipeline";
import { exportRecipe, NothingToShowError } from "../src/services/exporter";
import { writeTmpFile, cleanupTmpFile } from "./helpers";

describe("exportRecipe", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	it("exports to markdown containing the ingredient and quantity", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const md = await exportRecipe(path, "markdown", null);
		expect(md).toContain("flour");
		expect(md).toContain("200");
	});

	it("exports to HTML containing the ingredient", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const html = await exportRecipe(path, "print", null);
		expect(html).toContain("flour");
		expect(html.toLowerCase()).toContain("<html");
	});

	it("applies a scaleFactor to the exported quantity", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const md = await exportRecipe(path, "markdown", null, 2);
		expect(md).toContain("400");
		expect(md).not.toContain("800");
	});

	it("tells onPipeline the title and every file the recipe was read from", async () => {
		const path = await tmp(
			'---\ntitle: Tarte\n---\n\n@use "./pate.gram" as &pate\n\n## Prep\n\n[Mix] Add @flour{200g} and &pate{100g}.\n',
		);
		const base = join(dirname(path), "pate.gram");
		await writeFile(base, "## Pâte\n\n[Mix] Add @butter{100g}.\n", "utf-8");
		paths.push(base);
		let seen: PipelineResult | undefined;
		await exportRecipe(path, "html", null, undefined, {
			onPipeline: (result) => {
				seen = result;
			},
		});
		expect(seen?.compiled.title).toBe("Tarte");
		expect(seen?.dependencies.sort()).toEqual([base, path].sort());
	});

	it("throws a NothingToShowError when the view has nothing to show", async () => {
		const path = await tmp("## Prep\n\n[Mix] Add @flour{200g}.\n");
		const recipe = getView("recipe");
		if (!recipe) throw new Error("no recipe view");
		await expect(
			exportRecipe(path, "html", null, undefined, {
				view: { view: { ...recipe, render: () => null } },
			}),
		).rejects.toBeInstanceOf(NothingToShowError);
	});
});
