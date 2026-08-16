import type { AiOverrides } from "./ai";
import { AI_PROVIDERS, type AiProvider } from "../types";
import { GramCLIError, ExitCode } from "../errors";

/**
 * The AI flags shared by every command that calls a model. Spread into a
 * command's `args` (`args: { ...AI_ARGS, source: {…} }`) so citty lists them in
 * `--help` — the flags exist to be discovered, so registering them by peeking
 * at `process.argv` (as `--verbose` does in `index.ts`) would defeat the point.
 */
export const AI_ARGS = {
	model: {
		type: "string",
		description: "Override the AI model for this run",
	},
	provider: {
		type: "string",
		description: `Override the AI provider for this run (${AI_PROVIDERS.join(" | ")})`,
	},
	"pick-model": {
		type: "boolean",
		description: "Choose the provider and model interactively",
		default: false,
	},
} as const;

/** The shape `AI_ARGS` produces once citty has parsed it. */
export interface AiArgs {
	model?: string;
	provider?: string;
	"pick-model"?: boolean;
}

/**
 * Turn raw flag values into overrides, rejecting an unknown `--provider` with a
 * message that lists the valid ones. `--model` is deliberately *not* validated:
 * the set of valid model names is the provider's business, changes weekly, and
 * a typo already surfaces as a clear error from the provider's API.
 */
export function parseAiOverrides(args: AiArgs): AiOverrides {
	const overrides: AiOverrides = {};

	if (args.provider) {
		if (!(AI_PROVIDERS as readonly string[]).includes(args.provider)) {
			throw new GramCLIError(
				`Unknown --provider "${args.provider}". Supported: ${AI_PROVIDERS.join(", ")}.`,
				ExitCode.Error,
			);
		}
		overrides.provider = args.provider as AiProvider;
	}

	if (args.model) overrides.model = args.model;

	return overrides;
}
