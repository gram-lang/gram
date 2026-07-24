import { describe, it, expect, afterEach } from "bun:test";
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	resolveIngredientDb,
	reloadDbAndRefreshDiagnostics,
} from "../src/utils/db-reload";
import { parseDocument } from "../src/document-state";

// Regression tests for the audit (2026-07-22, LSP finding B3, Phase 3
// backlog item completed in Phase 15): `reloadDbAndRefreshDiagnostics` used
// to close over `server.ts`'s module-level `connection`/`states`, making it
// untestable without a real LSP connection. Every dependency is now passed
// in explicitly (dependency injection), so these tests exercise the exact
// logic `server.ts` relies on, with fakes instead of a real connection.

describe("resolveIngredientDb", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0))
			rmSync(dir, { recursive: true, force: true });
	});

	function tmpWorkspace(yaml?: string): string {
		const dir = mkdtempSync(join(tmpdir(), "gram-lsp-reload-test-"));
		dirs.push(dir);
		if (yaml !== undefined) {
			const gramDir = join(dir, ".gram");
			mkdirSync(gramDir);
			writeFileSync(join(gramDir, "ingredients.yaml"), yaml);
		}
		return dir;
	}

	it("uses the explicit configPath when given, ignoring workspace folders", () => {
		const dir = mkdtempSync(join(tmpdir(), "gram-lsp-reload-test-"));
		dirs.push(dir);
		const explicitPath = join(dir, "custom-db.yaml");
		writeFileSync(explicitPath, "flour:\n  name: Flour\n");

		const result = resolveIngredientDb(explicitPath, []);

		expect(Object.keys(result.db)).toEqual(["flour"]);
		expect(result.lookupSet.size).toBeGreaterThan(0);
		expect(result.rejected).toEqual([]);
	});

	it("auto-discovers .gram/ingredients.yaml in the first matching workspace folder", () => {
		const withDb = tmpWorkspace("sugar:\n  name: Sugar\n");
		const withoutDb = mkdtempSync(join(tmpdir(), "gram-lsp-reload-test-"));
		dirs.push(withoutDb);

		const result = resolveIngredientDb(undefined, [withoutDb, withDb]);

		expect(Object.keys(result.db)).toEqual(["sugar"]);
	});

	it("returns an empty, valid database when no folder has one", () => {
		const dir = mkdtempSync(join(tmpdir(), "gram-lsp-reload-test-"));
		dirs.push(dir);

		const result = resolveIngredientDb(undefined, [dir]);

		expect(result.db).toEqual({});
		expect(result.lookupSet.size).toBe(0);
		expect(result.rejected).toEqual([]);
	});

	it("surfaces rejected entries instead of silently dropping them", () => {
		const dir = mkdtempSync(join(tmpdir(), "gram-lsp-reload-test-"));
		dirs.push(dir);
		const path = join(dir, "db.yaml");
		writeFileSync(
			path,
			["flour:", "  name: Flour", "bad:", "  physical: { density: 1.0 }"].join(
				"\n",
			),
		);

		const result = resolveIngredientDb(path, []);

		expect(Object.keys(result.db)).toEqual(["flour"]);
		expect(result.rejected.map((r) => r.key)).toEqual(["bad"]);
	});
});

describe("reloadDbAndRefreshDiagnostics", () => {
	function fakeDeps(
		overrides: Partial<
			Parameters<typeof reloadDbAndRefreshDiagnostics>[0]
		> = {},
	) {
		const warnings: string[] = [];
		const errors: string[] = [];
		return {
			deps: {
				getConfiguredDbPath: async () => undefined,
				workspaceFolders: [],
				states: new Map(),
				computeDiagnostics: () => [],
				onWarn: (message: string) => warnings.push(message),
				onError: (message: string) => errors.push(message),
				...overrides,
			},
			warnings,
			errors,
		};
	}

	it("never rejects when getConfiguredDbPath throws, falling back to workspace auto-discovery", async () => {
		const { deps, errors } = fakeDeps({
			getConfiguredDbPath: async () => {
				throw new Error("config lookup failed");
			},
		});

		await expect(reloadDbAndRefreshDiagnostics(deps)).resolves.toBeDefined();
		// No workspace folders configured -> falls back cleanly, no error surfaced.
		expect(errors).toEqual([]);
	});

	it("computes diagnostics for every open document and reports them by uri", async () => {
		const stateA = parseDocument("## Section\n\nMix @flour{200g}.\n", {}, 1);
		const stateB = parseDocument("## Section\n\nMix @sugar{100g}.\n", {}, 1);
		const { deps } = fakeDeps({
			states: new Map([
				["file:///a.gram", stateA],
				["file:///b.gram", stateB],
			]),
			computeDiagnostics: (state) => [
				{ message: state.text, range: {} } as never,
			],
		});

		const outcome = await reloadDbAndRefreshDiagnostics(deps);

		expect(outcome.diagnosticsByUri.size).toBe(2);
		expect(outcome.diagnosticsByUri.get("file:///a.gram")?.[0]?.message).toBe(
			stateA.text,
		);
		expect(outcome.diagnosticsByUri.get("file:///b.gram")?.[0]?.message).toBe(
			stateB.text,
		);
	});

	// The exact property the audit's B3 finding was about: one document's
	// diagnostics computation failing must not take down the others, nor
	// reject the whole reload.
	it("reports (but does not throw on) a per-document diagnostics failure, and still processes the rest", async () => {
		const stateA = parseDocument("## Section\n\nStep.\n", {}, 1);
		const stateB = parseDocument("## Section\n\nStep.\n", {}, 1);
		const { deps, errors } = fakeDeps({
			states: new Map([
				["file:///broken.gram", stateA],
				["file:///ok.gram", stateB],
			]),
			computeDiagnostics: (state) => {
				if (state === stateA) throw new Error("boom");
				return [];
			},
		});

		const outcome = await reloadDbAndRefreshDiagnostics(deps);

		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("file:///broken.gram");
		expect(outcome.diagnosticsByUri.has("file:///broken.gram")).toBe(false);
		expect(outcome.diagnosticsByUri.has("file:///ok.gram")).toBe(true);
	});

	it("warns (via onWarn) when the resolved database has rejected entries", async () => {
		const dir = mkdtempSync(join(tmpdir(), "gram-lsp-reload-test-"));
		try {
			const path = join(dir, "db.yaml");
			writeFileSync(path, "bad:\n  physical: { density: 1.0 }\n");
			const { deps, warnings } = fakeDeps({
				getConfiguredDbPath: async () => path,
			});

			await reloadDbAndRefreshDiagnostics(deps);

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("Ignoring 1 invalid ingredient(s)");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
