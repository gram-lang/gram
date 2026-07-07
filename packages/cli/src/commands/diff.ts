import { defineCommand } from "citty";
import { log, spinner } from "@clack/prompts";
import { version } from "../../package.json";
import { computeDiff } from "../services/differ";
import { renderDiffResult } from "../ui/diff";
import { ExitCode, GramCLIError, reportError } from "../errors";

export default defineCommand({
	meta: {
		name: "diff",
		version,
		description: "Show a semantic diff of a recipe between two versions",
	},
	args: {
		file: {
			type: "positional",
			required: true,
			description:
				"Recipe file to diff (working tree vs git ref, or first of two explicit files)",
		},
		second: {
			type: "positional",
			required: false,
			description: "Second recipe file for an explicit two-file diff",
		},
		ref: {
			type: "string",
			description:
				"Git ref to compare against (default: HEAD). e.g. HEAD~2, v1.0, main",
		},
	},
	async run({ args }) {
		if (args.second && args.ref) {
			log.error(
				"--ref is only valid when diffing against git history. Omit it when passing two explicit files.",
			);
			process.exit(ExitCode.Error);
		}

		const s = spinner();
		s.start("Computing diff…");

		let result;
		try {
			result = await computeDiff({
				fileA: args.file as string,
				fileB: args.second as string | undefined,
				ref: args.ref as string | undefined,
			});
			s.stop("Done.");
		} catch (err) {
			s.stop("Failed.");
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			reportError(err);
			process.exit(ExitCode.Error);
		}

		renderDiffResult(result.result, result.label);
	},
});
