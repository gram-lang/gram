import type { ModuleHost } from "../src/host";

/**
 * A minimal in-memory `ModuleHost` for unit tests: a flat `Map<uri, source>`
 * with POSIX-style relative path resolution, no real filesystem. `uri`s are
 * plain strings like `"/recipe.gram"` or `"/bases/pate.gram"` — always
 * absolute-looking so `resolve` has an unambiguous "directory of the
 * importer" to resolve against, without needing an actual project root.
 */
export function createFakeHost(files: Record<string, string>): ModuleHost {
	return {
		resolve(specifier: string, fromUri: string): string {
			const fromDir = fromUri.slice(0, fromUri.lastIndexOf("/")) || "/";
			const parts = `${fromDir}/${specifier}`.split("/");
			const stack: string[] = [];
			for (const part of parts) {
				if (part === "" || part === ".") continue;
				if (part === "..") stack.pop();
				else stack.push(part);
			}
			return `/${stack.join("/")}`;
		},
		read(uri: string): string {
			if (!(uri in files)) throw new Error(`ENOENT: ${uri}`);
			return files[uri]!;
		},
	};
}
