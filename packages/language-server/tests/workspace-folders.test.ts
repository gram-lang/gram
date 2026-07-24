import { describe, it, expect } from "bun:test";
import { resolveWorkspaceFolders } from "../src/utils/workspace-folders";

// Regression test for the audit (2026-07-22, finding B2): fileURLToPath
// throws on any non-`file:` URI. A remote/virtual workspace folder
// (vscode-vfs://, untitled:, a Live Share session, ...) used to crash
// initialization for the whole server session before it could even respond
// to the client.

describe("resolveWorkspaceFolders", () => {
	it("resolves file: URIs to local paths", () => {
		const result = resolveWorkspaceFolders([
			{ uri: "file:///home/user/recipes" },
		]);
		expect(result).toEqual(["/home/user/recipes"]);
	});

	it("skips non-file URIs instead of throwing", () => {
		expect(() =>
			resolveWorkspaceFolders([
				{ uri: "vscode-vfs://github/owner/repo" },
				{ uri: "untitled:Untitled-1" },
			]),
		).not.toThrow();
		expect(
			resolveWorkspaceFolders([
				{ uri: "vscode-vfs://github/owner/repo" },
				{ uri: "untitled:Untitled-1" },
			]),
		).toEqual([]);
	});

	it("resolves the file: folders and skips the rest in a mixed list", () => {
		const result = resolveWorkspaceFolders([
			{ uri: "vscode-vfs://github/owner/repo" },
			{ uri: "file:///home/user/recipes" },
		]);
		expect(result).toEqual(["/home/user/recipes"]);
	});

	it("returns an empty array for null/undefined", () => {
		expect(resolveWorkspaceFolders(undefined)).toEqual([]);
		expect(resolveWorkspaceFolders(null)).toEqual([]);
	});
});
