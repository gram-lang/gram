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
	Ingredient = "Ingredient",
	Composite = "Composite",
	Cookware = "Cookware",
	Reference = "Reference",
	Timer = "Timer",
	Temperature = "Temperature",
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
	target: string;
	referenceType: "variable" | "ingredient";
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
}

export interface IngredientAST extends NodeAST {
	type: ASTNodeType.Ingredient;
	name: string;
	modifiers: Modifier[];
	quantity: QuantityAST | RelativeQuantityAST | TextQuantityAST | null;
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
	quantity?: QuantityAST | null;
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
	quantity?: QuantityAST | TextQuantityAST | null;
}

export interface TimerAST extends NodeAST {
	type: ASTNodeType.Timer;
	name?: string | null;
	quantity: QuantityAST | TextQuantityAST;
	isPassive: boolean;
}

export interface TemperatureAST extends NodeAST {
	type: ASTNodeType.Temperature;
	name?: string | null;
	value?: QuantityValueAST | null;
	unit?: string | null;
	text?: string | null;
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
	| AlternativeAST
	| IntermediateDecl
	| QuantityAST
	| TextQuantityAST
	| RelativeQuantityAST
	| ImportDecl;
