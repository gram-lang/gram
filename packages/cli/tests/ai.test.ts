import { describe, it, expect, afterEach } from "bun:test";
import { loadAiModel, resolveAiSelection } from "../src/core/ai";
import { parseAiOverrides } from "../src/core/ai-args";
import { mergeConfigLayers } from "../src/core/config";
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

// `--provider` / `--model` let a single run depart from the configured
// provider, which reopens the finding 0-a question one flag further out: the
// settings written under `ai:` belong to the provider they were written for,
// and must not follow the user onto a different one.
describe("resolveAiSelection — per-run overrides", () => {
	afterEach(() => {
		for (const key of PROVIDER_ENV_VARS) delete process.env[key];
	});

	it("changes the model without changing the provider", () => {
		withEnv({}, () => {
			const config: GramConfig = {
				ai: { provider: "openai", model: "gpt-5.4-mini" },
			};
			const sel = resolveAiSelection(config, { model: "gpt-5.5" });
			expect(sel).toMatchObject({
				provider: "openai",
				model: "gpt-5.5",
				providerSource: "config",
				modelSource: "flag",
			});
		});
	});

	it("changes the provider and falls back to that provider's default model", () => {
		withEnv({}, () => {
			// `model: gemini-3.5-flash` was written for Google. Carrying it over to
			// Anthropic would send a Gemini model name to api.anthropic.com.
			const config: GramConfig = {
				ai: { provider: "google", model: "gemini-3.5-flash" },
			};
			const sel = resolveAiSelection(config, { provider: "anthropic" });
			expect(sel.provider).toBe("anthropic");
			expect(sel.model).not.toBe("gemini-3.5-flash");
			expect(sel.modelSource).toBe("default");
		});
	});

	it("honours both overrides together", () => {
		withEnv({}, () => {
			const config: GramConfig = { ai: { provider: "google" } };
			const sel = resolveAiSelection(config, {
				provider: "ollama",
				model: "mistral",
			});
			expect(sel).toMatchObject({
				provider: "ollama",
				model: "mistral",
				providerSource: "flag",
				modelSource: "flag",
			});
		});
	});

	it("keeps a configured model when no provider override contradicts it", () => {
		withEnv({}, () => {
			const config: GramConfig = {
				ai: { provider: "openai", model: "gpt-5.5" },
			};
			expect(resolveAiSelection(config)).toMatchObject({
				model: "gpt-5.5",
				modelSource: "config",
			});
		});
	});

	it("still applies a provider-less config model to the auto-detected provider", () => {
		withEnv({ GEMINI_API_KEY: "sk-google" }, () => {
			const config: GramConfig = { ai: { model: "gemini-3.1-pro" } };
			expect(resolveAiSelection(config)).toMatchObject({
				provider: "google",
				model: "gemini-3.1-pro",
				providerSource: "auto-detect",
				modelSource: "config",
			});
		});
	});
});

describe("loadAiModel — ai.apiKey does not follow a provider override", () => {
	afterEach(() => {
		for (const key of PROVIDER_ENV_VARS) delete process.env[key];
	});

	it("refuses an ai.apiKey written for another provider", () => {
		withEnv({}, () => {
			const config: GramConfig = {
				ai: { provider: "google", apiKey: "google-key" },
			};
			expect(() => loadAiModel(config, { provider: "anthropic" })).toThrow(
				GramCLIError,
			);
			expect(() => loadAiModel(config, { provider: "anthropic" })).toThrow(
				/ANTHROPIC_API_KEY/,
			);
		});
	});

	it("still uses ai.apiKey when the override names the same provider", () => {
		withEnv({}, () => {
			const config: GramConfig = {
				ai: { provider: "openai", apiKey: "sk-openai-explicit" },
			};
			expect(() =>
				loadAiModel(config, { provider: "openai", model: "gpt-5.5" }),
			).not.toThrow();
		});
	});
});

// The leak the two suites above cannot see, because it happens before
// `loadAiModel` is ever called: `defu` merges the global and project `ai:`
// blocks key by key, so a global apiKey survives a project that switches
// provider — and by then it *looks* like a key written for that provider.
describe("mergeConfigLayers — credentials do not cross config layers", () => {
	it("drops a global apiKey when the project selects a different provider", () => {
		const merged = mergeConfigLayers(
			{ ai: { provider: "openai" } },
			{ ai: { provider: "google", apiKey: "google-key" } },
		);
		expect(merged.ai).toEqual({ provider: "openai" });
	});

	it("drops a global model too — model names are provider-specific", () => {
		const merged = mergeConfigLayers(
			{ ai: { provider: "anthropic" } },
			{ ai: { provider: "google", model: "gemini-3.5-flash" } },
		);
		expect(merged.ai?.model).toBeUndefined();
	});

	it("still inherits global ai settings when both layers agree on the provider", () => {
		const merged = mergeConfigLayers(
			{ ai: { provider: "google" } },
			{ ai: { provider: "google", model: "gemini-3.1-pro" } },
		);
		expect(merged.ai).toMatchObject({
			provider: "google",
			model: "gemini-3.1-pro",
		});
	});

	it("still inherits the global ai block when the project names no provider", () => {
		const merged = mergeConfigLayers(
			{ language: "fr" },
			{ ai: { provider: "google", model: "gemini-3.1-pro" } },
		);
		expect(merged.ai).toMatchObject({ provider: "google" });
		expect(merged.language).toBe("fr");
	});

	it("leaves non-ai keys merging as before", () => {
		const merged = mergeConfigLayers(
			{ ai: { provider: "openai" }, language: "fr" },
			{ database: "~/global.yaml", language: "en" },
		);
		expect(merged.database).toBe("~/global.yaml");
		expect(merged.language).toBe("fr");
	});
});

describe("parseAiOverrides", () => {
	it("rejects an unknown --provider and names the valid ones", () => {
		expect(() => parseAiOverrides({ provider: "gemini" })).toThrow(
			/google, openai, anthropic, ollama/,
		);
	});

	it("passes a valid provider and model through", () => {
		expect(parseAiOverrides({ provider: "ollama", model: "llama3" })).toEqual({
			provider: "ollama",
			model: "llama3",
		});
	});

	it("returns no overrides when no flags were given", () => {
		expect(parseAiOverrides({})).toEqual({});
	});
});
