import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { defu } from "defu";
import { z } from "zod";
import { GramConfigFileSchema, type GramConfig } from "../types";
import { GramConfigError } from "../errors";
import { findProjectRoot } from "./workspace";

async function readYaml(path: string): Promise<Partial<GramConfig>> {
	try {
		const content = await readFile(path, "utf-8");
		return parse(content) ?? {};
	} catch {
		return {};
	}
}

/**
 * Combine the project config with the global one, project winning.
 *
 * Pure and exported so the credential rule below can be tested without a home
 * directory or a project root.
 */
export function mergeConfigLayers(
	project: Partial<GramConfig>,
	global: Partial<GramConfig>,
): Partial<GramConfig> {
	const merged = defu(project, global);

	// `defu` merges `ai:` key by key, which is wrong for a block whose contents
	// are provider-specific: a global `ai: {provider: google, apiKey: <google
	// key>}` survives into a project declaring only `ai: {provider: openai}`,
	// and the Google key gets sent to api.openai.com. Same class of bug as audit
	// finding 0-a, one layer up. When the project names a provider that the
	// global config does not also name, the global `ai:` block — key, model and
	// baseUrl alike — contributes nothing.
	if (project.ai?.provider && global.ai?.provider !== project.ai.provider) {
		merged.ai = { ...project.ai };
	}

	return merged;
}

export async function loadConfig(): Promise<GramConfig> {
	const projectRoot = await findProjectRoot();
	const global = await readYaml(
		join(homedir(), ".config", "gram", "config.yaml"),
	);
	const project = await readYaml(join(projectRoot, ".gram", "config.yaml"));

	const result = GramConfigFileSchema.safeParse(
		mergeConfigLayers(project, global),
	);
	if (!result.success) {
		throw new GramConfigError(
			`Invalid configuration in .gram/config.yaml or ~/.config/gram/config.yaml:\n${z.prettifyError(result.error)}`,
		);
	}
	const config: GramConfig = result.data;

	// Provider + API key resolution both happen in loadAiModel(), which reads
	// each provider's own env var directly (audit 2026-07-22, finding 0-a).
	// This used to also stash "whichever key env var happened to be set" into
	// config.ai.apiKey here, independently of the provider — which meant a
	// GEMINI_API_KEY could get sent to OpenAI under `provider: openai`. Do not
	// reintroduce that: config.ai.apiKey must only ever hold a value the user
	// explicitly wrote for the provider they configured.

	config.projectRoot = projectRoot;

	return config;
}
