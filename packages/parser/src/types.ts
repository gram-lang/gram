export interface Location {
	start: number;
	end: number;
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
}

// --- AST Nodes ---

export interface NodeAST {
	type: ASTNodeType;
	loc?: Location;
}

export interface RecipeAST extends NodeAST {
	type: ASTNodeType.Recipe;
	meta: Meta;
	children: SectionAST[];
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

export type Modifier =
	| "optional"
	| "hidden"
	| "reference"
	| "bakers_percentage"
	| string;

// Audit 2026-07-22, parser finding I4: this used to be a flat interface with
// every field optional — `type` didn't actually discriminate anything, so
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

export interface CompositeAST {
	type: ASTNodeType.Composite;
	parent: string;
	quantity?: QuantityAST;
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
	| CookwareAST
	| ReferenceAST
	| TimerAST
	| TemperatureAST
	| AlternativeAST
	| IntermediateDecl;
