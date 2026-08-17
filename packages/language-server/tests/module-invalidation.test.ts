import { describe, it, expect } from "bun:test";
import {
	loadModuleGraph,
	type ModuleHost,
	type ModuleGraph,
} from "@gram-lang/modules";
import { affectedOpenImporters } from "../src/utils/module-invalidation";

/** A minimal in-memory ModuleHost, POSIX-style absolute uris, no real filesystem. */
function createFakeHost(files: Record<string, string>): ModuleHost {
	return {
		resolve(specifier: string, fromUri: string): string {
			const fromDir = fromUri.slice(0, fromUri.lastIndexOf("/")) || "/";
			const parts = `${fromDir}/${specifier}`.split("/");
			const stack: string[] = [];
			for (const part of parts) {
				if (part === "" || part === ".") continue;
				if (part === "..") stack.pop();
				else stack.push(part);
			}
			return `/${stack.join("/")}`;
		},
		read(uri: string): string {
			if (!(uri in files)) throw new Error(`ENOENT: ${uri}`);
			return files[uri]!;
		},
	};
}

async function chainGraphs(): Promise<Map<string, ModuleGraph>> {
	// A -> B -> C
	const host = createFakeHost({
		"/a.gram": '@use "./b.gram" as &b\n\n## A\n\n[Use] the &b{100g}.\n',
		"/b.gram": '@use "./c.gram" as &c\n\n## B\n\n[Use] the &c{100g}.\n',
		"/c.gram": "## C\n\n[Mix] the @flour{100g}.\n",
	});
	const graphs = new Map<string, ModuleGraph>();
	graphs.set("/a.gram", await loadModuleGraph("/a.gram", host));
	graphs.set("/b.gram", await loadModuleGraph("/b.gram", host));
	return graphs;
}

describe("buildOpenReverseIndex / affectedOpenImporters", () => {
	it("editing the leaf of an open A -> B -> C chain notifies both open importers", async () => {
		const graphs = await chainGraphs();
		const affected = affectedOpenImporters(
			graphs,
			["/a.gram", "/b.gram"],
			"/c.gram",
		);
		expect(new Set(affected)).toEqual(new Set(["/a.gram", "/b.gram"]));
	});

	it("a dependency that isn't itself an open document is excluded from the result", async () => {
		const graphs = await chainGraphs();
		// Only /a.gram is open; /b.gram's graph still exists in `graphs`
		// (server.ts keeps one per refreshed document), but /b.gram itself
		// isn't part of the *open* set passed in.
		const affected = affectedOpenImporters(graphs, ["/a.gram"], "/c.gram");
		expect(affected).toEqual(["/a.gram"]);
	});

	it("a document with no importers has no affected dependents", async () => {
		const graphs = await chainGraphs();
		const affected = affectedOpenImporters(
			graphs,
			["/a.gram", "/b.gram"],
			"/a.gram",
		);
		expect(affected).toEqual([]);
	});

	it("an unrelated open document is unaffected by a change elsewhere", async () => {
		const host = createFakeHost({
			"/solo.gram": "## Solo\n\n[Mix] the @sugar{50g}.\n",
		});
		const graphs = await chainGraphs();
		graphs.set("/solo.gram", await loadModuleGraph("/solo.gram", host));
		const affected = affectedOpenImporters(
			graphs,
			["/a.gram", "/b.gram", "/solo.gram"],
			"/c.gram",
		);
		expect(affected).not.toContain("/solo.gram");
	});
});
