import { describe, it, expect, afterEach } from "bun:test";
import { readFile, unlink } from "node:fs/promises";
import { generatePrintHTML, openInBrowser } from "../src/services/printer";
import { writeTmpFile, cleanupTmpFile } from "./helpers";

describe("generatePrintHTML", () => {
	const paths: string[] = [];
	const outputs: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
		while (outputs.length > 0) await unlink(outputs.pop()!).catch(() => {});
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	it("writes a print-ready HTML file to a temp path and returns it", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const outPath = await generatePrintHTML(path, null);
		outputs.push(outPath);
		expect(outPath).toMatch(/gram_print_\d+\.html$/);
		const content = await readFile(outPath, "utf-8");
		expect(content).toContain("flour");
		expect(content.toLowerCase()).toContain("<html");
	});
});

describe("openInBrowser", () => {
	it("resolves to false when the opener is missing, without crashing", async () => {
		const path = process.env.PATH;
		process.env.PATH = "/nonexistent";
		try {
			expect(await openInBrowser("/tmp/nothing.html", "linux")).toBe(false);
		} finally {
			process.env.PATH = path;
		}
	});
});
