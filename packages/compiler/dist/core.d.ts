import { RecipeAST, CompilationResult } from '@gram/parser';
export interface CompilerOptions {
}
/**
 * Main entry point of the Gram compiler.
 * Transforms a raw Recipe AST into a clean, structured CompilationResult
 * by compiling sections, generating the shopping list, and calculating preparation times.
 */
export declare function compile(ast: RecipeAST, options?: CompilerOptions): CompilationResult;
