import { readdirSync, type Dirent } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { type CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { getAST } from "@gram-lang/parser";
import { computeExports, type ModuleHost } from "@gram-lang/modules";
import { findProjectRootSync } from "../utils/project-root";
import { readProjectConfigSync } from "../utils/project-config";

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
	const { paths } = readProjectConfigSync(projectRoot);

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

const USE_BINDINGS_RE = /^\s*@use\s+"([^"]+)"\s+as\s+(.*)$/;
const AS_RE = /\sas(\s|$)/;

/** Where the cursor sits among the bindings of an `@use "..." as ...` line. */
export type UseBindingSlot =
	/** `as &|`: the unbraced form, which binds the module's default export. */
	| { specifier: string; kind: "default" }
	/** `as { &a, &|`: a named export, `written` the ones already listed. */
	| { specifier: string; kind: "named"; written: string[] };

/**
 * The binding being typed on an `@use` line, read from the live line prefix
 * like `matchUseSpecifierPrefix`: the line does not parse until its binding
 * is complete, so the AST knows nothing of it yet. `null` once the cursor
 * is on a local name (`&x as &|`), which is the author's to choose.
 */
export function matchUseBindingPrefix(prefix: string): UseBindingSlot | null {
	const lineStart = prefix.lastIndexOf("\n") + 1;
	const match = USE_BINDINGS_RE.exec(prefix.slice(lineStart));
	if (!match) return null;
	const specifier = match[1]!;
	const rest = match[2]!;
	if (/^&[^\s{},&]*$/.test(rest)) return { specifier, kind: "default" };
	if (!rest.startsWith("{")) return null;
	const inner = rest.slice(1);
	// Closed, unless the `}` is a multi-word name's own `{}`.
	if (inner.replace(/\{\}/g, "").includes("}")) return null;
	const segments = inner.split(",");
	const current = segments.pop()!.trimStart();
	if (!/^&[^,&]*$/.test(current) || AS_RE.test(current)) return null;
	const written = segments.flatMap((segment) => {
		const name = /^&(.+?)(?:\{\})?(?:\s+as\s+&.*)?$/.exec(segment.trim());
		return name ? [name[1]!.trim()] : [];
	});
	return { specifier, kind: "named", written };
}

/**
 * The exports `slot` can bind, read from the module itself through `host`
 * (the open buffer, else the disk) with `computeExports`, the function the
 * composer resolves the same binding with. Not from `state.moduleGraph`:
 * while the line is being typed, the document does not parse and its graph
 * is stale or absent. A multi-word name is inserted with its empty braces
 * (`&creme fouettee{}`), which a binding always keeps empty.
 */
export function provideImportExportCompletions(
	slot: UseBindingSlot,
	uri: string,
	host: ModuleHost | undefined,
): CompletionItem[] {
	if (!host) return [];
	let exported: ReturnType<typeof computeExports>;
	try {
		const source = host.read(host.resolve(slot.specifier, uri));
		if (typeof source !== "string") return [];
		exported = computeExports(getAST(source));
	} catch {
		return [];
	}
	const { sections, exports } = exported;
	const item = (name: string, sectionIndex: number): CompletionItem => {
		const title = sections[sectionIndex]?.title;
		return {
			label: name,
			kind: CompletionItemKind.Module,
			...(title ? { detail: `## ${title}` } : {}),
			insertText: name.includes(" ") ? `${name}{}` : name,
		};
	};
	if (slot.kind === "default") {
		const info = exports.get("default");
		// A default section with no `->&` of its own has no name to offer.
		if (!info || info.name === "default") return [];
		return [item(info.name, info.sectionIndex)];
	}
	const written = new Set(slot.written);
	return [...exports]
		.filter(([key]) => key !== "default" && !written.has(key))
		.map(([key, info]) => item(key, info.sectionIndex));
}
