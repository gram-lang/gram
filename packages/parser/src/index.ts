import * as ohm from "ohm-js";
import { grammarContent } from "./grammar-content";
import {
	type Meta,
	type RecipeAST,
	type RetroPlanningAST,
	type SectionAST,
	type StepAST,
	type TextAST,
	type IngredientAST,
	type CompositeAST,
	type CookwareAST,
	type QuantityAST,
	type QuantityValueAST,
	type RelativeQuantityAST,
	type TextQuantityAST,
	type ReferenceAST,
	type TimerAST,
	type TemperatureAST,
	type CommentAST,
	type AlternativeAST,
	type IntermediateDecl,
	type Modifier,
	type ImportDecl,
	type ImportBinding,
	ASTNodeType,
} from "./types";

export * from "./types";
export * from "./guards";
import { MetaSchema } from "./schemas";

/**
 * Thrown by `getAST` on a syntax error. `message` is ohm-js's human-readable
 * prose (source excerpt included) — keep using it for display. `offset` and
 * `expected` are the portable, structured parts of the same failure: a plain
 * character offset into `input` and a description of what was expected there.
 * A future non-JS parser implementation only needs to reproduce these two
 * fields, not ohm's exact wording.
 */
export class GramParseError extends Error {
	readonly offset: number;
	readonly expected: string;

	constructor(message: string, offset: number, expected: string) {
		super(message);
		this.name = "GramParseError";
		this.offset = offset;
		this.expected = expected;
	}
}

// Load Grammar
const grammar = ohm.grammar(grammarContent);

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

const clean = (str: string) => str.trim();

const RETRO_PLANNING_NUMBER_UNIT = /^(-)?\s*(\d+(?:\.\d+)?)\s*(\p{L}+)$/u;
const RETRO_PLANNING_NUMBER_ONLY = /^(-)?\s*(\d+(?:\.\d+)?)\s*$/;

/**
 * Mechanically extracts sign/value/unit from a raw `~{...}` retro-planning
 * capture, without judging whether the unit itself is valid — that requires
 * the i18n time dictionaries, which live downstream in kitchen. `value`/`unit`
 * are null when the text doesn't even look like a signed number (free text).
 */
const parseRetroPlanning = (raw: string): RetroPlanningAST => {
	const numberUnit = raw.match(RETRO_PLANNING_NUMBER_UNIT);
	if (numberUnit) {
		return {
			raw,
			sign: numberUnit[1] ? -1 : 1,
			value: Number(numberUnit[2]),
			unit: numberUnit[3] ?? null,
		};
	}

	const numberOnly = raw.match(RETRO_PLANNING_NUMBER_ONLY);
	if (numberOnly) {
		return {
			raw,
			sign: numberOnly[1] ? -1 : 1,
			value: Number(numberOnly[2]),
			unit: null,
		};
	}

	return { raw, sign: 1, value: null, unit: null };
};

// biome-ignore lint/suspicious/noExplicitAny: `node` is an Ohm CST node whose `toAST()` is added dynamically by semantics.addOperation below, not part of ohm-js's static Node type.
const getOpt = (node: any) =>
	node.children.length > 0 ? node.children[0].toAST() : null;

// The number/fraction layer lives in ./numbers.ts (audit 2026-07-22, parser
// finding P3), imported (not re-exported) here — it's an internal
// implementation detail of the grammar actions below, not part of this
// package's public surface, and stays independently testable in isolation.
import {
	parseNumber,
	unicodeFractionValue,
	makeMixedFraction,
	makeRange,
} from "./numbers";

const parseFrontmatterValue = (val: string): string | string[] => {
	val = val.trim();
	const strip = (s: string) =>
		s && (s.startsWith("'") || s.startsWith('"')) && s[0] === s[s.length - 1]
			? s.slice(1, -1)
			: s;

	if (val.startsWith("[") && val.endsWith("]")) {
		const inner = val.slice(1, -1).trim();
		return inner ? inner.split(",").map((s) => strip(s.trim())) : [];
	}
	return strip(val);
};

// ----------------------------------------------------------------------------
// SEMANTICS
// ----------------------------------------------------------------------------

// Intermediate shapes returned by grammar actions that never become an
// exported AST node in their own right (`header`/`headerExtension_*` just
// feed `Section`'s own fields) — typed here instead of `any` so the actions
// below get real return-type checking without an `as SectionAST`-style cast
// papering over a shape mismatch (audit 2026-07-22, parser finding I3).
interface HeaderExtensionResult {
	retroPlanning: RetroPlanningAST | null;
	intermediateDecl: IntermediateDecl | null;
}
interface HeaderResult extends HeaderExtensionResult {
	title: string;
}

const semantics = grammar.createSemantics();

semantics.addOperation("toAST", {
	// --- Structure ---

	Recipe(frontmatter, useBlock, content): RecipeAST {
		const rawMeta = getOpt(frontmatter) || {};
		const metaResult = MetaSchema.safeParse(rawMeta);
		let meta: Meta;
		if (!metaResult.success) {
			console.warn(
				"[Gram Parser] Invalid Front-Matter detected, ignoring metadata. Error:",
				metaResult.error.issues[0]?.message,
			);
			meta = {};
		} else {
			meta = metaResult.data;
		}

		const imports = (getOpt(useBlock) || []) as ImportDecl[];
		const children = (getOpt(content) || []) as RecipeAST["children"];
		return { type: ASTNodeType.Recipe, meta, imports, children };
	},

	Frontmatter(_1, _2, kv, _3, _4) {
		return kv.children
			.map((c) => c.toAST())
			.reduce((acc, curr) => Object.assign(acc, curr), {});
	},

	KeyValue(_newlines, key, _1, _2, value, _3) {
		return { [key.sourceString]: parseFrontmatterValue(value.sourceString) };
	},

	Content_explicit(_nls1, blocks, _nls2, sections): RecipeAST["children"] {
		return [
			...(blocks.children.map((c) => c.toAST()) as RecipeAST["children"]),
			...(sections.children.map((s) => s.toAST()) as SectionAST[]),
		];
	},

	Content_implicit(_nls, blocks): RecipeAST["children"] {
		return blocks.children.map((b) => b.toAST()) as RecipeAST["children"];
	},

	Section(header, blocks): SectionAST {
		const h = header.toAST() as HeaderResult;
		return {
			type: ASTNodeType.Section,
			title: h.title,
			retroPlanning: h.retroPlanning,
			intermediateDecl: h.intermediateDecl,
			children: blocks.children.map((b) => b.toAST()) as SectionAST["children"],
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	header(_1, _2, title, extension, _3, _4): HeaderResult {
		let retroPlanning = null;
		let intermediateDecl = null;

		const ext = getOpt(extension);
		if (ext) {
			retroPlanning = ext.retroPlanning;
			intermediateDecl = ext.intermediateDecl;
		}

		return {
			title: clean(title.sourceString).replace(/^##\s*/, ""),
			retroPlanning,
			intermediateDecl,
		};
	},

	headerExtension_retro(retro, _sp, decl): HeaderExtensionResult {
		const intermediate = getOpt(decl);
		return { retroPlanning: retro.toAST(), intermediateDecl: intermediate };
	},

	headerExtension_decl(decl, _sp, retro): HeaderExtensionResult {
		return {
			retroPlanning: getOpt(retro),
			intermediateDecl: decl.toAST(),
		};
	},

	retroPlanning(_1, content, _2): RetroPlanningAST {
		return parseRetroPlanning(clean(content.sourceString));
	},

	// --- Module imports ---

	UseBlock(_nls0, first, _nlsRest, rest): ImportDecl[] {
		const firstDecl = first.toAST() as ImportDecl;
		const restDecls = rest.children
			.map((c) => c.toAST())
			.filter((d): d is ImportDecl => d !== null);
		return [firstDecl, ...restDecls];
	},

	// Discarded on purpose: a comment between two `@use` directives must not
	// break the block (see grammar.ohm), but the AST has nowhere principled to
	// put it -- `imports` only ever holds resolved `ImportDecl`s.
	useComment(_comment, _nl): null {
		return null;
	},

	useDirective(
		_at,
		_sp1,
		spec,
		_sp2,
		_as,
		_sp3,
		binds,
		_sp4,
		modeOpt,
		_sp5,
		_term,
	): ImportDecl {
		const mode =
			modeOpt.children.length > 0
				? (modeOpt.children[0]!.toAST() as "prepared")
				: "inline";
		return {
			type: ASTNodeType.ImportDecl,
			specifier: spec.toAST() as string,
			bindings: binds.toAST() as ImportBinding[],
			mode,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	moduleSpecifier(_lq, chars, _rq): string {
		return chars.sourceString;
	},

	bindings_named(_lb, _s1, first, more, _s2, _rb): ImportBinding[] {
		return [
			first.toAST() as ImportBinding,
			...(more.children.map((c) => c.toAST()) as ImportBinding[]),
		];
	},

	bindings_default(b): ImportBinding[] {
		const binding = b.toAST() as ImportBinding;
		return [{ ...binding, exported: "default" }];
	},

	moreBindings(_s1, _comma, _s2, b): ImportBinding {
		return b.toAST();
	},

	binding(_amp, name, _sp1, _as, _sp2, _amp2, aliasIter): ImportBinding {
		const exported = clean(name.sourceString);
		const local =
			aliasIter.children.length > 0
				? clean(aliasIter.children[0]!.sourceString)
				: exported;
		return {
			exported,
			local,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	importMode(_lit): "prepared" {
		return "prepared";
	},

	invalidUseDirective(_at, _sp, _q) {
		throw new GramParseError(
			"Gram Syntax Error: '@use' directives must appear right after the frontmatter (or at the top of the document), before the first step.",
			this.source.startIdx,
			"'@use \"...\" as &name' at the top of the document, before any step",
		);
	},

	// --- Blocks & Steps ---

	Block_comment(comment, _nls): SectionAST["children"][number] {
		return comment.toAST();
	},
	Block_step(child): SectionAST["children"][number] {
		return child.toAST();
	},

	step(actionNode, line1, _nls, lines, _term): StepAST {
		const action = getOpt(actionNode);

		const content: unknown[] = [line1.toAST()];
		lines.children.forEach((l) => {
			content.push([{ type: ASTNodeType.Text, value: " " }]);
			content.push(l.toAST());
		});

		// Flatten the array to unify text/ingredients flow
		const flatContent = content
			.flat()
			.filter((c) => c !== null) as StepAST["children"];

		return {
			type: ASTNodeType.Step,
			action,
			children: flatContent,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	startAction(_lb, txt, _rb, _sp): string {
		return clean(txt.sourceString);
	},

	line(items): StepAST["children"] {
		return items.children.map((i) => i.toAST()) as StepAST["children"];
	},
	stepContent(child): StepAST["children"][number] {
		return child.toAST();
	},
	invalidComposite(_s1, _lt, _s2, _at, name) {
		throw new GramParseError(
			`Gram Syntax Error: spaces are not allowed around '<' for composite ingredients. Did you mean '<@${name.sourceString}'?`,
			this.source.startIdx,
			"'<@' with no surrounding spaces",
		);
	},

	invalidAlternativeBar(_bar) {
		throw new GramParseError(
			`Gram Syntax Error: '|' is only valid between alternative ingredients/cookware (e.g. @salt|@pepper). If you meant to separate two options, make sure each uses a single-word name or wraps a multi-word name in {} (e.g. @egg substitute{}|@tofu{}).`,
			this.source.startIdx,
			"'|' between two complete @ingredient or #cookware alternatives",
		);
	},

	intermediateDecl_bare(_1, name): IntermediateDecl {
		return {
			type: ASTNodeType.IntermediateDecl,
			name: clean(name.sourceString),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	intermediateDecl_full(_1, name, _2): IntermediateDecl {
		return {
			type: ASTNodeType.IntermediateDecl,
			name: clean(name.sourceString),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	// --- Text & Primitives ---

	text(spaces, chars): TextAST {
		const val = spaces.sourceString + chars.sourceString;
		return {
			type: ASTNodeType.Text,
			value: val,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	fallback(c): TextAST {
		return {
			type: ASTNodeType.Text,
			value: c.sourceString,
			fallback: true,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	nl(_r, _n): null {
		return null;
	},
	ws(s): TextAST {
		return { type: ASTNodeType.Text, value: s.sourceString };
	},

	// --- Ingredients ---

	Ingredient(child): IngredientAST | AlternativeAST {
		return child.toAST();
	},

	Alternative(first, _bars, rest): AlternativeAST {
		const options = [first.toAST(), ...rest.children.map((c) => c.toAST())];
		return {
			type: ASTNodeType.Alternative,
			options,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	simpleIngredient_full(
		_at,
		_mods,
		_name,
		_alias,
		_qty,
		_prep,
		_comp,
	): IngredientAST {
		// Grammar-guaranteed: `modifier = "?" | "-" | "*" | "&" | "="` (grammar.ohm)
		// is the only production feeding this array, so every sourceString here
		// is one of Modifier's 5 literal sigils.
		let modifiers = _mods.children.map((m) => m.sourceString) as Modifier[];
		const qtyAST = _qty.toAST();

		if (modifiers.includes("=")) {
			if (qtyAST && qtyAST.type === ASTNodeType.Quantity) {
				qtyAST.fixed = true;
			}
			modifiers = modifiers.filter((m) => m !== "=");
		}

		return {
			type: ASTNodeType.Ingredient,
			name: _name.sourceString.trim(),
			modifiers,
			quantity: qtyAST,
			alias: getOpt(_alias),
			preparation: getOpt(_prep),
			composite: getOpt(_comp),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	simpleIngredient_bare(
		_at,
		_mods,
		_name,
		_alias,
		_prep,
		_comp,
	): IngredientAST {
		const modifiers = _mods.children
			.map((m) => m.sourceString)
			.filter((m) => m !== "=") as Modifier[];
		return {
			type: ASTNodeType.Ingredient,
			name: _name.sourceString.trim(),
			modifiers,
			quantity: null,
			alias: getOpt(_alias),
			preparation: getOpt(_prep),
			composite: getOpt(_comp),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	// `_mods` is parsed but deliberately unused: CompositeAST carries no
	// modifiers, and none of the five are meaningful on a parent. "&" ("already
	// introduced") is redundant because the shopping list's MAX rule already
	// collapses repeat draws from one parent into a single purchase. Accepting
	// them here is what keeps the parent *name* clean -- see the grammar note.
	composite_full(_ltat, _mods, name, _qty, _prep): CompositeAST {
		return {
			type: ASTNodeType.Composite,
			parent: clean(name.sourceString),
			quantity: _qty.toAST(),
			preparation: getOpt(_prep),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	composite_bare(_ltat, _mods, name, _prep): CompositeAST {
		return {
			type: ASTNodeType.Composite,
			parent: clean(name.sourceString),
			quantity: null,
			preparation: getOpt(_prep),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	alias(_colon, name): string {
		return clean(name.sourceString);
	},
	preparation(_lp, text, _rp): string {
		return clean(text.sourceString);
	},
	unit(name): string {
		return clean(name.sourceString);
	},

	ingredientQuantity(
		_lb,
		_s1,
		content,
		_s3,
		_rb,
	): RelativeQuantityAST | QuantityAST {
		return content.toAST();
	},

	relativeQuantity(
		val,
		_s1,
		_pct,
		_s2,
		marker,
		_s3,
		name,
	): RelativeQuantityAST {
		return {
			type: ASTNodeType.RelativeQuantity,
			percent: parseFloat(val.sourceString),
			target: clean(name.sourceString),
			referenceType: marker.sourceString === "&" ? "variable" : "ingredient",
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	absoluteQuantity(val, _s2, unit, _sUnit): QuantityAST {
		return {
			type: ASTNodeType.Quantity,
			value: getOpt(val),
			unit: getOpt(unit),
			fixed: false, // In v1, fixed is a modifier on the element, not the quantity
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	cookwareQuantity(_lb, _s1, val, _s2, _rb): QuantityAST {
		return {
			type: ASTNodeType.Quantity,
			value: getOpt(val),
			unit: null,
			fixed: false,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	textQuantity(_lb, _s1, content, _s2, _rb): TextQuantityAST {
		return {
			type: ASTNodeType.TextQuantity,
			value: clean(content.sourceString),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	number(child): QuantityValueAST | null {
		return child.toAST();
	},

	plainNumber(_1, _2, _3, _4, _5): QuantityValueAST | null {
		return parseNumber(this.sourceString);
	},

	mixedFraction(whole, _sp, num, _slash, den): QuantityValueAST {
		const w = parseInt(whole.sourceString, 10);
		const n = parseInt(num.sourceString, 10);
		const d = parseInt(den.sourceString, 10);
		return makeMixedFraction(w, n, d, this.sourceString);
	},

	unicodeFraction_mixed(whole, frac): QuantityValueAST {
		const w = parseInt(whole.sourceString, 10);
		const [n, d] = unicodeFractionValue(frac.sourceString);
		return makeMixedFraction(w, n, d, this.sourceString);
	},

	unicodeFraction_bare(frac): QuantityValueAST {
		const [n, d] = unicodeFractionValue(frac.sourceString);
		return makeMixedFraction(0, n, d, this.sourceString);
	},

	range(n1, _s1, _, _s2, n2): QuantityValueAST | null {
		const min = n1.toAST() as QuantityValueAST;
		const max = n2.toAST() as QuantityValueAST;
		return makeRange(min, max, this.sourceString);
	},

	// --- Cookware ---

	CookwareAlternative(first, _bars, rest): AlternativeAST {
		return {
			type: ASTNodeType.Alternative,
			options: [first.toAST(), ...rest.children.map((c) => c.toAST())],
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	simpleCookware_full(_hash, mods, name, alias, qty, prep): CookwareAST {
		let modifiers = mods.children.map((c) => c.sourceString);
		const qtyAST = qty.toAST();

		if (modifiers.includes("=")) {
			if (qtyAST && qtyAST.type === ASTNodeType.Quantity) {
				qtyAST.fixed = true;
			}
			modifiers = modifiers.filter((m) => m !== "=");
		}

		return {
			type: ASTNodeType.Cookware,
			name: clean(name.sourceString),
			modifiers,
			alias: getOpt(alias),
			quantity: qtyAST, // Mandatory
			preparation: getOpt(prep),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	simpleCookware_bare(_hash, mods, name, alias, prep): CookwareAST {
		const modifiers = mods.children
			.map((c) => c.sourceString)
			.filter((m) => m !== "=");
		return {
			type: ASTNodeType.Cookware,
			name: clean(name.sourceString),
			modifiers,
			alias: getOpt(alias),
			quantity: {
				type: ASTNodeType.Quantity,
				fixed: false,
				loc: { start: this.source.startIdx, end: this.source.endIdx },
			},
			preparation: getOpt(prep),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	// --- Other Elements ---

	Reference_full(_amp, _name, _qty): ReferenceAST {
		return {
			type: ASTNodeType.Reference,
			name: _name.sourceString,
			quantity: _qty.toAST(),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	Reference_bare(_amp, _name): ReferenceAST {
		return {
			type: ASTNodeType.Reference,
			name: _name.sourceString,
			quantity: null,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	Timer(_1, passiveMod, name, qty): TimerAST {
		const child = name.children[0];
		const n = child ? clean(child.sourceString) : null;
		return {
			type: ASTNodeType.Timer,
			name: n,
			quantity: qty.toAST(),
			isPassive: passiveMod.children.length > 0,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	Temperature(_1, name, qty): TemperatureAST {
		const child = name.children[0];
		const n = child ? clean(child.sourceString) : null;
		const qAST = qty.toAST();
		const base = {
			type: ASTNodeType.Temperature as const,
			name: n,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};

		if (qAST.type === ASTNodeType.TextQuantity) {
			return { ...base, text: qAST.value };
		}
		if (qAST.type === ASTNodeType.Quantity && !qAST.value) {
			return { ...base, text: qAST.unit || "" };
		}
		return {
			...base,
			value: qAST.value || null,
			unit: qAST.unit || null,
		};
	},

	Comment(_1, text): CommentAST {
		return {
			type: ASTNodeType.Comment,
			value: text.sourceString,
			kind: "line",
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},
	CommentBlock(_1, text, _2): CommentAST {
		return {
			type: ASTNodeType.Comment,
			value: text.sourceString,
			kind: "block",
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	_terminal(): null {
		return null;
	},
});

// ----------------------------------------------------------------------------
// EXPORTS
// ----------------------------------------------------------------------------

export function getAST(input: string): RecipeAST {
	const match = grammar.match(input);
	if (match.failed()) {
		throw new GramParseError(
			match.message,
			match.getRightmostFailurePosition(),
			match.getExpectedText(),
		);
	}
	return semantics(match).toAST();
}
