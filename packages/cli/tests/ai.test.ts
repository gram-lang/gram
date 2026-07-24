import { describe, it, expect, afterEach } from "bun:test";
import { loadAiModel } from "../src/core/ai";
import { GramCLIError } from "../src/errors";
import type { GramConfig } from "../src/types";

// Regression test for the security audit (2026-07-22, finding 0-a): API key
// resolution used to pick "whichever provider's key env var happened to be
// set" independently of the configured provider. Concretely, `provider:
// openai` with only GEMINI_API_KEY exported (no OPENAI_API_KEY) sent the
// Google key to api.openai.com — an exfiltration of a secret to a provider
// the user never authorized for it.
//
// Credential resolution must be a total function `provider -> expected key`:
// it may fall back from that provider's own env var to an explicit
// `ai.apiKey` in config, but it must never fall back to a *different*
// provider's key.

const PROVIDER_ENV_VARS = [
	"GEMINI_API_KEY",
	"OPENAI_API_KEY",
	"ANTHROPIC_API_KEY",
];

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
	const previous: Record<string, string | undefined> = {};
	for (const key of PROVIDER_ENV_VARS) previous[key] = process.env[key];
	for (const [key, value] of Object.entries(vars)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	try {
		fn();
	} finally {
		for (const key of PROVIDER_ENV_VARS) {
			if (previous[key] === undefined) delete process.env[key];
			else process.env[key] = previous[key];
		}
	}
}

describe("loadAiModel — credential resolution never crosses providers", () => {
	afterEach(() => {
		for (const key of PROVIDER_ENV_VARS) delete process.env[key];
	});

	it("does not leak an unrelated provider's env var key to the configured provider", () => {
		withEnv({ GEMINI_API_KEY: "leaked-google-key" }, () => {
			const config: GramConfig = { ai: { provider: "openai" } };
			expect(() => loadAiModel(config)).toThrow(GramCLIError);
			expect(() => loadAiModel(config)).toThrow(/OPENAI_API_KEY/);
		});
	});

	it("does not leak an unrelated provider's env var key even with a different one also set", () => {
		withEnv(
			{
				GEMINI_API_KEY: "leaked-google-key",
				ANTHROPIC_API_KEY: "leaked-anthropic-key",
			},
			() => {
				const config: GramConfig = { ai: { provider: "openai" } };
				expect(() => loadAiModel(config)).toThrow(/OPENAI_API_KEY/);
			},
		);
	});

	it("succeeds when the configured provider's own env var is set", () => {
		withEnv({ ANTHROPIC_API_KEY: "sk-ant-test" }, () => {
			const config: GramConfig = { ai: { provider: "anthropic" } };
			expect(() => loadAiModel(config)).not.toThrow();
		});
	});

	it("uses an explicit ai.apiKey only for the provider it was configured under", () => {
		withEnv({}, () => {
			const config: GramConfig = {
				ai: { provider: "openai", apiKey: "sk-openai-explicit" },
			};
			expect(() => loadAiModel(config)).not.toThrow();
		});
	});

	it("auto-detects the provider from whichever env var is set, and uses that same provider's key", () => {
		withEnv({ ANTHROPIC_API_KEY: "sk-ant-test" }, () => {
			const config: GramConfig = {};
			expect(() => loadAiModel(config)).not.toThrow();
		});
	});

	it("throws a clear error when no provider can be determined", () => {
		withEnv({}, () => {
			const config: GramConfig = {};
			expect(() => loadAiModel(config)).toThrow(/No AI provider configured/);
		});
	});
});
