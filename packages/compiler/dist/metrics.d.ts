import { Usage, MassMetrics, ProcessedSection, Registry } from 'gram-parser';
export declare function calculateMassMetrics(ingredients: Usage[]): MassMetrics;
export declare function calculatePreparationTime(sections: ProcessedSection[], registry: Registry): number;
