/**
 * `ADD_TO_INGREDIENTS_DB`: the fix of `UNKNOWN_INGREDIENT` that adds an entry
 * for the ingredient to the project's ingredient database, as a skeleton to
 * fill in. Written as text into the file's own layout (with or without the
 * `ingredients:` wrapper `loadIngredientDB` accepts), never parsed and
 * rewritten, so the file's comments and order stay as they are.
 */
import { slugify } from "@gram-lang/kitchen";
import type { LintFix } from "./types";

/**
 * The ingredient database file a fix may add an entry to, as the caller
 * found it (`database:` of `.gram/config.yaml`, else `.gram/ingredients.yaml`)
 * and with its current text (an open editor buffer wins over the disk).
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */
export interface LintIngredientsFile {
	uri: string;
	text: string;
}

const PLAIN_KEY = /^[\p{Ll}\p{Lo}\p{N}][\p{Ll}\p{Lo}\p{N}_-]*$/u;

/** The line break `text` writes, read from its first one. */
function lineBreakOf(text: string): string {
	const nl = text.indexOf("\n");
	return nl > 0 && text[nl - 1] === "\r" ? "\r\n" : "\n";
}

interface Line {
	start: number;
	/** Past its line break. */
	next: number;
	content: string;
}

function linesOf(text: string): Line[] {
	const lines: Line[] = [];
	let start = 0;
	while (start < text.length) {
		const nl = text.indexOf("\n", start);
		const next = nl === -1 ? text.length : nl + 1;
		lines.push({
			start,
			next,
			content: text
				.slice(start, nl === -1 ? text.length : nl)
				.replace(/\r$/, ""),
		});
		start = next;
	}
	return lines;
}

/**
 * Where a new entry goes and how deep it is indented: at the end of the
 * `ingredients:` block when the file has one, else at the end of the file.
 * Null for a layout this does not write into (`ingredients: {}` inline).
 */
function insertionPoint(
	lines: Line[],
	length: number,
): { at: number; indent: string } | null {
	const head = lines.findIndex((l) => /^ingredients:/.test(l.content));
	if (head === -1) return { at: length, indent: "" };
	if (!/^ingredients:[ \t]*(#.*)?$/.test(lines[head]!.content)) return null;
	let end = head + 1;
	let indent = "";
	let lastFilled = head;
	for (; end < lines.length; end++) {
		const content = lines[end]!.content;
		if (content.trim() === "") continue;
		if (/^\S/.test(content) && !content.startsWith("#")) break;
		lastFilled = end;
		if (!indent && !content.trimStart().startsWith("#")) {
			indent = /^[ \t]*/.exec(content)![0];
		}
	}
	return {
		at: lines[lastFilled]!.next,
		indent: indent || "  ",
	};
}

/**
 * Whether the database already has an entry for `name` at this depth: an
 * edit of the file the loaded database has not caught up with yet.
 */
function hasEntry(lines: Line[], name: string, indent: string): boolean {
	const slug = slugify(name);
	return lines.some((l) => {
		if (!l.content.startsWith(indent)) return false;
		const m = /^(?:"([^"]*)"|'([^']*)'|([^\s:#"'][^:#]*?))[ \t]*:/.exec(
			l.content.slice(indent.length),
		);
		const key = m ? (m[1] ?? m[2] ?? m[3])! : null;
		return key !== null && (key === name || slugify(key) === slug);
	});
}

/**
 * The fix that adds `name` to the database, or null when it cannot (the key
 * is already there, the layout is not one it writes into). Never preferred:
 * the entry is a skeleton the author still has to fill in.
 */
export function addToIngredientsFix(
	name: string,
	file: LintIngredientsFile,
): LintFix | null {
	const slug = slugify(name);
	const key = slug && PLAIN_KEY.test(slug) ? slug : JSON.stringify(name);
	const lines = linesOf(file.text);
	const point = insertionPoint(lines, file.text.length);
	if (!point) return null;
	if (hasEntry(lines, name, point.indent)) return null;

	const eol = lineBreakOf(file.text);
	const i = point.indent;
	const entry = [
		`${i}${key}:`,
		`${i}  name: ${JSON.stringify(name)}`,
		`${i}  # aliases: []`,
		`${i}  # category: ""`,
		`${i}  # tags: []            # allergens and diets, e.g. ["gluten", "vegan"]`,
		`${i}  # physical:`,
		`${i}  #   density: 1.0      # g/mL`,
		`${i}  #   unit_weight: 100  # g per piece`,
		`${i}  # nutrition:          # per 100 g`,
		`${i}  #   calories: 0`,
		`${i}  #   protein: 0`,
		`${i}  #   carbs: 0`,
		`${i}  #   fat: 0`,
	].join(eol);

	const before = file.text.slice(0, point.at);
	const prefix =
		before.trim() === "" || /\n[ \t]*\r?\n$/.test(before)
			? ""
			: before.endsWith("\n")
				? eol
				: `${eol}${eol}`;
	const basename = file.uri.slice(file.uri.lastIndexOf("/") + 1);
	return {
		title: `Add '${name}' to ${basename || "the ingredient database"}`,
		edits: [
			{
				kind: "patch",
				uri: file.uri,
				patches: [
					{
						start: point.at,
						end: point.at,
						replacement: `${prefix}${entry}${eol}`,
					},
				],
			},
		],
	};
}
