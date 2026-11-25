import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { IngredientData } from "@gram-lang/analyzer";
import { type ExportOptions, exportRecipe } from "./exporter";

export async function generatePrintHTML(
	filePath: string,
	db: Record<string, IngredientData> | null,
	scaleFactor?: number,
	rendererOptions?: ExportOptions,
): Promise<string> {
	const html = await exportRecipe(
		filePath,
		"print",
		db,
		scaleFactor,
		rendererOptions,
	);
	const outPath = join(tmpdir(), `gram_print_${Date.now()}.html`);
	await writeFile(outPath, html, "utf-8");
	return outPath;
}

/**
 * Opens a file or an address in the default browser. Resolves to whether the
 * opener could be started: a missing one (no `xdg-open`) fails after the
 * spawn, as an event, which would otherwise end the process.
 */
export function openInBrowser(
	target: string,
	platform: NodeJS.Platform = process.platform,
): Promise<boolean> {
	const cmds: Partial<Record<NodeJS.Platform, string[]>> = {
		darwin: ["open", target],
		win32: ["cmd", "/c", "start", "", target],
		linux: ["xdg-open", target],
	};
	const [cmd, ...args] = cmds[platform] ?? ["xdg-open", target];
	return new Promise((resolve) => {
		try {
			const child = spawn(cmd!, args, { stdio: "ignore", detached: true });
			child.once("error", () => resolve(false));
			child.once("spawn", () => {
				child.unref();
				resolve(true);
			});
		} catch {
			resolve(false);
		}
	});
}
