export interface Location {
    start: number;
    end: number;
}

import { z } from 'zod';
import { MetaSchema } from './schemas';

export type Meta = z.infer<typeof MetaSchema>;

export enum ASTNodeType {
    Recipe = 'Recipe',
    Section = 'Section',
    Step = 'Step',
    Comment = 'Comment',
    Text = 'Text',
    IntermediateDecl = 'IntermediateDecl',
    RelativeQuantity = 'RelativeQuantity',
    TextQuantity = 'TextQuantity',
    Quantity = 'Quantity',
    Ingredient = 'Ingredient',
    Composite = 'Composite',
    Cookware = 'Cookware',
    Reference = 'Reference',
    Timer = 'Timer',
    Temperature = 'Temperature',
    Alternative = 'Alternative'
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

export interface SectionAST extends NodeAST {
    type: ASTNodeType.Section;
    title: string | null;
    retroPlanning?: string | null;
    intermediateDecl?: IntermediateDecl | null;
    children: (StepAST | CommentAST)[];
}

export interface StepAST extends NodeAST {
    type: ASTNodeType.Step;
    action?: string | null;
    children: (TextAST | IngredientAST | CookwareAST | TimerAST | TemperatureAST | ReferenceAST | AlternativeAST | IntermediateDecl | CommentAST)[];
}


export interface CommentAST extends NodeAST {
    type: ASTNodeType.Comment;
    value: string;
    kind: 'line' | 'block';
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

export type Modifier = 'optional' | 'hidden' | 'reference' | 'bakers_percentage' | string;

export interface QuantityValueAST {
    type: 'single' | 'fraction' | 'range' | 'text';
    value: number | string;
    text?: string;
    range?: { min: number; max: number };
    numerator?: number;
    denominator?: number;
}

export interface RelativeQuantityAST extends NodeAST {
    type: ASTNodeType.RelativeQuantity;
    percent: number;
    target: string;
    referenceType: 'variable' | 'ingredient';
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
    isAsync: boolean;
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

// --- Compiler Internal Types ---

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
        totalTime: number;   // Critical path duration (end of last async task)
        activeTime: number;  // Sum of cook work time
        preparationTime: number; // Estimated mise-en-place time
    };
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

