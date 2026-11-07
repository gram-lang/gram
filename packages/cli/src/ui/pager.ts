import { spawn } from "node:child_process";

/**
 * Writes `content` to the terminal, through `less -R` when it is longer than
 * most of the screen (and not piped, and not `noPager`). The colors in
 * `content` are kept.
 */
export async function outputPaged(
	content: string,
	noPager: boolean,
): Promise<void> {
	const lineCount = content.split("\n").length;
	const termRows = process.stdout.rows ?? 24;
	const usePager =
		!noPager && process.stdout.isTTY && lineCount > termRows * 0.85;

	if (!usePager) {
		process.stdout.write(content);
		return;
	}
	await new Promise<void>((resolve) => {
		const less = spawn("less", ["-R", "--quit-if-one-screen"], {
			stdio: ["pipe", "inherit", "inherit"],
		});
		less.on("error", () => {
			// less unavailable (Windows, minimal containers): write it directly.
			process.stdout.write(content);
			resolve();
		});
		less.stdin.write(content);
		less.stdin.end();
		less.on("close", resolve);
	});
}
