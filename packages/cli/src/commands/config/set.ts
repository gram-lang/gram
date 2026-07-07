import { defineCommand } from "citty";
import { log } from "@clack/prompts";
import chalk from "chalk";
import {
	getLocalConfigPath,
	getGlobalConfigPath,
	setConfigValue,
	isSensitiveKey,
} from "../../services/config-manager";
import { requireProjectRoot, findProjectRoot } from "../../core/workspace";
import { ExitCode, reportError } from "../../errors";

export default defineCommand({
	meta: { name: "set", description: "Set a configuration value" },
	args: {
		key: {
			type: "positional",
			required: true,
			description: "Config key in dot notation (e.g. ai.provider, database)",
		},
		value: {
			type: "positional",
			required: true,
			description: "Value to set",
		},
		global: {
			type: "boolean",
			description: "Write to global config (~/.config/gram/config.yaml)",
			default: false,
		},
	},
	async run({ args }) {
		const key = args.key as string;
		const value = args.value as string;
		const projectRoot = args.global
			? await findProjectRoot()
			: await requireProjectRoot();

		if (args.global && isSensitiveKey(key)) {
			log.error(
				`"${key}" is a sensitive value — it is always written to the project .env file, not global config.`,
			);
			process.exit(ExitCode.Error);
		}

		const configPath = args.global
			? getGlobalConfigPath()
			: getLocalConfigPath(projectRoot);

		try {
			const result = await setConfigValue(key, value, configPath, projectRoot);

			if (result.envVar) {
				log.success(`${result.envVar} written to ${chalk.dim(result.envFile)}`);
			} else {
				const scope = args.global ? "global" : "local";
				log.success(
					`${key} = ${chalk.green(value)}  ${chalk.dim(`(${scope} config)`)}`,
				);
			}
		} catch (err) {
			reportError(err);
			process.exit(ExitCode.Error);
		}
	},
});
