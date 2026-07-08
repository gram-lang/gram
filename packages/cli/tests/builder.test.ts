import { describe, it, expect, afterEach } from "bun:test";
import { buildFiles } from "../src/services/builder";
import { writeTmpFile, cleanupTmpFile } from "./helpers";

describe("buildFiles", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	it("compiles each file and derives its slug from the basename", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const results = await buildFiles([a]);
		expect(results).toHaveLength(1);
		expect(results[0]?.file).toBe(a);
		expect(results[0]?.slug).toBe(a.split("/").pop()?.replace(".gram", ""));
		expect((results[0]?.data as any).shopping_list[0].id).toBe("flour");
	});

	it("builds multiple files concurrently, preserving order", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{100g}.\n");
		const b = await tmp("## Prep\n[Mix] Add @sugar{50g}.\n");
		const results = await buildFiles([a, b]);
		expect(results.map((r) => r.file)).toEqual([a, b]);
	});

	it("applies a scaleFactor when provided", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const results = await buildFiles([a], { scaleFactor: 2 });
		expect((results[0]?.data as any).shopping_list[0].qty).toBe(400);
	});
});
