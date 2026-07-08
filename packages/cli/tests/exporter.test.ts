import { describe, it, expect, afterEach } from "bun:test";
import { exportRecipe } from "../src/services/exporter";
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
		const md = await exportRecipe(path, "md", null);
		expect(md).toContain("flour");
		expect(md).toContain("200");
	});

	it("exports to HTML containing the ingredient", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const html = await exportRecipe(path, "html", null);
		expect(html).toContain("flour");
		expect(html.toLowerCase()).toContain("<html");
	});

	it("applies a scaleFactor to the exported quantity", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const md = await exportRecipe(path, "md", null, 2);
		expect(md).toContain("400");
		expect(md).not.toContain("800");
	});
});
