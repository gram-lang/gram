import { IngredientData } from './types';
import { slugify } from '@gram/compiler'; 

export function getIngredientData(name: string, database: Record<string, IngredientData>): IngredientData | null {
    const slug = slugify(name);
    
    // Direct match
    if (database[slug]) return database[slug];
    
    // Simple singularization fallback (very naive)
    if (slug.endsWith('s') && database[slug.slice(0, -1)]) {
        return database[slug.slice(0, -1)];
    }

    return null;
}
