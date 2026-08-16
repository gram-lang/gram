import chalk from "chalk";
import { log, select, text, isCancel } from "@clack/prompts";
import {
	AI_PROVIDER_LABEL,
	RECOMMENDED_MODELS,
	buildAiModel,
	resolveAiSelection,
	type AiProvider,
	type AiSelection,
} from "../core/ai";
import { type AiArgs, parseAiOverrides } from "../core/ai-args";
import { canPrompt } from "../core/interactive";
import { AI_PROVIDERS, type GramConfig } from "../types";
import { ExitCode, GramCLIError } from "../errors";
import type { LanguageModel } from "ai";
import type { Writable } from "node:stream";

/**
 * Why this provider and this model, when it isn't simply what the config says.
 * Returns null when there is nothing surprising to explain — an unannotated
 * status line then means "exactly what your config asked for".
 */
function describeProvenance(selection: AiSelection): string | null {
	if (selection.providerSource === "picker") return "picked interactively";

	const parts: string[] = [];
	if (selection.providerSource === "flag") parts.push("--provider");
	else if (selection.providerSource === "auto-detect")
		parts.push("provider auto-detected");
	if (selection.modelSource === "flag") parts.push("--model");
	else if (selection.modelSource === "default") parts.push("default model");
	return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Print which model is about to be called, before the spinner hides it. An
 * unexpected model — a stale `ai.model`, a global config, an env var picked up
 * by auto-detection — used to be invisible: the run just cost more, or came
 * back worse, with nothing on screen to say why.
 */
export function renderAiSelection(
	selection: AiSelection,
	output?: Writable,
): void {
	const provenance = describeProvenance(selection);
	log.step(
		`${chalk.dim("model")} ${selection.provider} ${chalk.dim("·")} ${chalk.bold(
			selection.model,
		)}${provenance ? chalk.dim(` (${provenance})`) : ""}`,
		{ output },
	);
}

/**
 * Interactive provider + model picker, shared by `gram init` and the
 * `--pick-model` flag. Returns null if the user cancels — callers decide
 * whether that aborts the whole command or just leaves the config alone.
 */
export async function pickAiModel(
	current?: AiSelection,
): Promise<{ provider: AiProvider; model: string } | null> {
	const provider = await select({
		message: "Select an AI provider:",
		options: AI_PROVIDERS.map((value) => ({
			value,
			label: AI_PROVIDER_LABEL[value],
		})),
		initialValue: current?.provider,
	});
	if (isCancel(provider)) return null;

	// Whatever is in use right now is worth offering even if it isn't on the
	// recommended list — re-picking the same provider shouldn't silently drop
	// the model the user already chose. It is listed as "current", not
	// "recommended": that badge belongs to the head of RECOMMENDED_MODELS.
	const recommended = RECOMMENDED_MODELS[provider];
	const inUse =
		current?.provider === provider && !recommended.includes(current.model)
			? current.model
			: null;

	const picked = await select({
		message: "Select a model:",
		options: [
			...(inUse ? [{ value: inUse, label: `${inUse} (current)` }] : []),
			...recommended.map((value, i) => ({
				value,
				label: i === 0 ? `${value} (Recommended)` : value,
			})),
			{ value: "other", label: "Other (Manual entry)" },
		],
		initialValue: current?.provider === provider ? current.model : undefined,
	});
	if (isCancel(picked)) return null;

	if (picked !== "other") return { provider, model: picked };

	const manual = await text({
		message: "Enter model name:",
		placeholder: RECOMMENDED_MODELS[provider][0],
	});
	if (isCancel(manual) || !manual) return null;
	return { provider, model: manual };
}

function fail(message: string, exitCode: number = ExitCode.Error): never {
	log.error(message);
	process.exit(exitCode);
}

/**
 * The whole "which model am I calling?" step for an AI-backed command: flag
 * validation, resolution, the interactive picker, the status line, and turning
 * failures into a clean exit. Every AI command calls exactly this, so the
 * behaviour can't drift between `import`, `db enrich` and `db lint`.
 */
export async function resolveAiForCommand(
	config: GramConfig,
	args: AiArgs,
	/** Where the status line goes. Pass stderr when the command's real output is stdout. */
	output?: Writable,
	/**
	 * Checked against the resolved selection before the client is built —
	 * i.e. before a missing API key would otherwise be the first thing to fail.
	 * For constraints on *which provider* is acceptable, not on credentials:
	 * `gram import` uses this to reject a video source on a non-Google
	 * provider, so that error explains itself instead of surfacing as
	 * "Missing ANTHROPIC_API_KEY" on a run that could never have succeeded
	 * with any key. Call `process.exit` (or throw) to reject.
	 */
	validate?: (selection: AiSelection) => void,
): Promise<{ model: LanguageModel; selection: AiSelection }> {
	let overrides: ReturnType<typeof parseAiOverrides>;
	try {
		overrides = parseAiOverrides(args);
	} catch (err) {
		if (err instanceof GramCLIError) fail(err.message, err.exitCode);
		throw err;
	}

	// Resolution can legitimately fail (nothing configured at all). Hold the
	// error rather than throwing: with a terminal in front of us, the picker is
	// a better answer than a fifteen-line "here is how to configure me".
	let selection: AiSelection | undefined;
	let resolveError: GramCLIError | undefined;
	try {
		selection = resolveAiSelection(config, overrides);
	} catch (err) {
		if (!(err instanceof GramCLIError)) throw err;
		resolveError = err;
	}

	const wantsPicker = args["pick-model"] === true;

	if (wantsPicker && !canPrompt()) {
		fail(
			"--pick-model needs an interactive terminal. Pass --provider/--model instead.",
		);
	}

	if (wantsPicker || (!selection && canPrompt())) {
		if (!selection) log.warn("No AI provider configured yet.");
		const picked = await pickAiModel(selection);
		if (!picked) fail("Canceled — no model selected.", ExitCode.Ok);
		selection = {
			provider: picked.provider,
			model: picked.model,
			providerSource: "picker",
			modelSource: "picker",
		};
	}

	if (!selection) fail(resolveError?.message ?? "No AI provider configured.");

	renderAiSelection(selection, output);
	validate?.(selection);

	try {
		return { model: buildAiModel(selection, config), selection };
	} catch (err) {
		if (err instanceof GramCLIError) fail(err.message, err.exitCode);
		throw err;
	}
}
