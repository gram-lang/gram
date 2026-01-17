import { Context, Registry, ProcessedSection, Usage } from 'gram-parser';
export declare function processBlockItem(item: any, ctx: Context, registry: Registry, secIngredients: Usage[], secCookware: Usage[]): Usage | null | string;
export declare function processSections(astChildren: any[], registry: Registry, overrides?: Record<string, number>): {
    sections: ProcessedSection[];
    metrics: {
        totalTime: number;
        activeTime: number;
    };
};
