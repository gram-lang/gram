import { RecipeAST, CompilationResult } from 'gram-parser';
export { configureIngredientDb } from './ingredient_db';
export declare function compile(ast: RecipeAST): CompilationResult;
