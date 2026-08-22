import type {
	QuantityValueAST,
	RelativeQuantityAST,
	TextQuantityAST,
	Meta,
	ImportDecl,
} from "@gram-lang/parser";
import type { Warning } from "./warnings";
import type { ShoppingListItem, CompositeItem } from "./shopping";

// The compiled-JSON shape kept on a Usage for its composite-child info
// (`@juice{150ml}<@lemon{1}`) — deliberately narrower than the parser's
// CompositeAST: createCleanUsage() (utils.ts) strips AST-only fields
// (`type`, `loc`) when copying from the AST node, so reusing CompositeAST
// here would claim fields this shape never actually carries.
export interface UsageComposite {
	// Always set — CompositeAST.parent is a mandatory, non-empty grammar
	// capture (`<@parentname`); createCleanUsage's `if (item.composite.parent)`
	// guard is defensive, not a real "might be absent" case.
	parent: string;
	quantity?: number | QuantityValueAST;
	unit?: string;
	preparation?: string;
}

export interface RegistryEntry {
	id: string;
	name: string;
	default_unit?: string | null;
	is_composite?: boolean;
	parent?: string;
	is_intermediate?: boolean;
	// Set only on a leaf synthesized by the module composer for a `--stock`ed
	// `@use` import (module-imports RFC, "stock" mechanism) — consulted only
	// by `db-sync.ts`'s DB-export exclusion, so this per-recipe synthetic
	// nutrition profile never leaks into the shared `ingredients.yaml`.
	is_module_synthetic?: boolean;
}

// `ast.imports` entries that never resolved into a splice — either genuinely
// unresolved (`MODULE_NOT_FOUND`, degraded registration in processor.ts) or,
// since the "stock" mechanism, a successfully-resolved-but-deliberately-
// unspliced `--stock`ed import. `registryKind`/`title` are set only by
// `@gram-lang/modules`'s composer, post-resolution — the parser itself never
// produces either field.
export interface DeferredImport extends ImportDecl {
	// Which `RegistryEntry` shape processSections' §C.4 degraded-registration
	// path should synthesize for each of this import's bindings, and whether
	// it should raise `MODULE_NOT_FOUND` — kitchen's own vocabulary for a hint
	// the composer already knows, rather than kitchen re-deriving it from a
	// module-specific "stocked" flag. Absent means "nothing more is known
	// about this import" (raw parser output — no composition ran, or this one
	// specifically never resolved): treated the same as `"intermediate"`.
	registryKind?: "intermediate" | "module_synthetic";
	title?: string | null;
}

export interface Registry {
	ingredients: Map<string, RegistryEntry>;
	cookware: Map<string, { id: string; name: string }>;
	warnings: Warning[];
}

export interface Context {
	warnings: Warning[];
	intermediateDecl: string | null;
	seenNames: Set<string>;
	definedIntermediates: Set<string>;
	usedIntermediates: Set<string>;
	currentSectionIntermediates: Set<string>;
	globalScopes: Map<string, string>;
	// Per-compilation counter for `_usageId` — must be created fresh for every
	// compile() call so ids stay deterministic and never leak across compilations.
	usageCounter: { value: number };
}

export interface Usage {
	id: string;
	qty?:
		| number
		| string
		| QuantityValueAST
		| RelativeQuantityAST
		| TextQuantityAST;
	unit?: string | null;
	modifiers?: string[];
	fixed?: boolean;
	alias?: string | null;
	preparation?: string | null;
	composite?: UsageComposite | null;
	isCircular?: boolean;
	dependencies?: string[];
	formula?: {
		raw: string;
		target: string;
		percent: number;
		isGhost?: boolean;
	};
	type?: string;
	options?: StepToken[]; // For alternatives — recursively processed block results, not raw AST
	name?: string;
	_usageId?: string;
	normalizedMass?: number;
	conversionMethod?: string;
	isEstimate?: boolean;
	purchasingMass?: number;
	// Set by @gram-lang/analyzer, not by kitchen itself — declared here like
	// the other analyzer-added fields above, since analyze() enriches the
	// same Usage objects in place rather than producing a separate type.
	bakersPercentage?: number;
}

export interface ProcessedComment {
	type: "comment";
	value: string;
	kind: "line" | "block";
}

export interface ProcessedDeclaration {
	type: "declaration";
	name: string;
	id: string;
}

export interface ProcessedTimer {
	type: "timer";
	name?: string;
	isPassive?: boolean;
	quantity?: number | string | QuantityValueAST;
	unit?: string;
}

export interface ProcessedTemperature {
	type: "temperature";
	name?: string;
	text?: string;
	quantity?: QuantityValueAST;
	unit?: string;
}

/**
 * `unit`/`sign`/`value`/`minutes` are only present when the section's
 * `~{...}` annotation resolved to a valid signed duration; an unrecognized
 * unit or free text degrades to `{ raw }` only (still displayable, but
 * flagged via a MISSING_UNIT/INVALID_UNIT warning — see processRetroPlanning
 * in processor.ts).
 */
export interface RetroPlanning {
	raw: string;
	sign?: 1 | -1;
	value?: number;
	unit?: "d" | "h" | "min";
	minutes?: number;
}

/**
 * A single element inside a processed step's `content` array. Plain narrative
 * text is a bare `string`; ingredients/cookware/references/alternatives share
 * the `Usage` shape (distinguished by their optional `.type`); everything else
 * carries its own `type` discriminant. These are the compiler's actual output
 * tokens — a deliberately separate, lowercase vocabulary from the parser's
 * PascalCase `ASTNodeType` (which only describes the input AST).
 */
export type StepToken =
	| string
	| Usage
	| ProcessedDeclaration
	| ProcessedTimer
	| ProcessedTemperature
	| ProcessedComment;

export interface ProcessedStep {
	type: "step";
	action?: string; // The explicit action verb (e.g. "Mix")
	// Gantt Data
	timings: {
		start: number; // Global start time (in minutes, relative to T=0)
		end: number; // Global end time (when the cook is free)
		activeDuration: number; // How long the cook is blocked on this step
	};
	backgroundTasks: Array<{
		name?: string; // E.g., "baking" or the timer name
		duration: number; // In minutes
		startOffset: number; // Relative to step start
	}>;
	content: StepToken[];
	intermediate_preparation?: string;
}

export type ProcessedStepItem = ProcessedStep | ProcessedComment;

export interface ProcessedSection {
	title: string | null;
	ingredients: Usage[];
	cookware: Usage[];
	steps: ProcessedStepItem[];
	intermediate_preparation?: string;
	retro_planning?: RetroPlanning | null;
}

export interface TimeBreakdownItem {
	label: string;
	duration: number; // in minutes
}

export interface CompilationResult {
	title: string | null;
	slug: string | null;
	meta: Meta;
	scaleFactor?: number;
	registry: {
		ingredients: Record<string, RegistryEntry>;
		cookware: Record<string, { id: string; name: string }>;
	};
	shopping_list: (ShoppingListItem | CompositeItem | Usage)[];
	cookware: Usage[];
	sections: ProcessedSection[];
	warnings: Warning[];
	metrics: {
		preparationTime: number; // Estimated mise-en-place time
		activeTime: number; // Sum of blocking work time (default step durations + active timers)
		idleTime: number; // Duration of passive background tasks / waiting
		totalTime: number; // preparationTime + activeTime + idleTime
		activeBreakdown: TimeBreakdownItem[]; // Added for exact tooltip calculation
		prepBreakdown: TimeBreakdownItem[];
		totalBreakdown: TimeBreakdownItem[]; // The critical path
	};
}
