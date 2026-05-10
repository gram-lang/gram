import { Context, Registry, ProcessedSection, Usage } from 'gram-parser';
import { CompilerOptions } from './core';
export interface ProcessorContext extends Context {
    options?: CompilerOptions;
}
export declare function processBlockItem(item: any, ctx: ProcessorContext, registry: Registry, secIngredients: Usage[], secCookware: Usage[]): Usage | null | string;
export declare function processSections(astChildren: any[], registry: Registry, overrides?: Record<string, number>, options?: CompilerOptions): {
    sections: ProcessedSection[];
    metrics: {
        totalTime: number;
        activeTime: number;
    };
};
