import { ProcessedSection } from '@gram/parser';
/**
 * Runs a Cycle Detection algorithm on the recipe graph using DFS.
 *
 * Tracks dependencies between ingredients (especially for relative quantities)
 * and returns a set of ingredient IDs involved in circular references.
 */
export declare function detectCycles(sections: ProcessedSection[]): Set<string>;
