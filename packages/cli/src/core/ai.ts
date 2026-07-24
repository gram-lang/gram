import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { GramCLIError, ExitCode } from "../errors";
import type { GramConfig } from "../types";

export type AiProvider = "google" | "openai" | "anthropic" | "ollama";

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

function resolveApiKey(
	provider: Exclude<AiProvider, "ollama">,
	ai: NonNullable<GramConfig["ai"]>,
): string {
	const envVar = AI_PROVIDER_ENV_VAR[provider];
	const apiKey = process.env[envVar] ?? ai.apiKey;
	if (!apiKey) {
		throw new GramCLIError(
			`Missing ${envVar} or ai.apiKey in config.`,
			ExitCode.Error,
		);
	}
	return apiKey;
}

export function loadAiModel(config: GramConfig): LanguageModel {
	const ai = config.ai ?? {};

	// Determine provider: explicit config wins, then env-var detection.
	const provider: AiProvider | null =
		ai.provider ??
		AUTO_DETECT_ORDER.find((p) => process.env[AI_PROVIDER_ENV_VAR[p]]) ??
		null;

	const model = ai.model ?? (provider ? DEFAULTS[provider] : undefined);

	if (!provider || !model) {
		throw new GramCLIError(
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
				"Run `gram init` to configure an AI provider interactively.",
			].join("\n"),
			ExitCode.Error,
		);
	}

	switch (provider) {
		case "google":
			return createGoogleGenerativeAI({ apiKey: resolveApiKey("google", ai) })(
				model,
			);

		case "openai":
			return createOpenAI({ apiKey: resolveApiKey("openai", ai) })(model);

		case "anthropic":
			return createAnthropic({ apiKey: resolveApiKey("anthropic", ai) })(model);

		case "ollama": {
			const baseURL =
				ai.baseUrl ??
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
				`Unknown AI provider "${provider}". Supported: google, openai, anthropic, ollama.`,
				ExitCode.Error,
			);
	}
}
