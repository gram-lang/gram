/**
 * Where the frontmatter's keys are written, read from the text. The AST
 * keeps the frontmatter as a plain `meta` object, with no position, and has
 * none at all while the block is being typed (no closing `---` yet) or once a
 * line the grammar does not take (`# …`, an indented line) has emptied it: the
 * completion, the hover and the deprecated key's diagnostic read the text
 * instead, and tolerate those lines without taking them for keys.
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */

/** One `key: value` line of the frontmatter. Offsets in UTF-16 code units. */
export interface FrontmatterKeyLine {
	key: string;
	/** 0-based line of the key. */
	line: number;
	/** Where the key's name is written. */
	start: number;
	end: number;
	/** The whole line, its line break included (where the text has one). */
	lineStart: number;
	lineEnd: number;
}

export interface FrontmatterBlock {
	/** The key lines, in the order written. */
	keys: FrontmatterKeyLine[];
	/**
	 * The line that ends the block: its closing `---` when `closed`, or the
	 * first line that cannot belong to a frontmatter (or one past the last
	 * line of the text).
	 */
	endLine: number;
	closed: boolean;
}

const KEY_LINE = /^([\p{L}\p{N}_-]+):/u;

/** A line a frontmatter being written can hold: a key, a blank, a `# …` or an indented line. */
function looksLikeFrontmatter(line: string): boolean {
	return (
		line.trim() === "" ||
		KEY_LINE.test(line) ||
		line.startsWith("#") ||
		/^[ \t]/.test(line)
	);
}

/**
 * The frontmatter of `text`, or null when the text does not open one (`---`
 * on its first line, after an optional byte order mark).
 */
export function scanFrontmatter(text: string): FrontmatterBlock | null {
	const bom = text.charCodeAt(0) === 0xfeff ? 1 : 0;
	const keys: FrontmatterKeyLine[] = [];
	let offset = bom;
	let line = 0;
	while (offset <= text.length) {
		const nl = text.indexOf("\n", offset);
		const next = nl === -1 ? text.length : nl + 1;
		const content = text
			.slice(offset, nl === -1 ? text.length : nl)
			.replace(/\r$/, "");
		if (line === 0) {
			if (content !== "---") return null;
		} else if (content === "---") {
			return { keys, endLine: line, closed: true };
		} else if (!looksLikeFrontmatter(content)) {
			return { keys, endLine: line, closed: false };
		} else {
			const key = KEY_LINE.exec(content)?.[1];
			if (key !== undefined) {
				keys.push({
					key,
					line,
					start: offset,
					end: offset + key.length,
					lineStart: offset,
					lineEnd: next,
				});
			}
		}
		if (nl === -1) break;
		offset = next;
		line++;
	}
	return { keys, endLine: line + 1, closed: false };
}

/** True when `line` lies inside the block, between its opening line and its end. */
export function isFrontmatterLine(
	block: FrontmatterBlock,
	line: number,
): boolean {
	return line >= 1 && line < block.endLine;
}

/** The key whose name covers `offset`, if any. */
export function frontmatterKeyAt(
	block: FrontmatterBlock,
	offset: number,
): FrontmatterKeyLine | undefined {
	return block.keys.find((k) => k.start <= offset && offset <= k.end);
}
