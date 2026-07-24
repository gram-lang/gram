import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { defu } from "defu";
import { z } from "zod";
import { GramConfigFileSchema, type GramConfig } from "../types";
import { GramConfigError } from "../errors";
import { findProjectRoot } from "./workspace";

export { findProjectRoot };

async function readYaml(path: string): Promise<Partial<GramConfig>> {
	try {
		const content = await readFile(path, "utf-8");
		return parse(content) ?? {};
	} catch {
		return {};
	}
}

export async function loadConfig(): Promise<GramConfig> {
	const projectRoot = await findProjectRoot();
	const global = await readYaml(
		join(homedir(), ".config", "gram", "config.yaml"),
	);
	const project = await readYaml(join(projectRoot, ".gram", "config.yaml"));

	// Project config takes priority over global defaults
	const merged = defu(project, global);

	const result = GramConfigFileSchema.safeParse(merged);
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
