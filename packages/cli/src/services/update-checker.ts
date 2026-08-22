import { readFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { atomicWrite } from "../core/lock";
import { fetchTextWithSsrfGuard } from "../core/http";

const REGISTRY_URL = "https://registry.npmjs.org/@gram-lang/cli/latest";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface UpdateCache {
	lastCheck: number;
	latestVersion: string;
}

export function getCachePath(): string {
	return join(homedir(), ".config", "gram", "update-check.json");
}

async function readCache(cachePath: string): Promise<UpdateCache | null> {
	try {
		const data = JSON.parse(await readFile(cachePath, "utf-8"));
		if (
			typeof data?.lastCheck === "number" &&
			typeof data?.latestVersion === "string"
		) {
			return data;
		}
		return null;
	} catch {
		return null;
	}
}

async function writeCache(
	cachePath: string,
	cache: UpdateCache,
): Promise<void> {
	await mkdir(dirname(cachePath), { recursive: true });
	await atomicWrite(cachePath, JSON.stringify(cache));
}

export async function fetchLatestVersion(): Promise<string> {
	const { body } = await fetchTextWithSsrfGuard(REGISTRY_URL);
	const data = JSON.parse(body) as { version?: string };
	if (!data.version) {
		throw new Error(`Unexpected response from ${REGISTRY_URL}`);
	}
	return data.version;
}

// Every published version is plain x.y.z (the changeset "fixed" group never
// produces prerelease/build tags), so a numeric segment-by-segment compare is
// enough — no need for a semver dependency.
export function isNewerVersion(latest: string, current: string): boolean {
	const a = latest.split(".").map(Number);
	const b = current.split(".").map(Number);
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const x = a[i] ?? 0;
		const y = b[i] ?? 0;
		if (x !== y) return x > y;
	}
	return false;
}

/**
 * Refreshes the on-disk cache if it's missing or older than 24h. Fire-and-forget
 * from index.ts — never throws, so an offline machine or a flaky registry never
 * affects a command's own runtime or exit code.
 */
export async function checkForUpdateInBackground(
	cachePath: string = getCachePath(),
): Promise<void> {
	try {
		const cache = await readCache(cachePath);
		if (cache && Date.now() - cache.lastCheck < CHECK_INTERVAL_MS) return;
		const latestVersion = await fetchLatestVersion();
		await writeCache(cachePath, { lastCheck: Date.now(), latestVersion });
	} catch {
		// Offline, timed out, or the registry is down — silently skip this run.
	}
}

export interface PendingUpdate {
	latest: string;
}

/** Reads only the cache (no network) — used to show a passive notice once a command has finished. */
export async function getPendingNotification(
	currentVersion: string,
	cachePath: string = getCachePath(),
): Promise<PendingUpdate | null> {
	const cache = await readCache(cachePath);
	if (!cache) return null;
	return isNewerVersion(cache.latestVersion, currentVersion)
		? { latest: cache.latestVersion }
		: null;
}
