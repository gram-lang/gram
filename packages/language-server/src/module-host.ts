import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { ModuleHost } from "@gram-lang/modules";

// Matches `@/rest.gram` (bare root, alias = "") and `@alias/rest.gram" — the
// two `@`-prefixed forms `@gram-lang/modules`' own `validateSpecifier`
// accepts (module-imports RFC §B.1). Mirrors the CLI host's own regex
// exactly (`packages/cli/src/core/module-host.ts:9`).
const AT_SPECIFIER_RE = /^@([^/]*)\/(.+)$/;

function confine(
	resolved: string,
	projectRoot: string,
	specifier: string,
): string {
	const rel = relative(projectRoot, resolved);
	if (rel === "") return resolved;
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error(
			`"${specifier}" resolves outside the project root (${projectRoot}).`,
		);
	}
	return resolved;
}

/**
 * The narrow slice of `vscode-languageserver`'s `TextDocuments` this host
 * actually needs — `documents` in `server.ts` satisfies this structurally,
 * with no adapter required. Kept this narrow so tests can hand it a plain
 * `Map`-backed fake instead of constructing a real `TextDocuments`.
 */
export interface OpenDocumentSource {
	get(uri: string): { getText(): string } | undefined;
}

/**
 * The language server's `ModuleHost` (module-imports RFC §B.2): the same
 * resolve() arithmetic as `createCliModuleHost`
 * (`packages/cli/src/core/module-host.ts`), but every uri is a `file:` URL
 * — matching what `TextDocuments`/`DocumentState` already use everywhere
 * else in this server — instead of the CLI host's bare filesystem paths.
 * `read()` checks the live open-editor buffer before falling back to disk,
 * so an *unsaved* edit in a dependency is visible to whoever imports it —
 * the same thing `getFreshState` already guarantees for the document being
 * edited itself.
 */
export function createLspModuleHost(
	projectRoot: string,
	openDocs: OpenDocumentSource,
	paths?: Record<string, string>,
): ModuleHost {
	return {
		resolve(specifier: string, fromUri: string): string {
			const fromPath = fileURLToPath(fromUri);
			const atMatch = AT_SPECIFIER_RE.exec(specifier);
			if (atMatch) {
				const [, alias, rest] = atMatch;
				if (alias === "") {
					return pathToFileURL(
						confine(resolve(projectRoot, rest!), projectRoot, specifier),
					).toString();
				}
				const aliasDir = paths?.[alias!];
				if (aliasDir === undefined) {
					throw new Error(
						`"@${alias}/" is not declared. Add it to "paths:" in .gram/config.yaml (e.g. paths: { ${alias}: ./some/dir }).`,
					);
				}
				return pathToFileURL(
					confine(
						resolve(projectRoot, aliasDir, rest!),
						projectRoot,
						specifier,
					),
				).toString();
			}
			const resolved = resolve(dirname(fromPath), specifier);
			return pathToFileURL(
				confine(resolved, projectRoot, specifier),
			).toString();
		},
		read(uri: string): string {
			const open = openDocs.get(uri);
			if (open) return open.getText();
			return readFileSync(fileURLToPath(uri), "utf-8");
		},
	};
}
