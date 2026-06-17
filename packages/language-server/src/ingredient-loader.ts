import { parse } from 'yaml';
import { readFileSync, existsSync } from 'fs';
import { slugify } from '@gram/compiler';

export interface IngredientPhysical {
    density?: number;
    yield?: number;
    unit_weight?: number;
}

export interface IngredientNutrition {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar?: number;
    sat_fat?: number;
    mono_fat?: number;
    poly_fat?: number;
    fiber?: number;
    sodium?: number;
    alcohol?: number;
}

export interface IngredientEntry {
    name: string;
    aliases?: string[];
    tags?: string[];
    physical?: IngredientPhysical;
    nutrition?: IngredientNutrition;
}

export type IngredientDB = Record<string, IngredientEntry>;

export function loadIngredientDB(yamlPath: string): IngredientDB {
    if (!existsSync(yamlPath)) return {};
    try {
        const content = readFileSync(yamlPath, 'utf-8');
        const parsed = parse(content) as { ingredients?: Record<string, IngredientEntry> };
        return parsed?.ingredients ?? (parsed as unknown as IngredientDB) ?? {};
    } catch {
        return {};
    }
}

export function lookupIngredient(name: string, db: IngredientDB): IngredientEntry | null {
    if (Object.keys(db).length === 0) return null;
    const slug = slugify(name);

    // Direct match by slug key
    if (db[slug]) return db[slug];

    // Naive singularization
    if (slug.endsWith('s') && db[slug.slice(0, -1)]) return db[slug.slice(0, -1)];

    // Search by name or aliases (case-insensitive)
    const nameLower = name.toLowerCase();
    for (const entry of Object.values(db)) {
        if (entry.name.toLowerCase() === nameLower) return entry;
        if (entry.aliases?.some(a => a.toLowerCase() === nameLower)) return entry;
    }

    return null;
}

export function allIngredientCompletionLabels(db: IngredientDB): Array<{ label: string; canonical: string; entry: IngredientEntry }> {
    const results: Array<{ label: string; canonical: string; entry: IngredientEntry }> = [];
    for (const entry of Object.values(db)) {
        results.push({ label: entry.name, canonical: entry.name, entry });
        for (const alias of entry.aliases ?? []) {
            results.push({ label: alias, canonical: entry.name, entry });
        }
    }
    return results;
}
