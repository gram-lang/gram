import type { Registry, RegistryEntry } from './types';
import { slugify } from './utils';

// Strip punctuation that bleeds into bare element names (e.g. #saucepan, or @salt.)
const cleanRegistryName = (name: string) => name.trim().replace(/[,;!?.]+$/, '');

export class RecipeRegistry implements Registry {
    ingredients = new Map<string, RegistryEntry>();
    cookware = new Map<string, { id: string; name: string }>();
    warnings: any[] = [];

    constructor(initialWarnings: any[] = []) {
        this.warnings = initialWarnings;
    }

    registerIngredient(name: string, data?: Partial<Omit<RegistryEntry, 'id' | 'name'>>): string {
        const cleanedName = cleanRegistryName(name);
        const id = slugify(cleanedName);
        const existing = this.ingredients.get(id);
        if (!existing) {
            this.ingredients.set(id, { id, name: cleanedName, ...data } as RegistryEntry);
        } else if (data) {
            if (data.default_unit && !existing.default_unit) {
                existing.default_unit = data.default_unit;
            }
            if (data.is_composite) existing.is_composite = true;
            if (data.parent) existing.parent = data.parent;
            if (data.is_intermediate) existing.is_intermediate = true;
        }
        return id;
    }

    registerCookware(name: string): string {
        const cleanedName = cleanRegistryName(name);
        const id = slugify(cleanedName);
        if (!this.cookware.has(id)) {
            this.cookware.set(id, { id, name: cleanedName });
        }
        return id;
    }

    getIngredientId(name: string): string {
        return slugify(name);
    }

    toPlainObject() {
        return {
            ingredients: Object.fromEntries(this.ingredients),
            cookware: Object.fromEntries(this.cookware)
        };
    }
}
