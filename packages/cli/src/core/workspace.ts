import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { GramCLIError, ExitCode } from "../errors";

async function searchProjectRoot(start: string): Promise<string | null> {
	let dir = start;
	while (true) {
		try {
			await access(resolve(dir, ".gram"));
			return dir;
		} catch {}
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

export async function findProjectRoot(start = process.cwd()): Promise<string> {
	return (await searchProjectRoot(start)) ?? start;
}

export async function requireProjectRoot(
	start = process.cwd(),
): Promise<string> {
	const root = await searchProjectRoot(start);
	if (root === null) {
		throw new GramCLIError(
			"No gram project found in this directory or any parent. Run `gram init` to create one.",
			ExitCode.Error,
		);
	}
	return root;
}
