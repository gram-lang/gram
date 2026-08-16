import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { GramCLIError, ExitCode } from "../errors";
import type { AiProvider, GramConfig } from "../types";

export type { AiProvider };

// Single source of truth for provider -> credential env var (audit 2026-07-22,
// finding 0-a): `core/config.ts` used to pick "the first API key env var it
// found" independently of the configured provider, so `provider: openai` with
// only GEMINI_API_KEY set would send the Google key to api.openai.com. Every
// lookup — auto-detection and key resolution — must go through this one map,
// keyed by the *same* provider, never a cascade across different providers'
// keys. `services/config-manager.ts` and `commands/init.ts` import this
// instead of keeping their own copies.
export const AI_PROVIDER_ENV_VAR: Readonly<
	Record<Exclude<AiProvider, "ollama">, string>
> = {
	google: "GEMINI_API_KEY",
	openai: "OPENAI_API_KEY",
	anthropic: "ANTHROPIC_API_KEY",
};

// Human-readable provider names, for pickers and status lines. Kept next to
// AI_PROVIDER_ENV_VAR so a new provider gets its label in the same edit;
// `commands/init.ts` used to hardcode its own copy of this list.
export const AI_PROVIDER_LABEL: Readonly<Record<AiProvider, string>> = {
	google: "Google (Gemini)",
	openai: "OpenAI (ChatGPT)",
	anthropic: "Anthropic (Claude)",
	ollama: "Ollama (Local)",
};

// Priority order when no explicit `ai.provider` is configured. Unrelated to
// key resolution: whichever provider is picked here has its *own* env var
// read below, never another provider's.
const AUTO_DETECT_ORDER: readonly (keyof typeof AI_PROVIDER_ENV_VAR)[] = [
	"google",
	"openai",
	"anthropic",
];

const DEFAULTS: Record<AiProvider, string> = {
	google: "gemini-3.5-flash",
	openai: "gpt-4.1-nano",
	anthropic: "claude-haiku-4-5-20251001",
	ollama: "llama4",
};

// Suggested options for the model pickers — quality-first, unlike DEFAULTS
// above which is a cheap zero-config fallback. Single source of truth so a new
// model release only needs updating here, not duplicated in init.ts (and
// ideally not hand-copied into docs either — point readers at `gram init`
// instead of pinning versions in prose that will drift).
export const RECOMMENDED_MODELS: Record<AiProvider, readonly string[]> = {
	google: ["gemini-3.5-flash", "gemini-3.1-pro"],
	openai: ["gpt-5.4-mini", "gpt-5.5"],
	anthropic: ["claude-sonnet-4.6", "claude-haiku-4.5", "claude-fable-5"],
	ollama: ["llama4", "llama3"],
};

/** Where a resolved provider or model came from — shown to the user so an unexpected choice is traceable. */
export type AiSelectionSource =
	| "flag"
	| "config"
	| "default"
	| "auto-detect"
	| "picker";

export interface AiSelection {
	provider: AiProvider;
	model: string;
	providerSource: AiSelectionSource;
	modelSource: AiSelectionSource;
}

/** Per-run overrides, typically from `--provider` / `--model`. */
export interface AiOverrides {
	provider?: AiProvider;
	model?: string;
}

function noProviderError(): GramCLIError {
	return new GramCLIError(
		[
			"No AI provider configured.",
			"",
			"Export an environment variable (recommended — keeps keys out of version control):",
			"  GEMINI_API_KEY=...    (Google)",
			"  OPENAI_API_KEY=...    (OpenAI)",
			"  ANTHROPIC_API_KEY=... (Anthropic)",
			"",
			"Or set a provider in .gram/config.yaml:",
			"",
			"  ai:",
			"    provider: google   # google | openai | anthropic | ollama",
			"    model: gemini-3.5-flash",
			"",
			"Run `gram init` to configure an AI provider interactively, or pass",
			"`--provider`/`--model` for a single run.",
		].join("\n"),
		ExitCode.Error,
	);
}

/**
 * Do the settings written under `ai:` belong to the provider we are about to
 * call?
 *
 * `ai.apiKey`, `ai.model` and `ai.baseUrl` are all provider-specific: a key
 * issued by Google is worthless *and dangerous* at api.openai.com, and a model
 * name is meaningless outside its own provider.
 *
 * When `ai.provider` is set the test is simply equality. When it is *not*, the
 * `ai:` block still has an implied owner — whichever provider the config would
 * have reached on its own, i.e. the auto-detected one — and its settings apply
 * to that provider only.
 *
 * `--provider` and the picker are the cases that make this distinction matter:
 * both can name a provider the config never spoke for. An earlier version
 * returned true for any unprovidered config, reasoning that auto-detection
 * only picks a provider whose own env var is already set, so `ai.apiKey` could
 * never be reached. True for auto-detection, false the moment a flag can pick
 * the provider instead — `--provider anthropic` over
 * `ai: {apiKey: <google key>}` sent that key to api.anthropic.com. Same class
 * as audit 2026-07-22 finding 0-a.
 */
function configAppliesTo(
	ai: NonNullable<GramConfig["ai"]>,
	provider: AiProvider,
	providerSource: AiSelectionSource,
): boolean {
	if (ai.provider !== undefined) return ai.provider === provider;
	return providerSource === "auto-detect";
}

function resolveApiKey(
	provider: Exclude<AiProvider, "ollama">,
	ai: NonNullable<GramConfig["ai"]>,
	providerSource: AiSelectionSource,
): string {
	const envVar = AI_PROVIDER_ENV_VAR[provider];
	const configuredKey = configAppliesTo(ai, provider, providerSource)
		? ai.apiKey
		: undefined;
	const apiKey = process.env[envVar] ?? configuredKey;
	if (!apiKey) {
		throw new GramCLIError(
			`Missing ${envVar} or ai.apiKey in config for provider "${provider}".`,
			ExitCode.Error,
		);
	}
	return apiKey;
}

/**
 * Decide which provider and model this run will use, without constructing
 * anything. Split out from `loadAiModel` so the CLI can show the choice, and
 * let the user change it, using the exact values the call will be made with.
 *
 * Precedence: overrides (flags) -> `ai:` config -> per-provider default, with
 * env-var auto-detection standing in for a missing `ai.provider`.
 */
export function resolveAiSelection(
	config: GramConfig,
	overrides: AiOverrides = {},
): AiSelection {
	const ai = config.ai ?? {};

	let provider: AiProvider | undefined;
	let providerSource: AiSelectionSource;
	if (overrides.provider) {
		provider = overrides.provider;
		providerSource = "flag";
	} else if (ai.provider) {
		provider = ai.provider;
		providerSource = "config";
	} else {
		provider = AUTO_DETECT_ORDER.find(
			(p) => process.env[AI_PROVIDER_ENV_VAR[p]],
		);
		providerSource = "auto-detect";
	}

	if (!provider) throw noProviderError();

	// `ai.model` is only meaningful for the provider it was written under —
	// see configAppliesTo. `--provider anthropic` over `model: gemini-3.5-flash`
	// must fall back to the Anthropic default, not send a Gemini model name to
	// Anthropic.
	const configuredModel = configAppliesTo(ai, provider, providerSource)
		? ai.model
		: undefined;

	const model = overrides.model ?? configuredModel ?? DEFAULTS[provider];
	const modelSource: AiSelectionSource = overrides.model
		? "flag"
		: configuredModel
			? "config"
			: "default";

	return { provider, model, providerSource, modelSource };
}

/**
 * Build the SDK client for an already-resolved selection. Exported so an
 * interactive model change can be applied without re-running resolution (and
 * without the displayed choice drifting from the one actually called).
 */
export function buildAiModel(
	selection: AiSelection,
	config: GramConfig,
): LanguageModel {
	const ai = config.ai ?? {};
	const { provider, model, providerSource } = selection;

	switch (provider) {
		case "google":
			return createGoogleGenerativeAI({
				apiKey: resolveApiKey("google", ai, providerSource),
			})(model);

		case "openai":
			return createOpenAI({
				apiKey: resolveApiKey("openai", ai, providerSource),
			})(model);

		case "anthropic":
			return createAnthropic({
				apiKey: resolveApiKey("anthropic", ai, providerSource),
			})(model);

		case "ollama": {
			const baseURL =
				(configAppliesTo(ai, "ollama", providerSource)
					? ai.baseUrl
					: undefined) ??
				process.env.OLLAMA_BASE_URL ??
				"http://localhost:11434/v1";
			const ollama = createOpenAICompatible({
				name: "ollama",
				baseURL,
				apiKey: "ollama",
			});
			return ollama(model);
		}

		default:
			throw new GramCLIError(
				`Unknown AI provider "${provider}". Supported: ${Object.keys(AI_PROVIDER_LABEL).join(", ")}.`,
				ExitCode.Error,
			);
	}
}

export function loadAiModel(
	config: GramConfig,
	overrides: AiOverrides = {},
): { model: LanguageModel; selection: AiSelection } {
	const selection = resolveAiSelection(config, overrides);
	return { model: buildAiModel(selection, config), selection };
}
