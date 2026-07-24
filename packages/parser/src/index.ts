import * as ohm from "ohm-js";
import { grammarContent } from "./grammar-content";
import {
	type RecipeAST,
	type RetroPlanningAST,
	type SectionAST,
	type StepAST,
	type IngredientAST,
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

/**
 * Trims a string.
 */
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

/**
 * Safely extracts the AST from an optional node (0 or 1 child).
 * Returns null if the node has no children.
 */
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

/**
 * Parses values from Frontmatter (removing quotes, brackets, etc.)
 */
const parseFrontmatterValue = (val: string): string | string[] => {
	val = val.trim();
	// Helper to strip surrounding quotes
	const strip = (s: string) =>
		s && (s.startsWith("'") || s.startsWith('"')) && s[0] === s[s.length - 1]
			? s.slice(1, -1)
			: s;

	// Handle Arrays [a, b]
	if (val.startsWith("[") && val.endsWith("]")) {
		const inner = val.slice(1, -1).trim();
		return inner ? inner.split(",").map((s) => strip(s.trim())) : [];
	}
	return strip(val);
};

// ----------------------------------------------------------------------------
// SEMANTICS
// ----------------------------------------------------------------------------

const semantics = grammar.createSemantics();

semantics.addOperation("toAST", {
	// --- Structure ---

	Recipe(frontmatter, content) {
		let meta = getOpt(frontmatter) || {};
		const metaResult = MetaSchema.safeParse(meta);
		if (!metaResult.success) {
			console.warn(
				"[Gram Parser] Invalid Front-Matter detected, ignoring metadata. Error:",
				metaResult.error.issues[0]?.message,
			);
			meta = {};
		} else {
			meta = metaResult.data;
		}

		const sections = getOpt(content) || [];
		return { type: ASTNodeType.Recipe, meta, children: sections } as RecipeAST;
	},

	Frontmatter(_1, _2, kv, _3, _4) {
		// Merge all KeyValues into a single object
		return kv.children
			.map((c) => c.toAST())
			.reduce((acc, curr) => Object.assign(acc, curr), {});
	},

	KeyValue(_newlines, key, _1, _2, value, _3) {
		return { [key.sourceString]: parseFrontmatterValue(value.sourceString) };
	},

	Content_explicit(_nls1, blocks, _nls2, sections) {
		return [
			...blocks.children.map((c) => c.toAST()),
			...sections.children.map((s) => s.toAST()),
		];
	},

	Content_implicit(_nls, blocks) {
		return blocks.children.map((b) => b.toAST());
	},

	Section(header, blocks) {
		const h = header.toAST();
		return {
			type: ASTNodeType.Section,
			title: h.title,
			retroPlanning: h.retroPlanning,
			intermediateDecl: h.intermediateDecl,
			children: blocks.children.map((b) => b.toAST()),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as SectionAST;
	},

	header(_1, _2, title, extension, _3, _4) {
		let retroPlanning = null;
		let intermediateDecl = null;

		const ext = getOpt(extension);
		if (ext) {
			// headerExtension semantic action returns { retroPlanning, intermediateDecl }
			retroPlanning = ext.retroPlanning;
			intermediateDecl = ext.intermediateDecl;
		}

		return {
			title: clean(title.sourceString).replace(/^##\s*/, ""),
			retroPlanning,
			intermediateDecl,
		};
	},

	headerExtension_retro(retro, _sp, decl) {
		const intermediate = getOpt(decl);
		return { retroPlanning: retro.toAST(), intermediateDecl: intermediate };
	},

	headerExtension_decl(decl, _sp, retro) {
		return {
			retroPlanning: getOpt(retro),
			intermediateDecl: decl.toAST(),
		};
	},

	retroPlanning(_1, content, _2) {
		return parseRetroPlanning(clean(content.sourceString));
	},

	// --- Blocks & Steps ---

	Block_comment(comment, _nls) {
		return comment.toAST();
	},
	Block_step(child) {
		return child.toAST();
	},

	step(actionNode, line1, _nls, lines, _term) {
		const action = getOpt(actionNode);

		// Combine first line with subsequent lines, joined by a space
		const content: unknown[] = [line1.toAST()];
		lines.children.forEach((l) => {
			content.push([{ type: ASTNodeType.Text, value: " " }]); // Space separator
			content.push(l.toAST());
		});

		// Flatten the array to unify text/ingredients flow
		const flatContent = content.flat().filter((c) => c !== null);

		return {
			type: ASTNodeType.Step,
			action,
			children: flatContent,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as StepAST;
	},

	startAction(_lb, txt, _rb, _sp) {
		return clean(txt.sourceString);
	},

	line(items) {
		return items.children.map((i) => i.toAST());
	},
	stepContent(child) {
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

	intermediateDecl_bare(_1, name) {
		return {
			type: ASTNodeType.IntermediateDecl,
			name: clean(name.sourceString),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as IntermediateDecl;
	},

	intermediateDecl_full(_1, name, _2) {
		return {
			type: ASTNodeType.IntermediateDecl,
			name: clean(name.sourceString),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as IntermediateDecl;
	},

	// --- Text & Primitives ---

	text(spaces, chars) {
		const val = spaces.sourceString + chars.sourceString;
		return {
			type: ASTNodeType.Text,
			value: val,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	fallback(c) {
		return {
			type: ASTNodeType.Text,
			value: c.sourceString,
			fallback: true,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};
	},

	nl(_r, _n) {
		return null;
	},
	ws(s) {
		return { type: ASTNodeType.Text, value: s.sourceString };
	},

	// --- Ingredients ---

	Ingredient(child) {
		return child.toAST();
	},

	Alternative(first, _bars, rest) {
		const options = [first.toAST(), ...rest.children.map((c) => c.toAST())];
		return {
			type: ASTNodeType.Alternative,
			options,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as AlternativeAST;
	},

	simpleIngredient_full(_at, _mods, _name, _alias, _qty, _prep, _comp) {
		let modifiers = _mods.children.map((m) => m.sourceString);
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
		} as IngredientAST;
	},

	simpleIngredient_bare(_at, _mods, _name, _alias, _prep, _comp) {
		const modifiers = _mods.children
			.map((m) => m.sourceString)
			.filter((m) => m !== "=");
		return {
			type: ASTNodeType.Ingredient,
			name: _name.sourceString.trim(),
			modifiers,
			quantity: null,
			alias: getOpt(_alias),
			preparation: getOpt(_prep),
			composite: getOpt(_comp),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as IngredientAST;
	},

	composite_full(_ltat, name, _qty, _prep) {
		return {
			type: ASTNodeType.Composite,
			parent: clean(name.sourceString),
			quantity: _qty.toAST(),
			preparation: getOpt(_prep),
		};
	},

	composite_bare(_ltat, name, _prep) {
		return {
			type: ASTNodeType.Composite,
			parent: clean(name.sourceString),
			quantity: null,
			preparation: getOpt(_prep),
		};
	},

	alias(_colon, name) {
		return clean(name.sourceString);
	},
	preparation(_lp, text, _rp) {
		return clean(text.sourceString);
	},
	unit(name) {
		return clean(name.sourceString);
	},

	ingredientQuantity(_lb, _s1, content, _s3, _rb) {
		return content.toAST();
	},

	relativeQuantity(val, _s1, _pct, _s2, marker, _s3, name) {
		return {
			type: ASTNodeType.RelativeQuantity,
			percent: parseFloat(val.sourceString),
			target: clean(name.sourceString),
			referenceType: marker.sourceString === "&" ? "variable" : "ingredient",
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as RelativeQuantityAST;
	},

	absoluteQuantity(val, _s2, unit, _sUnit) {
		return {
			type: ASTNodeType.Quantity,
			value: getOpt(val),
			unit: getOpt(unit),
			fixed: false, // In v1, fixed is a modifier on the element, not the quantity
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as QuantityAST;
	},

	cookwareQuantity(_lb, _s1, val, _s2, _rb) {
		return {
			type: ASTNodeType.Quantity,
			value: getOpt(val),
			unit: null,
			fixed: false,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as QuantityAST;
	},

	textQuantity(_lb, _s1, content, _s2, _rb) {
		return {
			type: ASTNodeType.TextQuantity,
			value: clean(content.sourceString),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as TextQuantityAST;
	},

	number(child) {
		return child.toAST();
	},

	plainNumber(_1, _2, _3, _4, _5) {
		return parseNumber(this.sourceString);
	},

	mixedFraction(whole, _sp, num, _slash, den) {
		const w = parseInt(whole.sourceString, 10);
		const n = parseInt(num.sourceString, 10);
		const d = parseInt(den.sourceString, 10);
		return makeMixedFraction(w, n, d, this.sourceString);
	},

	unicodeFraction_mixed(whole, frac) {
		const w = parseInt(whole.sourceString, 10);
		const [n, d] = unicodeFractionValue(frac.sourceString);
		return makeMixedFraction(w, n, d, this.sourceString);
	},

	unicodeFraction_bare(frac) {
		const [n, d] = unicodeFractionValue(frac.sourceString);
		return makeMixedFraction(0, n, d, this.sourceString);
	},

	range(n1, _s1, _, _s2, n2) {
		const min = n1.toAST() as QuantityValueAST;
		const max = n2.toAST() as QuantityValueAST;
		return makeRange(min, max, this.sourceString);
	},

	// --- Cookware ---

	CookwareAlternative(first, _bars, rest) {
		return {
			type: ASTNodeType.Alternative,
			options: [first.toAST(), ...rest.children.map((c) => c.toAST())],
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as AlternativeAST;
	},

	simpleCookware_full(_hash, mods, name, alias, qty, prep) {
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
		} as CookwareAST;
	},

	simpleCookware_bare(_hash, mods, name, alias, prep) {
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
		} as CookwareAST;
	},

	// --- Other Elements ---

	Reference_full(_amp, _name, _qty) {
		return {
			type: ASTNodeType.Reference,
			name: _name.sourceString,
			quantity: _qty.toAST(),
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as ReferenceAST;
	},

	Reference_bare(_amp, _name) {
		return {
			type: ASTNodeType.Reference,
			name: _name.sourceString,
			quantity: null,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as ReferenceAST;
	},

	Timer(_1, passiveMod, name, qty) {
		const child = name.children[0];
		const n = child ? clean(child.sourceString) : null;
		return {
			type: ASTNodeType.Timer,
			name: n,
			quantity: qty.toAST(),
			isPassive: passiveMod.children.length > 0,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as TimerAST;
	},

	Temperature(_1, name, qty) {
		const child = name.children[0];
		const n = child ? clean(child.sourceString) : null;
		const qAST = qty.toAST();
		const base = {
			type: ASTNodeType.Temperature,
			name: n,
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		};

		if (qAST.type === ASTNodeType.TextQuantity) {
			return { ...base, text: qAST.value } as TemperatureAST;
		}
		if (qAST.type === ASTNodeType.Quantity && !qAST.value) {
			return { ...base, text: qAST.unit || "" } as TemperatureAST;
		}
		return {
			...base,
			value: qAST.value || null,
			unit: qAST.unit || null,
		} as TemperatureAST;
	},

	Comment(_1, text) {
		return {
			type: ASTNodeType.Comment,
			value: text.sourceString,
			kind: "line",
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as CommentAST;
	},
	CommentBlock(_1, text, _2) {
		return {
			type: ASTNodeType.Comment,
			value: text.sourceString,
			kind: "block",
			loc: { start: this.source.startIdx, end: this.source.endIdx },
		} as CommentAST;
	},

	_terminal() {
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

// export function parse removed. Use getAST() and then compileFromAST() from gram-compiler.
