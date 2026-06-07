import { Usage, QuantityValueAST } from '@gram/parser';
import { CompilerOptions } from './core';
/**
 * Normalizes user-inputted strings (like ingredient names) into URL-friendly,
 * standard alphanumeric identifiers (slugs).
 *
 * Used globally to generate robust keys/IDs (e.g., "basmati-rice" from "Basmati Rice")
 * to ensure reliable lookups and comparisons across ingredients and databases.
 */
export declare const slugify: (text: string | number) => string;
/**
 * Simplifies complex parsed Quantity AST structures into compact JSON-friendly formats.
 *
 * Extract raw numbers from simple single-value nodes, or preserve ranges and fractions
 * as clean objects. Explicitly ignores RelativeQuantities since their evaluation is
 * deferred to the analyzer.
 */
export declare const minifyQuantity: (q: any) => number | QuantityValueAST | undefined;
/**
 * Standardizes a raw step/section ingredient or cookware item into a clean, unified `Usage` object.
 *
 * Maps modifier symbols (?, -, &, *) to semantic names, handles fixed quantity states,
 * extracts cleaned quantities/units, and retains metadata like parent composite scopes or custom aliases.
 */
export declare const createCleanUsage: (item: any, id: string, options?: CompilerOptions) => Usage;
/**
 * Recursively cleans a compiled output object by removing `null` and `undefined` properties.
 *
 * Retains empty arrays for structural core fields (`ingredients`, `cookware`, `steps`, `sections`, etc.)
 * to preserve a guaranteed API schema for consumers (avoiding undefined references),
 * while stripping other empty arrays to keep the JSON output lightweight and neat.
 */
export declare const cleanObject: (obj: any) => any;
/**
 * Converts a recipe time quantity AST (timer or active duration) into a unified number of minutes.
 *
 * Supports ranges (takes the average), simple numbers, and fractions, and performs
 * conversions from hours ('h') or seconds ('s') based on the resolved time unit.
 */
export declare const quantityToMinutes: (qty: any) => number;
