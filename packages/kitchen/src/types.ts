import type {
    QuantityValueAST,
    RelativeQuantityAST,
    TextQuantityAST,
    CompositeAST,
    Meta
} from '@gram-lang/parser';
import type { Warning } from './warnings';
import type { ShoppingListItem, CompositeItem } from './shopping';

export interface RegistryEntry {
    id: string;
    name: string;
    default_unit?: string | null;
    is_composite?: boolean;
    parent?: string;
    is_intermediate?: boolean;
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
    currentSectionIntermediates: Set<string>; // Track intermediates defined in the current section
    globalScopes: Map<string, string>;
    // Per-compilation counter for `_usageId` — must be created fresh for every
    // compile() call so ids stay deterministic and never leak across compilations.
    usageCounter: { value: number };
}

export interface Usage {
    id: string;
    qty?: number | string | QuantityValueAST | RelativeQuantityAST | TextQuantityAST;
    unit?: string | null;
    modifiers?: string[];
    fixed?: boolean;
    alias?: string | null;
    preparation?: string | null;
    composite?: CompositeAST | null;
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
    name?: string; // Optional name cache
    _usageId?: string;
    normalizedMass?: number;
    conversionMethod?: string;
    isEstimate?: boolean;
    purchasingMass?: number;
}

export interface ProcessedComment {
    type: 'comment';
    value: string;
    kind: 'line' | 'block';
}

export interface ProcessedDeclaration {
    type: 'declaration';
    name: string;
    id: string;
}

export interface ProcessedTimer {
    type: 'timer';
    name?: string;
    isPassive?: boolean;
    quantity?: number | string | QuantityValueAST;
    unit?: string;
}

export interface ProcessedTemperature {
    type: 'temperature';
    name?: string;
    text?: string;
    quantity?: QuantityValueAST;
    unit?: string;
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
    type: 'step';
    action?: string; // The explicit action verb (e.g. "Mix")
    // Gantt Data
    timings: {
        start: number;       // Global start time (in minutes, relative to T=0)
        end: number;         // Global end time (when the cook is free)
        activeDuration: number; // How long the cook is blocked on this step
    };
    // Tasks running in background started during this step
    backgroundTasks: Array<{
        name?: string;       // E.g., "baking" or the timer name
        duration: number;    // In minutes
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
    retro_planning?: string | null;
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
        cookTime: number;    // Critical path duration (end of last passive task)
        activeTime: number;  // Sum of cook work time
        totalTime: number;   // prepTime + cookTime
    };
}
