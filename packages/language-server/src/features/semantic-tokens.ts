import type { SemanticTokens } from "vscode-languageserver";
import {
	type SectionAST,
	type StepAST,
	type IngredientAST,
	type CookwareAST,
	type TimerAST,
	type TemperatureAST,
	type CheckpointAST,
	type ReferenceAST,
	type IntermediateDecl,
	type QuantityAST,
	type TextQuantityAST,
	isIngredient,
	isCookware,
	isReference,
	isTimer,
	isTemperature,
	isCheckpoint,
	isIntermediateDecl,
	isAlternative,
	isComment,
	isStep,
	isSection,
	isQuantity,
	isRatioQuantity,
	isRelativeQuantity,
	isTextQuantity,
	type RatioQuantityAST,
	type RelativeQuantityAST,
} from "@gram-lang/parser";
import type { DocumentState } from "../document-state";
import { offsetToPosition } from "../utils/position";

export const SEMANTIC_TOKEN_TYPES = [
	"namespace", // 0 — ## section title
	"keyword", // 1 — sigils: @ # ~ ^ = ->& & <@
	"parameter", // 2 — ingredient / cookware names
	"variable", // 3 — intermediate / reference names
	"number", // 4 — quantity amounts
	"type", // 5 — units (g, ml, tbsp, min…)
	"string", // 6 — text quantities, temperature descriptions
	"operator", // 7 — braces {}, brackets [], modifiers, <
	"function", // 8 — action verbs [Mix]
	"comment", // 9 — // and /* */
] as const;

export const SEMANTIC_TOKEN_MODIFIERS: string[] = [];

const T = {
	namespace: 0,
	keyword: 1,
	parameter: 2,
	variable: 3,
	number: 4,
	type: 5,
	string: 6,
	operator: 7,
	function: 8,
	comment: 9,
} as const;

interface RawToken {
	offset: number;
	length: number;
	type: number;
}

function emit(
	out: RawToken[],
	offset: number,
	length: number,
	type: number,
): void {
	if (length > 0 && offset >= 0) out.push({ offset, length, type });
}

// Emits only the brace delimiters { } as operators.
// The number/unit content inside is intentionally left to the TextMate grammar
// (constant.numeric.gram / string.unquoted.unit.gram), which themes reliably colour
// differently — avoiding dependence on theme-specific semantic token rules.
// A quantity's `loc` holds its braces or not (a relative quantity's does
// not): both are handled.
function emitBraces(
	out: RawToken[],
	loc: { start: number; end: number } | undefined,
	text: string,
): void {
	if (!loc) return;
	const cStart = loc.start;
	const cEnd = loc.end;
	if (text[cStart] === "{") {
		emit(out, cStart, 1, T.operator);
		emit(out, cEnd - 1, 1, T.operator);
	} else {
		if (cStart > 0) emit(out, cStart - 1, 1, T.operator);
		emit(out, cEnd, 1, T.operator);
	}
}

/** The slash of a ratio: one with a space on a side, never a fraction's (`1/2`). */
const RATIO_SLASH = /(?<=\s)\/|\/(?=\s)/;

/**
 * Inside a share or a ratio (`70% @&flour`, `1 / 100 g @&flour`,
 * `~{15 min / 500 g @&roast}`): the ratio's slash, then the target's sigil
 * and name, an intermediate's (`&dough`) as a reference, an ingredient's
 * (`@&flour`) as an ingredient. Numbers and units stay TextMate's.
 */
function emitRelativeInside(
	out: RawToken[],
	qty: RelativeQuantityAST | RatioQuantityAST,
	text: string,
): void {
	if (!qty.loc) return;
	const inside = text.slice(qty.loc.start, qty.loc.end);
	if (isRatioQuantity(qty)) {
		const slash = inside.search(RATIO_SLASH);
		if (slash >= 0) emit(out, qty.loc.start + slash, 1, T.operator);
	}
	const at = inside.lastIndexOf(qty.target);
	if (at < 0) return;
	const sigil = qty.referenceType === "variable" ? "&" : "@&";
	const sigilAt = inside.lastIndexOf(sigil, at);
	if (sigilAt >= 0) emit(out, qty.loc.start + sigilAt, sigil.length, T.keyword);
	emit(
		out,
		qty.loc.start + at,
		qty.target.length,
		qty.referenceType === "variable" ? T.variable : T.parameter,
	);
}

/** An element's `{…}`: its braces, and what a share or a ratio holds. */
function emitQuantity(
	out: RawToken[],
	qty: QuantityAST | TextQuantityAST | RelativeQuantityAST | RatioQuantityAST,
	text: string,
): void {
	emitBraces(out, qty.loc, text);
	if (isRelativeQuantity(qty) || isRatioQuantity(qty)) {
		emitRelativeInside(out, qty, text);
	}
}

function walkIngredient(
	out: RawToken[],
	ing: IngredientAST,
	text: string,
): void {
	if (!ing.loc) return;
	let pos = ing.loc.start;

	if (text[pos] === "@") {
		emit(out, pos, 1, T.keyword);
		pos++;
	}

	// Modifier chars can be combined: @?- etc.
	const modStart = pos;
	while (pos < ing.loc.end && "-?&*=".includes(text[pos] ?? "")) pos++;
	if (pos > modStart) emit(out, modStart, pos - modStart, T.operator);

	// Name ends at { < ( newline or end of token
	const nameStart = pos;
	while (pos < ing.loc.end && !"{<(\n".includes(text[pos] ?? "")) pos++;
	const nameTrimLen = text.slice(nameStart, pos).trimEnd().length;
	if (nameTrimLen > 0) emit(out, nameStart, nameTrimLen, T.parameter);

	if (
		isQuantity(ing.quantity) ||
		isTextQuantity(ing.quantity) ||
		isRelativeQuantity(ing.quantity) ||
		isRatioQuantity(ing.quantity)
	) {
		emitQuantity(out, ing.quantity, text);
	}

	// Composite part <@name{qty} is stored in ing.composite, within the same loc span
	if (ing.composite) {
		// The composite is always contiguous with the main ingredient, so search from just past its start
		const ltAt = text.indexOf("<@", ing.loc.start + 1);
		if (ltAt >= 0 && ltAt < ing.loc.end) {
			emit(out, ltAt, 1, T.operator);
			emit(out, ltAt + 1, 1, T.keyword);
			const compNameStart = ltAt + 2;
			emit(out, compNameStart, ing.composite.parent.length, T.parameter);
			if (isQuantity(ing.composite.quantity)) {
				emitQuantity(out, ing.composite.quantity, text);
			}
		}
	}
}

function walkCookware(out: RawToken[], cw: CookwareAST, text: string): void {
	if (!cw.loc) return;
	let pos = cw.loc.start;

	if (text[pos] === "#") {
		emit(out, pos, 1, T.keyword);
		pos++;
	}

	const modStart = pos;
	while (pos < cw.loc.end && "-?&*=".includes(text[pos] ?? "")) pos++;
	if (pos > modStart) emit(out, modStart, pos - modStart, T.operator);

	const nameStart = pos;
	while (pos < cw.loc.end && !"{(\n".includes(text[pos] ?? "")) pos++;
	const nameTrimLen = text.slice(nameStart, pos).trimEnd().length;
	if (nameTrimLen > 0) emit(out, nameStart, nameTrimLen, T.parameter);

	if (isQuantity(cw.quantity)) {
		emitQuantity(out, cw.quantity, text);
	}
}

function walkReference(out: RawToken[], ref: ReferenceAST, text: string): void {
	if (!ref.loc) return;
	let pos = ref.loc.start;

	if (text[pos] === "&") {
		emit(out, pos, 1, T.keyword);
		pos++;
	}

	const nameStart = pos;
	while (pos < ref.loc.end && !"{(\n".includes(text[pos] ?? "")) pos++;
	const nameTrimLen = text.slice(nameStart, pos).trimEnd().length;
	if (nameTrimLen > 0) emit(out, nameStart, nameTrimLen, T.variable);

	if (
		isQuantity(ref.quantity) ||
		isTextQuantity(ref.quantity) ||
		isRelativeQuantity(ref.quantity) ||
		isRatioQuantity(ref.quantity)
	) {
		emitQuantity(out, ref.quantity, text);
	}
}

function walkTimer(out: RawToken[], timer: TimerAST, text: string): void {
	if (!timer.loc) return;
	let pos = timer.loc.start;

	if (text[pos] === "~") {
		emit(out, pos, 1, T.keyword);
		pos++;
	}

	// Passive modifier _
	if (timer.isPassive && text[pos] === "_") {
		emit(out, pos, 1, T.operator);
		pos++;
	}

	// Optional name (e.g. ~baking{30 min})
	if (timer.name) {
		emit(out, pos, timer.name.length, T.variable);
		pos += timer.name.length;
	}

	// Only the braces: the duration inside (`1h30`, `1:30 h`, `5'30"`) is left
	// to the TextMate grammar, like a temperature. `timer.quantity` is no guide:
	// the grammar cuts `1h30` as 1 + unit `h30`.
	if (text[pos] === "{" && text[timer.loc.end - 1] === "}") {
		emit(out, pos, 1, T.operator);
		emit(out, timer.loc.end - 1, 1, T.operator);
	}
	// A proportional time: its slash and its target.
	if (isRatioQuantity(timer.quantity)) {
		emitRelativeInside(out, timer.quantity, text);
	}
}

function walkTemperature(
	out: RawToken[],
	temp: TemperatureAST,
	text: string,
): void {
	if (!temp.loc) return;

	// ^ sigil (1 UTF-16 code unit)
	emit(out, temp.loc.start, 1, T.keyword);

	// Optional label: ^oven{...} → emit "oven" as variable
	if (temp.name) {
		emit(out, temp.loc.start + 1, temp.name.length, T.variable);
	}

	// Emit only { and } as operators — leave the number/unit content to the TextMate grammar
	// (constant.numeric.gram for the value, string.unquoted.unit.gram for the unit).
	// Emitting a single span here would override TextMate and collapse both to one colour.
	const bodyStart = temp.loc.start + 1 + (temp.name?.length ?? 0);
	const body = text.slice(bodyStart, temp.loc.end);
	const braceOpen = body.indexOf("{");
	if (braceOpen >= 0) {
		// The first `}` after `{`, not the last one: a note glued to the
		// brace (`^{180°C}(mode } spécial)`) may hold one. A quantity cannot.
		const braceClose = body.indexOf("}", braceOpen + 1);
		const absOpen = bodyStart + braceOpen;
		const absClose =
			bodyStart + (braceClose >= 0 ? braceClose : body.length - 1);
		emit(out, absOpen, 1, T.operator);
		emit(out, absClose, 1, T.operator);
	}
}

// A target state (`={ribbon stage}(note)`, 1.5): its `=` and its braces.
// The state is left to the TextMate grammar (string.unquoted.checkpoint.gram),
// and so is the note (string.other.preparation.gram), as on a temperature.
function walkCheckpoint(
	out: RawToken[],
	cp: CheckpointAST,
	text: string,
): void {
	if (!cp.loc || text[cp.loc.start] !== "=") return;
	const open = cp.loc.start + 1;
	// The first `}` after `{`: a state holds none, its note may.
	const close = text.indexOf("}", open + 1);
	if (text[open] !== "{" || close < 0 || close >= cp.loc.end) return;
	emit(out, cp.loc.start, 1, T.keyword);
	emit(out, open, 1, T.operator);
	emit(out, close, 1, T.operator);
}

function walkIntermediate(
	out: RawToken[],
	decl: IntermediateDecl,
	text: string,
): void {
	if (!decl.loc) return;
	let pos = decl.loc.start;

	emit(out, pos, 3, T.keyword); // "->&" is always 3 chars
	pos += 3;

	const nameStart = pos;
	while (pos < decl.loc.end && text[pos] !== "{" && text[pos] !== "\n") pos++;
	const nameTrimLen = text.slice(nameStart, pos).trimEnd().length;
	if (nameTrimLen > 0) emit(out, nameStart, nameTrimLen, T.variable);

	// {} (always empty for declarations)
	if (text[pos] === "{" && text[pos + 1] === "}") {
		emit(out, pos, 1, T.operator);
		emit(out, pos + 1, 1, T.operator);
	}
}

function walkStep(out: RawToken[], step: StepAST, text: string): void {
	if (!step.loc) return;

	// e.g. an action verb like [Mix]
	if (step.action && text[step.loc.start] === "[") {
		const closeIdx = text.indexOf("]", step.loc.start);
		if (closeIdx > step.loc.start) {
			emit(out, step.loc.start, 1, T.operator);
			emit(out, step.loc.start + 1, closeIdx - step.loc.start - 1, T.function);
			emit(out, closeIdx, 1, T.operator);
		}
	}

	for (const child of step.children) {
		if (isIngredient(child)) walkIngredient(out, child, text);
		else if (isCookware(child)) walkCookware(out, child, text);
		else if (isTimer(child)) walkTimer(out, child, text);
		else if (isTemperature(child)) walkTemperature(out, child, text);
		else if (isCheckpoint(child)) walkCheckpoint(out, child, text);
		else if (isReference(child)) walkReference(out, child, text);
		else if (isIntermediateDecl(child)) walkIntermediate(out, child, text);
		else if (isAlternative(child)) {
			for (const opt of child.options) {
				if (isIngredient(opt)) walkIngredient(out, opt, text);
				else if (isCookware(opt)) walkCookware(out, opt, text);
			}
		} else if (isComment(child) && child.loc) {
			emit(out, child.loc.start, child.loc.end - child.loc.start, T.comment);
		}
	}
}

function walkSection(out: RawToken[], section: SectionAST, text: string): void {
	if (
		section.loc &&
		text.slice(section.loc.start, section.loc.start + 2) === "##"
	) {
		const headerStart = section.loc.start;
		emit(out, headerStart, 2, T.keyword);

		let titlePos = headerStart + 2;
		while (titlePos < text.length && text[titlePos] === " ") titlePos++;

		// Title ends before ->&, ~, or newline
		const lineEnd = text.indexOf("\n", titlePos);
		const lineEndAbs = lineEnd >= 0 ? lineEnd : text.length;
		let titleEnd = lineEndAbs;
		for (const marker of ["->&", "~"]) {
			const idx = text.indexOf(marker, titlePos);
			if (idx >= 0 && idx < titleEnd) titleEnd = idx;
		}
		while (titleEnd > titlePos && text[titleEnd - 1] === " ") titleEnd--;
		if (titleEnd > titlePos)
			emit(out, titlePos, titleEnd - titlePos, T.namespace);
	}

	// e.g. a section header with a trailing intermediate decl: ## Title ->&name{}
	if (section.intermediateDecl) {
		walkIntermediate(out, section.intermediateDecl, text);
	}

	for (const block of section.children) {
		if (isStep(block)) {
			walkStep(out, block, text);
		} else if (isComment(block) && block.loc) {
			emit(out, block.loc.start, block.loc.end - block.loc.start, T.comment);
		}
	}
}

function encodeTokens(rawTokens: RawToken[], lineStarts: number[]): number[] {
	rawTokens.sort((a, b) => a.offset - b.offset);

	const data: number[] = [];
	let prevLine = 0;
	let prevChar = 0;

	for (const tok of rawTokens) {
		const pos = offsetToPosition(lineStarts, tok.offset);
		const deltaLine = pos.line - prevLine;
		const deltaChar =
			deltaLine === 0 ? pos.character - prevChar : pos.character;
		data.push(deltaLine, deltaChar, tok.length, tok.type, 0);
		prevLine = pos.line;
		prevChar = pos.character;
	}

	return data;
}

export function provideSemanticTokens(state: DocumentState): SemanticTokens {
	if (!state.ast) return { data: [] };

	const out: RawToken[] = [];
	const text = state.text;

	// `RecipeAST.children` isn't always `SectionAST[]` — a recipe with no
	// `## Section` header anywhere,
	// or leading content before the first header, places `Step`/`Comment`
	// nodes directly under `Recipe`. Dispatch on the real node type instead
	// of assuming every top-level child is a section (which would crash on
	// a bare top-level Comment: `.children` doesn't exist on `CommentAST`).
	for (const child of state.ast.children) {
		if (isSection(child)) {
			walkSection(out, child, text);
		} else if (isStep(child)) {
			walkStep(out, child, text);
		} else if (isComment(child) && child.loc) {
			emit(out, child.loc.start, child.loc.end - child.loc.start, T.comment);
		}
	}

	return { data: encodeTokens(out, state.lineStarts) };
}
