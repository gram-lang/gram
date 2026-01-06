export interface Location {
    start: number;
    end: number;
}
export interface Meta {
    [key: string]: string | string[];
}
export interface NodeAST {
    type: string;
    loc?: Location;
}
export interface RecipeAST extends NodeAST {
    type: 'Recipe';
    meta: Meta;
    children: SectionAST[];
}
export interface SectionAST extends NodeAST {
    type: 'Section';
    title: string | null;
    retroPlanning?: string | null;
    intermediateDecl?: IntermediateDecl | null;
    children: (StepAST | CommentAST)[];
}
export interface StepAST extends NodeAST {
    type: 'Step';
    action?: string | null;
    children: (TextAST | IngredientAST | CookwareAST | TimerAST | TemperatureAST | ReferenceAST | AlternativeAST)[];
}
export interface CommentAST extends NodeAST {
    type: 'Comment';
    value: string;
    kind: 'line' | 'block';
}
export interface TextAST extends NodeAST {
    type: 'Text';
    value: string;
    fallback?: boolean;
}
export interface IntermediateDecl {
    type: 'IntermediateDecl';
    name: string;
}
export type Modifier = 'optional' | 'hidden' | 'reference' | 'bakers_percentage' | string;
export interface QuantityValueAST {
    type: 'single' | 'fraction' | 'range' | 'text';
    value: number | string;
    text?: string;
    range?: {
        min: number;
        max: number;
    };
    numerator?: number;
    denominator?: number;
}
export interface RelativeQuantityAST extends NodeAST {
    type: 'RelativeQuantity';
    percent: number;
    target: string;
    referenceType: 'variable' | 'ingredient';
}
export interface TextQuantityAST extends NodeAST {
    type: 'TextQuantity';
    value: string;
}
export interface QuantityAST extends NodeAST {
    type: 'Quantity';
    value?: QuantityValueAST;
    unit?: string | null;
    fixed: boolean;
}
export interface IngredientAST extends NodeAST {
    type: 'Ingredient';
    name: string;
    modifiers: Modifier[];
    quantity: QuantityAST | RelativeQuantityAST | TextQuantityAST | null;
    alias?: string | null;
    preparation?: string | null;
    composite?: CompositeAST | null;
}
export interface CompositeAST {
    type: 'Composite';
    parent: string;
    quantity?: QuantityAST;
}
export interface CookwareAST extends NodeAST {
    type: 'Cookware';
    name: string;
    modifiers: string[];
    alias?: string | null;
    quantity: QuantityAST;
    preparation?: string | null;
    order?: number;
}
export interface ReferenceAST extends NodeAST {
    type: 'Reference';
    name: string;
    quantity?: QuantityAST | TextQuantityAST | null;
}
export interface TimerAST extends NodeAST {
    type: 'Timer';
    name?: string | null;
    quantity: QuantityAST | TextQuantityAST;
    isAsync: boolean;
}
export interface TemperatureAST extends NodeAST {
    type: 'Temperature';
    name?: string | null;
    quantity: QuantityAST | TextQuantityAST;
}
export interface AlternativeAST extends NodeAST {
    type: 'Alternative';
    options: (IngredientAST | CookwareAST)[];
}
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
    cookware: Map<string, {
        id: string;
        name: string;
    }>;
    warnings: any[];
}
export interface VariableWeight {
    mass: number;
    isPartial: boolean;
}
export interface Context {
    warnings: any[];
    intermediateDecl: string | null;
    seenNames: Set<string>;
    definedIntermediates: Set<string>;
    usedIntermediates: Set<string>;
    variableWeights: Map<string, VariableWeight>;
    globalScopes: Map<string, string>;
    densityOverrides: Record<string, number>;
}
export interface Usage {
    id: string;
    qty?: number | string | QuantityValueAST;
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
    options?: any[];
    name?: string;
    normalizedMass?: number;
    conversionMethod?: 'physical' | 'density' | 'unit_weight' | 'default' | 'explicit';
    isEstimate?: boolean;
}
export interface MassMetrics {
    totalMass: number;
    massStatus: 'precise' | 'estimated' | 'incomplete';
    missingMassIngredients: string[];
}
export interface NutritionMetrics {
    total: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        sugar?: number;
        fiber?: number;
        salt?: number;
    };
    perPortion?: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        sugar?: number;
        fiber?: number;
        salt?: number;
    };
    isEstimate: boolean;
    coverage: number;
}
export interface ProcessedSection {
    title: string | null;
    ingredients: Usage[];
    cookware: Usage[];
    steps: ProcessedStep[];
    intermediate_preparation?: string;
    retro_planning?: string | null;
    metrics?: MassMetrics;
}
export interface ProcessedStep {
    type: 'step';
    value: string;
    action?: string;
    timings: {
        start: number;
        end: number;
        activeDuration: number;
    };
    backgroundTasks: Array<{
        name?: string;
        duration: number;
        startOffset: number;
    }>;
    content: any[];
}
export interface CompilationResult {
    title: string | null;
    slug: string | null;
    meta: Meta;
    registry: {
        ingredients: Record<string, RegistryEntry>;
        cookware: Record<string, {
            id: string;
            name: string;
        }>;
    };
    shopping_list: any[];
    cookware: Usage[];
    sections: ProcessedSection[];
    warnings: any[];
    metrics: {
        totalTime: number;
        activeTime: number;
        preparationTime: number;
        nutrition?: NutritionMetrics;
    } & MassMetrics;
}
