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

/** Opens a file or an address in the default browser. */
export function openInBrowser(target: string): boolean {
	const cmds: Record<string, string[]> = {
		darwin: ["open", target],
		win32: ["cmd", "/c", "start", "", target],
		linux: ["xdg-open", target],
	};
	const [cmd, ...args] = cmds[process.platform] ?? ["xdg-open", target];
	try {
		const child = spawn(cmd!, args, { stdio: "ignore", detached: true });
		// A missing opener fails after the spawn, as an event: without a
		// listener it would end the process (the live preview's server too).
		child.on("error", () => {});
		child.unref();
		return true;
	} catch {
		return false;
	}
}
