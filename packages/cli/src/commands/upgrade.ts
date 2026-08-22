import { defineCommand } from "citty";
import { log, spinner, note, confirm, isCancel, cancel } from "@clack/prompts";
import { spawn } from "node:child_process";
import { version } from "../../package.json";
import { fetchLatestVersion, isNewerVersion } from "../services/update-checker";
import { ExitCode, GramCLIError, getErrorMessage } from "../errors";

const INSTALL_ARGS = ["install", "-g", "@gram-lang/cli@latest"];

function runNpmInstall(): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn("npm", INSTALL_ARGS, { stdio: "inherit" });
		child.on("error", (err: NodeJS.ErrnoException) => {
			if (err.code === "ENOENT")
				reject(new Error('"npm" is not available in PATH'));
			else reject(err);
		});
		child.on("close", (code) => {
			if (code === 0) resolve();
			else
				reject(
					new Error(`npm ${INSTALL_ARGS.join(" ")} exited with code ${code}`),
				);
		});
	});
}

export default defineCommand({
	meta: {
		name: "upgrade",
		version,
		description: "Check for and install the latest gram version",
	},
	async run() {
		const s = spinner();
		s.start("Checking for updates…");
		let latest: string;
		try {
			latest = await fetchLatestVersion();
		} catch (err) {
			s.stop("Could not check for updates.");
			throw new GramCLIError(
				`Could not check for updates: ${getErrorMessage(err)}`,
				ExitCode.Error,
			);
		}
		s.stop(`Latest version: ${latest}`);

		if (!isNewerVersion(latest, version)) {
			log.success(`gram is already up to date (v${version}).`);
			return;
		}

		note(
			`Update available: ${version} → ${latest}\nRun: npm ${INSTALL_ARGS.join(" ")}`,
			"gram update available",
		);

		const proceed = await confirm({
			message: `Install @gram-lang/cli@${latest} now?`,
			initialValue: true,
		});
		if (isCancel(proceed) || !proceed) {
			cancel("Upgrade cancelled.");
			return;
		}

		try {
			await runNpmInstall();
		} catch (err) {
			throw new GramCLIError(
				`Failed to install the update: ${getErrorMessage(err)}`,
				ExitCode.Error,
			);
		}
		log.success(`Installed gram v${latest}.`);
	},
});
