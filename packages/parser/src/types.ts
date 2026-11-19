export interface Location {
	start: number;
	end: number;
	// Absent for a plain single-file parse/compile. Set by the module
	// composer (`@gram-lang/modules`) on every node it splices from an
	// imported module, so a diagnostic raised on that node can say which file
	// it actually came from — the composed AST's own offsets are the host
	// document's, not the module's, so without this a diagnostic on spliced
	// content would highlight an unrelated range of the host file.
	uri?: string;
}

import type { z } from "zod";
import type { MetaSchema } from "./schemas";

export type Meta = z.infer<typeof MetaSchema>;

export enum ASTNodeType {
	Recipe = "Recipe",
	Section = "Section",
	Step = "Step",
	Comment = "Comment",
	Text = "Text",
	IntermediateDecl = "IntermediateDecl",
	RelativeQuantity = "RelativeQuantity",
	TextQuantity = "TextQuantity",
	Quantity = "Quantity",
	/** A sum of quantities, `{1 cup + 1 tbsp}`. Since 1.5.0. */
	CompoundQuantity = "CompoundQuantity",
	/** A ratio with units, `{1 / 100 g @&flour}`. Since 1.5.0. */
	RatioQuantity = "RatioQuantity",
	Ingredient = "Ingredient",
	Composite = "Composite",
	Cookware = "Cookware",
	Reference = "Reference",
	Timer = "Timer",
	Temperature = "Temperature",
	/** A target state, `={ribbon stage}`. Since 1.5.0. */
	Checkpoint = "Checkpoint",
	Alternative = "Alternative",
	ImportDecl = "ImportDecl",
}

// --- AST Nodes ---

export interface NodeAST {
	type: ASTNodeType;
	loc?: Location;
}

export interface RecipeAST extends NodeAST {
	type: ASTNodeType.Recipe;
	meta: Meta;
	// Always present (empty array when the document declares no `@use`
	// directive), populated from the `UseBlock` that sits between the
	// frontmatter and the content — never mixed into `children`.
	imports: ImportDecl[];
	// The implicit-content grammar path (`Content_implicit`, no `## Section`
	// header anywhere in the
	// source) places `Step`/`Comment` nodes directly under `Recipe`, with no
	// wrapping `Section` — `getAST("Mix @flour{200g}.\n").children[0].type`
	// is `"Step"`, not `"Section"`.
	children: (SectionAST | StepAST | CommentAST)[];
}

// --- Module imports ---

export interface ImportBinding {
	// Name as exported by the module ("default" for the unbraced `as &name`
	// form — the module has no identifier actually named "default", this is
	// a synthetic marker the module composer resolves against the module's
	// own default export).
	exported: string;
	// Name bound in the host recipe.
	local: string;
	loc?: Location;
}

export interface ImportDecl extends NodeAST {
	type: ASTNodeType.ImportDecl;
	specifier: string;
	bindings: ImportBinding[];
	retroPlanning?: RetroPlanningAST | null;
}

export interface RetroPlanningAST {
	raw: string;
	sign: 1 | -1;
	value: number | null;
	unit: string | null;
	/** Where the anchor is written, braces included (`~{-1h30}`). Since 1.5.0. */
	loc?: Location;
}

export interface SectionAST extends NodeAST {
	type: ASTNodeType.Section;
	title: string | null;
	retroPlanning?: RetroPlanningAST | null;
	intermediateDecl?: IntermediateDecl | null;
	children: (StepAST | CommentAST)[];
}

export interface StepAST extends NodeAST {
	type: ASTNodeType.Step;
	action?: string | null;
	children: (
		| TextAST
		| IngredientAST
		| CookwareAST
		| TimerAST
		| TemperatureAST
		| CheckpointAST
		| ReferenceAST
		| AlternativeAST
		| IntermediateDecl
		| CommentAST
	)[];
}

export interface CommentAST extends NodeAST {
	type: ASTNodeType.Comment;
	value: string;
	kind: "line" | "block";
}

export interface TextAST extends NodeAST {
	type: ASTNodeType.Text;
	value: string;
	fallback?: boolean;
}

export interface IntermediateDecl extends NodeAST {
	type: ASTNodeType.IntermediateDecl;
	name: string;
	/**
	 * Set by module composition when `name` is scope-qualified (e.g.
	 * `tofu$marinated`): the name as the module author wrote it.
	 */
	displayName?: string;
}

// --- Ingredients & Quantities ---

// The trailing `| string` used to collapse this union to plain `string`,
// and the semantic names it announced were
// never produced in the first place — the parser emits the raw sigils
// (`grammar.ohm`'s `modifier = "?" | "-" | "*" | "&" | "="`) untranslated;
// kitchen's own `checkModifiers`/`processIngredient` test for `"?"`/`"*"`/
// `"-"`/`"&"` literally, never the semantic names. This documents what the
// parser actually emits.
export type Modifier = "?" | "-" | "*" | "&" | "=";

// This used to be a flat interface with every field optional — `type`
// didn't actually discriminate anything, so
// `qty.range`/`qty.numerator` stayed `| undefined` even after checking
// `qty.type === "range"`. A real bug shipped because of it: analyzer's
// diff.ts once checked `qty.from`/`qty.to`, fields that never existed on any
// variant, and TypeScript had no way to catch it. The "text" variant is
// removed entirely — grep confirms no producer ever emits it (TextQuantityAST
// is the actual node type for free-text quantities, a completely separate
// AST node from this one).
export type QuantityValueAST =
	| { type: "single"; value: number; text?: string }
	| {
			type: "fraction";
			value: number;
			numerator: number;
			denominator: number;
			text?: string;
	  }
	| {
			type: "range";
			value: number;
			range: { min: number; max: number };
			text?: string;
	  };

export interface RelativeQuantityAST extends NodeAST {
	type: ASTNodeType.RelativeQuantity;
	percent: number;
	/** The percentage as written, e.g. `12,5` (so a comma can be told from a point). */
	text?: string;
	target: string;
	/**
	 * The target as its author wrote it (`pate`), when module composition
	 * renamed `target` to an internal name (`dough$pate`): for what a reader
	 * sees, never for finding the target. Omitted otherwise. Since 1.5.0.
	 */
	targetDisplayName?: string;
	referenceType: "variable" | "ingredient";
	/**
	 * A number Gram refused, as written: a fraction over zero (`1/0`,
	 * `1 1/0`). It has no value, so the element reads as if it had no
	 * number; the compiler says so. Omitted otherwise. Since 1.5.0.
	 */
	invalidNumber?: string;
}

/** One side of a ratio: `1`, `15 g`, `100 g`, `L`. Since 1.5.0. */
export interface RatioTermAST {
	/** `null` when no number is written (`/ L`, `/ @&cutlet`) or it was refused (`invalidNumber`). */
	value: QuantityValueAST | null;
	/** `null` when unitless (`1 / 100 g`). */
	unit: string | null;
	/**
	 * A number Gram refused, as written: a fraction over zero (`1/0`). Same
	 * convention as `QuantityAST.invalidNumber`. Omitted otherwise.
	 */
	invalidNumber?: string;
}

/**
 * A ratio with units, `{1 / 100 g @&flour}`: an amount per amount of a
 * target, on an ingredient, a composite parent, a reference or a timer
 * (`~{15 min / 500 g @&roast}`). Since 1.5.0.
 */
export interface RatioQuantityAST extends NodeAST {
	type: ASTNodeType.RatioQuantity;
	/**
	 * The amount per target amount. On a timer, `{ value: null, unit: null }`:
	 * the duration is read from `durationRaw`.
	 */
	numerator: RatioTermAST;
	/** The target amount: `{ value: null, unit: null }` when omitted (`1 / @&cutlet`). */
	denominator: RatioTermAST;
	/** A timer's numerator as written (`15 min`, `1:30 h`), read by `parseDuration`. Timers only. */
	durationRaw?: string;
	target: string;
	/**
	 * The target as its author wrote it (`pate`), when module composition
	 * renamed `target` to an internal name (`dough$pate`): for what a reader
	 * sees, never for finding the target. Omitted otherwise. Since 1.5.0.
	 */
	targetDisplayName?: string;
	referenceType: "variable" | "ingredient";
	/** The ratio as written between the braces, trimmed (`1 / 100 g @&flour`). */
	raw: string;
}

export interface TextQuantityAST extends NodeAST {
	type: ASTNodeType.TextQuantity;
	value: string;
}

export interface QuantityAST extends NodeAST {
	type: ASTNodeType.Quantity;
	value?: QuantityValueAST;
	unit?: string | null;
	fixed: boolean;
	/**
	 * A number Gram refused, as written: a fraction over zero (`1/0`,
	 * `1 1/0`). It has no value, so the element reads as if it had no
	 * number; the compiler says so. Omitted otherwise. Since 1.5.0.
	 */
	invalidNumber?: string;
}

/** One term of a sum of quantities: `1 cup`, `- 2 tbsp`, `+ 1-2 tsp`. Since 1.5.0. */
export interface QuantityTermAST {
	/** Set (to `true`) on a term written after `-`. */
	minus?: boolean;
	/** `null` for a number with no value (`1/0`). */
	value: QuantityValueAST | null;
	/** `null` for a term written with no unit (`{1 + 1 cup}`). */
	unit: string | null;
	/**
	 * A number Gram refused, as written: a fraction over zero (`1/0`,
	 * `1 1/0`). It has no value, so the element reads as if it had no
	 * number; the compiler says so. Omitted otherwise. Since 1.5.0.
	 */
	invalidNumber?: string;
	/** Where the term is written, its sign left out. */
	loc: Location;
}

/**
 * A sum of quantities, `{1 cup + 1 tbsp}` or `{1 cup - 2 tbsp}`: the terms in
 * the order they are written. Only an ingredient, a composite parent or a
 * reference holds one; timers and temperatures do not. Since 1.5.0.
 */
export interface CompoundQuantityAST extends NodeAST {
	type: ASTNodeType.CompoundQuantity;
	terms: QuantityTermAST[];
	/** `true` when the element carries the `=` modifier, like `QuantityAST.fixed`. */
	fixed: boolean;
	/** The sum as written between the braces, trimmed (`1 cup + 1 tbsp`). */
	raw: string;
}

export interface IngredientAST extends NodeAST {
	type: ASTNodeType.Ingredient;
	name: string;
	modifiers: Modifier[];
	quantity:
		| QuantityAST
		| CompoundQuantityAST
		| RelativeQuantityAST
		| RatioQuantityAST
		| TextQuantityAST
		| null;
	alias?: string | null;
	preparation?: string | null;
	composite?: CompositeAST | null;
}

// This used to not extend NodeAST (no `loc`) and was absent from the
// `ASTNode` union — the same was true of QuantityAST/
// TextQuantityAST/RelativeQuantityAST, which is exactly why `guards.ts` had
// to redeclare a local `QuantityValueNode` union instead of reusing
// `ASTNode`. Now carries `loc` like every other node (composite_full/
// composite_bare in index.ts set it).
export interface CompositeAST extends NodeAST {
	type: ASTNodeType.Composite;
	parent: string;
	// `composite_bare` (no `{qty}` at all) genuinely produces `null`, not
	// `undefined` — matches how every other optional-quantity field here
	// (e.g. IngredientAST.quantity) distinguishes "absent" from "not parsed".
	quantity?:
		| QuantityAST
		| CompoundQuantityAST
		| RelativeQuantityAST
		| RatioQuantityAST
		| null;
	preparation?: string | null;
}

// --- Cookware ---

export interface CookwareAST extends NodeAST {
	type: ASTNodeType.Cookware;
	name: string;
	modifiers: string[];
	alias?: string | null;
	quantity: QuantityAST;
	preparation?: string | null;
	order?: number;
}

// --- Others ---

export interface ReferenceAST extends NodeAST {
	type: ASTNodeType.Reference;
	name: string;
	/**
	 * Set by module composition when `name` is scope-qualified (e.g.
	 * `tofu$marinated`): the name as the module author wrote it.
	 */
	displayName?: string;
	quantity?:
		| QuantityAST
		| CompoundQuantityAST
		| RelativeQuantityAST
		| RatioQuantityAST
		| TextQuantityAST
		| null;
}

export interface TimerAST extends NodeAST {
	type: ASTNodeType.Timer;
	name?: string | null;
	/**
	 * The text between the braces, trimmed (`1h30`, `1:30 h`, `5'30"`). The
	 * compiler reads the duration from it; `quantity` stays for compatibility.
	 */
	raw: string;
	/**
	 * How the grammar cut the braces: a quantity for `10 min` (and `1h30`, read
	 * as 1 + unit `h30`), a ratio for a proportional time
	 * (`15 min / 500 g @&roast`, since 1.5.0), the text for anything else
	 * (`1:30 h`). Not a duration: read `raw` with `parseDuration`
	 * (@gram-lang/i18n), once `isRatioQuantity` has ruled a ratio out (its
	 * duration is in `durationRaw`).
	 */
	quantity: QuantityAST | TextQuantityAST | RatioQuantityAST;
	isPassive: boolean;
}

export interface TemperatureAST extends NodeAST {
	type: ASTNodeType.Temperature;
	name?: string | null;
	value?: QuantityValueAST | null;
	unit?: string | null;
	text?: string | null;
	/**
	 * A number Gram refused, as written: a fraction over zero (`1/0`,
	 * `1 1/0`). It has no value, so the element reads as if it had no
	 * number; the compiler says so. Omitted otherwise. Since 1.5.0.
	 */
	invalidNumber?: string;
	/**
	 * The note glued to the closing brace (`^{160°C}(fan)`), on one line.
	 * Omitted when there is none. Since 1.5.0.
	 */
	note?: string;
}

/**
 * A target state: the state that ends a step (`until ={ribbon stage}`), the
 * one technical name of which is "checkpoint". Words for the cook, in any
 * language, never read by Gram. Since 1.5.0.
 */
export interface CheckpointAST extends NodeAST {
	type: ASTNodeType.Checkpoint;
	/** The state to reach, as written between the braces, trimmed. */
	state: string;
	/**
	 * How to check it, glued to the closing brace
	 * (`={coats the spoon}(a finger leaves a clean line)`), on one line.
	 * Omitted when there is none.
	 */
	note?: string;
}

export interface AlternativeAST extends NodeAST {
	type: ASTNodeType.Alternative;
	options: (IngredientAST | CookwareAST)[];
}

export type ASTNode =
	| RecipeAST
	| SectionAST
	| StepAST
	| CommentAST
	| TextAST
	| IngredientAST
	| CompositeAST
	| CookwareAST
	| ReferenceAST
	| TimerAST
	| TemperatureAST
	| CheckpointAST
	| AlternativeAST
	| IntermediateDecl
	| QuantityAST
	| CompoundQuantityAST
	| TextQuantityAST
	| RelativeQuantityAST
	| RatioQuantityAST
	| ImportDecl;
