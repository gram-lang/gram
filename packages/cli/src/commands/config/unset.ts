import { defineCommand } from "citty";
import { log } from "@clack/prompts";
import {
	getLocalConfigPath,
	getGlobalConfigPath,
	unsetConfigValue,
} from "../../services/config-manager";
import { requireProjectRoot, findProjectRoot } from "../../core/workspace";
import { ExitCode, reportError } from "../../errors";

export default defineCommand({
	meta: { name: "unset", description: "Remove a configuration value" },
	args: {
		key: {
			type: "positional",
			required: true,
			description: "Config key in dot notation (e.g. ai.provider, database)",
		},
		global: {
			type: "boolean",
			description: "Remove from global config (~/.config/gram/config.yaml)",
			default: false,
		},
	},
	async run({ args }) {
		const key = args.key as string;
		const projectRoot = args.global
			? await findProjectRoot()
			: await requireProjectRoot();
		const configPath = args.global
			? getGlobalConfigPath()
			: getLocalConfigPath(projectRoot);

		try {
			const removed = await unsetConfigValue(key, configPath, projectRoot);
			if (removed) {
				log.success(`Removed "${key}".`);
			} else {
				log.warn(`Key "${key}" was not set.`);
				process.exit(ExitCode.Error);
			}
		} catch (err) {
			reportError(err);
			process.exit(ExitCode.Error);
		}
	},
});
