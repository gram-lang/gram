import { RecipeAST, Context, Registry, CompilationResult, Usage } from 'gram-parser';
export { configureIngredientDb } from './ingredient_db';
export declare function processBlockItem(item: any, ctx: Context, registry: Registry, secIngredients: Usage[], secCookware: Usage[]): Usage | null | string;
export declare function compile(ast: RecipeAST): CompilationResult;
