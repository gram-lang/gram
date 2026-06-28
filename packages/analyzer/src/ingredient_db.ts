import { IngredientData } from './types';
import { slugify } from '@gram/kitchen'; 

export function getIngredientData(name: string, database: Record<string, IngredientData>): IngredientData | null {
    const slug = slugify(name);
    
    // Direct match
    const direct = database[slug];
    if (direct) return direct;
    
    // Check aliases using a lazily built index
    if (!(database as any).__aliasIndex) {
        const index = new Map<string, IngredientData>();
        for (const entry of Object.values(database)) {
            if (entry.name) index.set(entry.name.toLowerCase(), entry);
            if (entry.aliases) {
                entry.aliases.forEach(a => index.set(a.toLowerCase(), entry));
            }
        }
        Object.defineProperty(database, '__aliasIndex', { value: index, enumerable: false, writable: true });
    }
    
    const index = (database as any).__aliasIndex as Map<string, IngredientData>;
    return index.get(name.toLowerCase()) || index.get(slug) || null;
}
