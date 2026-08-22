import { describe, it, expect, afterAll, mock } from "bun:test";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// update-checker.ts's only network call goes through core/http.ts's guarded
// fetch — stub that module rather than global fetch, so these tests never
// touch the real network regardless of what fetchTextWithSsrfGuard does
// internally (SSRF checks, redirects, timeouts).
let fetchResponse: { body: string; contentType: string } | Error = {
	body: JSON.stringify({ version: "9.9.9" }),
	contentType: "application/json",
};

mock.module("../src/core/http", () => ({
	fetchTextWithSsrfGuard: async () => {
		if (fetchResponse instanceof Error) throw fetchResponse;
		return fetchResponse;
	},
}));

const { isNewerVersion, getPendingNotification, checkForUpdateInBackground } =
	await import("../src/services/update-checker");

describe("isNewerVersion", () => {
	it("detects a newer patch, minor, or major version", () => {
		expect(isNewerVersion("1.1.1", "1.1.0")).toBe(true);
		expect(isNewerVersion("1.2.0", "1.1.0")).toBe(true);
		expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true);
	});

	it("returns false when equal or behind", () => {
		expect(isNewerVersion("1.2.0", "1.2.0")).toBe(false);
		expect(isNewerVersion("1.1.0", "1.2.0")).toBe(false);
	});
});

describe("getPendingNotification", () => {
	const cachePath = join(tmpdir(), `gram-update-cache-${Date.now()}.json`);

	afterAll(async () => {
		await unlink(cachePath).catch(() => {});
	});

	it("returns null when there is no cache yet", async () => {
		expect(await getPendingNotification("1.0.0", cachePath)).toBeNull();
	});

	it("returns the latest version when the cache is ahead of current", async () => {
		await writeFile(
			cachePath,
			JSON.stringify({ lastCheck: Date.now(), latestVersion: "2.0.0" }),
		);
		expect(await getPendingNotification("1.0.0", cachePath)).toEqual({
			latest: "2.0.0",
		});
	});

	it("returns null when already up to date", async () => {
		await writeFile(
			cachePath,
			JSON.stringify({ lastCheck: Date.now(), latestVersion: "1.0.0" }),
		);
		expect(await getPendingNotification("1.0.0", cachePath)).toBeNull();
	});
});

describe("checkForUpdateInBackground", () => {
	const cachePath = join(tmpdir(), `gram-update-cache-bg-${Date.now()}.json`);

	afterAll(async () => {
		await unlink(cachePath).catch(() => {});
	});

	it("fetches and writes a fresh cache when none exists", async () => {
		fetchResponse = {
			body: JSON.stringify({ version: "3.0.0" }),
			contentType: "application/json",
		};
		await checkForUpdateInBackground(cachePath);
		const cache = JSON.parse(await readFile(cachePath, "utf-8"));
		expect(cache.latestVersion).toBe("3.0.0");
	});

	it("does not refetch when the cache is still fresh", async () => {
		await writeFile(
			cachePath,
			JSON.stringify({ lastCheck: Date.now(), latestVersion: "1.2.3" }),
		);
		fetchResponse = {
			body: JSON.stringify({ version: "9.9.9" }),
			contentType: "application/json",
		};
		await checkForUpdateInBackground(cachePath);
		const cache = JSON.parse(await readFile(cachePath, "utf-8"));
		expect(cache.latestVersion).toBe("1.2.3");
	});

	it("swallows network errors instead of throwing", async () => {
		fetchResponse = new Error("offline");
		await expect(
			checkForUpdateInBackground(
				join(tmpdir(), "gram-update-cache-offline.json"),
			),
		).resolves.toBeUndefined();
	});
});
