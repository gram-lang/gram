export interface Location {
    start: number;
    end: number;
}

import type { z } from 'zod';
import type { MetaSchema } from './schemas';

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

