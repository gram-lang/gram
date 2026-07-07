import { describe, it, expect, afterEach } from "bun:test";
import { stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { upsertEnvVar } from "../src/services/config-manager";

// Regression test for the security audit (Phase 3): .env holds API keys in
// plaintext and used to be written with default (world/group-readable)
// permissions on shared machines. It must always be created 0600.

describe("upsertEnvVar", () => {
	const paths: string[] = [];

	afterEach(async () => {
		await Promise.all(paths.splice(0).map((p) => rm(p, { force: true })));
	});

	it("writes .env with 0600 permissions", async () => {
		const path = join(tmpdir(), `gram-test-env-${Date.now()}.env`);
		paths.push(path);

		await upsertEnvVar(path, "ANTHROPIC_API_KEY", "sk-test-123");

		const { mode } = await stat(path);
		expect(mode & 0o777).toBe(0o600);
	});

	it("preserves 0600 permissions when updating an existing .env", async () => {
		const path = join(tmpdir(), `gram-test-env-update-${Date.now()}.env`);
		paths.push(path);

		await upsertEnvVar(path, "ANTHROPIC_API_KEY", "sk-test-123");
		await upsertEnvVar(path, "OPENAI_API_KEY", "sk-other-456");

		const { mode } = await stat(path);
		expect(mode & 0o777).toBe(0o600);
	});
});
