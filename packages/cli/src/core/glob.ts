import { globSync } from "tinyglobby";
import { resolve, extname } from "node:path";
import { GramCLIError, ExitCode } from "../errors";
import { findProjectRoot } from "./workspace";

/** Code-unit order, the same on every machine and locale. */
const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The files `patterns` name, in the order given: a glob's matches sorted by
 * path, a plain path where it stands; a file named twice is kept once, at
 * its first place.
 */
export async function resolveGlob(patterns: string[]): Promise<string[]> {
	const root = await findProjectRoot();
	const files: string[] = [];

	for (const pattern of patterns) {
		if (pattern.includes("*")) {
			let matches: string[] = [];
			try {
				// Sorted: the crawl follows the directory's own order, which
				// differs from one filesystem to another, and so would every
				// report listing the files.
				matches = globSync(pattern, { cwd: root, absolute: true })
					.filter((f) => extname(f) === ".gram")
					.sort(byPath);
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
