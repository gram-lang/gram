import {
    QuantityValueAST,
    RelativeQuantityAST,
    TextQuantityAST,
    Meta
} from '@gram/parser';

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
    warnings: any[];
}

export interface Context {
    warnings: any[];
    intermediateDecl: string | null;
    seenNames: Set<string>;
    definedIntermediates: Set<string>;
    usedIntermediates: Set<string>;
    currentSectionIntermediates: Set<string>; // Track intermediates defined in the current section
    globalScopes: Map<string, string>;
}

export interface Usage {
    id: string;
    qty?: number | string | QuantityValueAST | RelativeQuantityAST | TextQuantityAST;
    unit?: string | null;
    modifiers?: string[];
    fixed?: boolean;
    alias?: string | null;
    preparation?: string | null;
    composite?: any;
    isCircular?: boolean;
    dependencies?: string[];
    formula?: {
        raw: string;
        target: string;
        percent: number;
        isGhost?: boolean;
    };
    type?: string; 
    options?: any[]; // For alternatives
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
    content: any[];
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
    registry: {
        ingredients: Record<string, RegistryEntry>;
        cookware: Record<string, { id: string; name: string }>;
    };
    shopping_list: any[];
    cookware: Usage[];
    sections: ProcessedSection[];
    warnings: any[];
    metrics: {
        preparationTime: number; // Estimated mise-en-place time
        cookTime: number;    // Critical path duration (end of last passive task)
        activeTime: number;  // Sum of cook work time
        totalTime: number;   // prepTime + cookTime
    };
}
