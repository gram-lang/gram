import { readdirSync, type Dirent } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { type CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { findProjectRootSync } from "../utils/project-root";
import { readPathsConfigSync } from "../utils/module-paths-config";

const USE_SPECIFIER_RE = /^\s*@use\s+"([^"]*)$/;

/**
 * True (with the specifier text typed so far) when the cursor sits inside
 * an `@use "..."` string, before its closing quote — same "check the live
 * line prefix" style as `isAfterAt`/`isInsideBraces`
 * (`completions-ingredients.ts`/`completions-units.ts`), not an AST walk,
 * since the cursor can be mid-token on a line the debounced `state.ast`
 * doesn't reflect yet.
 */
export function matchUseSpecifierPrefix(prefix: string): string | null {
	const lineStart = prefix.lastIndexOf("\n") + 1;
	const match = USE_SPECIFIER_RE.exec(prefix.slice(lineStart));
	return match ? match[1]! : null;
}

function listGramEntries(dir: string): CompletionItem[] {
	let entries: Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const items: CompletionItem[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		if (entry.isDirectory()) {
			items.push({ label: `${entry.name}/`, kind: CompletionItemKind.Folder });
		} else if (entry.isFile() && entry.name.endsWith(".gram")) {
			items.push({ label: entry.name, kind: CompletionItemKind.File });
		}
	}
	return items;
}

/**
 * Path completion for `@use "..."` (module-imports RFC §F.1): with nothing
 * typed yet, offers the available starting points (`./`, `../`, `@/`, every
 * `paths:` alias); once the partial specifier commits to one of those, lists
 * the `.gram` files and subdirectories actually there. Only the *label*
 * (the current directory's own entry name) is returned, not the whole
 * accumulated path — relying on the client's own default word-boundary
 * replacement at the cursor (`/` and `.` break a "word" in every mainstream
 * editor), the same way `&`/`@` completions elsewhere in this file already
 * rely on it, rather than computing an explicit `textEdit` range.
 */
export function provideImportPathCompletions(
	partial: string,
	uri: string,
): CompletionItem[] {
	if (!uri.startsWith("file:")) return [];
	const fromDir = dirname(fileURLToPath(uri));
	const projectRoot = findProjectRootSync(fromDir);
	const paths = readPathsConfigSync(projectRoot);

	if (partial.startsWith("./") || partial.startsWith("../")) {
		const dirPart = partial.slice(0, partial.lastIndexOf("/") + 1);
		return listGramEntries(resolve(fromDir, dirPart));
	}

	if (partial.startsWith("@")) {
		const slashIdx = partial.indexOf("/");
		if (slashIdx === -1) {
			const items: CompletionItem[] = [
				{
					label: "/",
					kind: CompletionItemKind.Folder,
					detail: "project root",
				},
			];
			for (const alias of Object.keys(paths ?? {})) {
				items.push({ label: `${alias}/`, kind: CompletionItemKind.Folder });
			}
			return items;
		}
		const alias = partial.slice(1, slashIdx);
		const rest = partial.slice(slashIdx + 1);
		const dirPart = rest.slice(0, rest.lastIndexOf("/") + 1);
		const base = alias === "" ? "." : paths?.[alias];
		if (base === undefined) return [];
		return listGramEntries(resolve(projectRoot, base, dirPart));
	}

	const items: CompletionItem[] = [
		{ label: "./", kind: CompletionItemKind.Folder },
		{ label: "../", kind: CompletionItemKind.Folder },
		{ label: "@/", kind: CompletionItemKind.Folder, detail: "project root" },
	];
	for (const alias of Object.keys(paths ?? {})) {
		items.push({ label: `@${alias}/`, kind: CompletionItemKind.Folder });
	}
	return items;
}
