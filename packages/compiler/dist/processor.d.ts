import { Context, Registry, ProcessedSection, Usage } from '@gram/parser';
import { CompilerOptions } from './core';
export interface ProcessorContext extends Context {
    options?: CompilerOptions;
}
/**
 * Processes a single AST item inside a recipe step.
 * Identifies the node type (Ingredient, Cookware, Reference, Timer, etc.), normalizes its properties,
 * pushes it to the local section list, and checks for validation errors (ghosts, circularity).
 */
export declare function processBlockItem(item: any, ctx: ProcessorContext, registry: Registry, secIngredients: Usage[], secCookware: Usage[]): Usage | null | string;
/**
 * Main structural step/section processor.
 * Builds global scopes, registers intermediate recipe variables, schedules steps,
 * handles async background tasks, and calculates active and total duration metrics.
 */
export declare function processSections(astChildren: any[], registry: Registry, options?: CompilerOptions): {
    sections: ProcessedSection[];
    metrics: {
        totalTime: number;
        activeTime: number;
    };
};
