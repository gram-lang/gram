import { globSync } from "tinyglobby";
import { resolve, extname } from "node:path";
import { GramCLIError, ExitCode } from "../errors";
import { findProjectRoot } from "./workspace";

export async function resolveGlob(patterns: string[]): Promise<string[]> {
	const root = await findProjectRoot();
	const files: string[] = [];

	for (const pattern of patterns) {
		if (pattern.includes("*")) {
			let matches: string[] = [];
			try {
				matches = globSync(pattern, { cwd: root, absolute: true }).filter(
					(f) => extname(f) === ".gram",
				);
			} catch (err) {
				const code = (err as NodeJS.ErrnoException).code;
				if (code !== "ENOENT" && code !== "EACCES" && code !== "ENOTDIR")
					throw err;
				// Non-existent or inaccessible directory — treat as no matches
			}
			files.push(...matches);
		} else {
			files.push(resolve(pattern));
		}
	}

	if (files.length === 0) {
		throw new GramCLIError(
			`No .gram files found for: ${patterns.join(", ")}`,
			ExitCode.Error,
		);
	}

	return [...new Set(files)];
}
