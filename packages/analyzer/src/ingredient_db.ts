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

    // Check aliases
    const lowerName = name.toLowerCase();
    for (const entry of Object.values(database)) {
        if (entry.name && entry.name.toLowerCase() === lowerName) return entry;
        if (entry.aliases && entry.aliases.some(a => a.toLowerCase() === lowerName)) return entry;
    }

    return null;
}
