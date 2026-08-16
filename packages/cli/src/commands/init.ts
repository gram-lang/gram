import { defineCommand } from "citty";
import {
	intro,
	outro,
	confirm,
	isCancel,
	cancel,
	note,
	select,
	text,
} from "@clack/prompts";
import {
	mkdir,
	writeFile,
	access,
	appendFile,
	readFile,
} from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import type { GramConfig } from "../types";
import { ExitCode } from "../errors";
import { upsertEnvVar } from "../services/config-manager";
import { AI_PROVIDER_ENV_VAR } from "../core/ai";
import { pickAiModel } from "../ui/ai-model";

const DB_TEMPLATE = `# Gram ingredient database
# Keys are slugs matching @ingredient names used in your .gram recipes.
# Full schema reference: packages/analyzer/tests/fixtures/ingredients.yaml
#
# ingredients:
#   butter:
#     name: Butter
#     aliases: [unsalted butter, sweet cream butter]
#     tags: [dairy, fat]
#     physical:
#       density: 0.91
#       yield: 1.0
#     nutrition:
#       calories: 717
#       protein: 0.9
#       carbs: 0.1
#       fat: 81
#       sat_fat: 51.4
#       mono_fat: 21.0
#       poly_fat: 3.0
#       sodium: 0.011
#       fiber: 0.0
#       sugar: 0.1
`;

function guardCancel<T>(value: T | symbol): T {
	if (isCancel(value)) {
		cancel("Initialization canceled.");
		process.exit(ExitCode.Ok);
	}
	return value as T;
}

export default defineCommand({
	meta: {
		name: "init",
		description: "Initialize a Gram project in the current directory",
	},
	async run() {
		intro("gram init");

		const gramDir = join(process.cwd(), ".gram");
		const configPath = join(gramDir, "config.yaml");

		let alreadyExists = false;
		try {
			await access(configPath);
			alreadyExists = true;
		} catch {}

		if (alreadyExists) {
			const proceed = guardCancel(
				await confirm({
					message: ".gram/config.yaml already exists. Overwrite?",
					initialValue: false,
				}),
			);
			if (!proceed) {
				cancel("Nothing changed.");
				process.exit(ExitCode.Ok);
			}
		}

		const createDb = guardCancel(
			await confirm({
				message: "Create an ingredient database template?",
				initialValue: true,
			}),
		);

		const config: GramConfig = {
			...(createDb && { database: ".gram/ingredients.yaml" }),
		};

		const language = guardCancel(
			await select({
				message: "What is the primary language of your recipes?",
				options: [
					{ value: "en", label: "English (en)" },
					{ value: "fr", label: "Français (fr)" },
				],
			}),
		) as string;

		config.language = language;

		const configureAi = guardCancel(
			await confirm({
				message:
					"Configure an AI provider now? (Required to import recipes and auto-enrich ingredients)",
				initialValue: true,
			}),
		);

		if (configureAi) {
			// Same picker as `--pick-model` on the AI commands — one list of
			// providers, one list of recommended models, one place to update.
			const picked = await pickAiModel();
			if (!picked) {
				cancel("Initialization canceled.");
				process.exit(ExitCode.Ok);
			}
			const { provider, model } = picked;

			config.ai = { provider, model };

			if (provider !== "ollama") {
				const saveKey = guardCancel(
					await confirm({
						message: "Save API key in .env file now?",
						initialValue: true,
					}),
				);
				if (saveKey) {
					const apiKey = guardCancel(
						await text({ message: "Enter your API key:" }),
					);
					if (apiKey) {
						const envPath = join(process.cwd(), ".env");
						const envKey =
							AI_PROVIDER_ENV_VAR[
								provider as "google" | "openai" | "anthropic"
							];
						await upsertEnvVar(envPath, envKey, apiKey);

						// Ensure root .gitignore covers .env — checked line-by-line rather than a
						// substring search, which would be fooled by an unrelated comment mentioning
						// ".env" or, worse, miss a `!.env` negation pattern that un-ignores it.
						const rootGitignore = join(process.cwd(), ".gitignore");
						const existing = await readFile(rootGitignore, "utf-8").catch(
							() => "",
						);
						const lines = existing.split("\n").map((l) => l.trim());
						const isEnvIgnored = lines.some(
							(l) => l === ".env" || l === ".env*" || l === "*.env",
						);
						const hasNegation = lines.some(
							(l) => l === "!.env" || l === "!.env*" || l === "!*.env",
						);
						if (!isEnvIgnored || hasNegation) {
							await appendFile(
								rootGitignore,
								"\n# API keys\n.env\n.env.*\n",
							).catch(() => {
								note(
									'Add ".env" to your root .gitignore to avoid committing your API key.',
									"⚠ Security",
								);
							});
						}
					}
				}
			}
		}

		await mkdir(gramDir, { recursive: true });
		await writeFile(configPath, stringify(config));

		if (createDb) {
			const dbPath = join(gramDir, "ingredients.yaml");
			let dbExists = false;
			try {
				await access(dbPath);
				dbExists = true;
			} catch {}

			if (!dbExists) {
				await writeFile(dbPath, DB_TEMPLATE);
			}
		}

		const gitignorePath = join(gramDir, ".gitignore");
		let gitignoreExists = false;
		try {
			await access(gitignorePath);
			gitignoreExists = true;
		} catch {}
		if (!gitignoreExists) {
			await writeFile(
				gitignorePath,
				"# Prevent committing sensitive API keys if used in config\n*.key\n.env*\n",
			);
		}

		const nextSteps = [
			"Edit .gram/config.yaml to adjust your project settings.",
			createDb ? "Fill .gram/ingredients.yaml with your ingredient data." : "",
			"Run gram check <file> to validate a recipe.",
		]
			.filter(Boolean)
			.join("\n");

		note(nextSteps, "Next steps");
		outro("Done!");
	},
});
