import { RecipeAST, CompilationResult } from 'gram-parser';
export { configureIngredientDb } from './ingredient_db';
export interface CompilerOptions {
    enableMassNormalization?: boolean;
    enableYieldManagement?: boolean;
    enableNutritionalEstimation?: boolean;
}
export declare function compile(ast: RecipeAST, options?: CompilerOptions): CompilationResult;
