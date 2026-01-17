import { DEFAULT_SOURCES } from './ingredients/default_db';
import { configureIngredientDb } from './ingredient_db';
export * from './core';

// Initialize default DB for standard usage
configureIngredientDb(DEFAULT_SOURCES);
