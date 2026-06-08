import { compileDictionary, LanguageDict } from './dictionary';

const en: LanguageDict = {
    tsp: ['teaspoon', 'teaspoons'],
    tbsp: ['tablespoon', 'tablespoons'],
    g: ['gram', 'grams'],
    kg: ['kilo', 'kilos', 'kilogram', 'kilograms'],
    l: ['liter', 'liters'],
    ml: ['milliliter', 'milliliters']
};

const fr: LanguageDict = {
    tsp: ['càc', 'cac', 'c.à.c', 'cuillère à café', 'cuillères à café', 'cuillere a cafe', 'cuilleres a cafe'],
    tbsp: ['càs', 'cas', 'c.à.s', 'cuillère à soupe', 'cuillères à soupe', 'cuillere a soupe', 'cuilleres a soupe'],
    g: ['gramme', 'grammes'],
    kg: ['kilo', 'kilos', 'kilogramme', 'kilogrammes'],
    l: ['litre', 'litres'],
    ml: ['millilitre', 'millilitres']
};

export const UNIT_DICTIONARIES = { en, fr };
export const { byLang: UNIT_BY_LANG, global: UNIT_GLOBAL } = compileDictionary(UNIT_DICTIONARIES);

/**
 * Normalizes a raw string unit into a standard canon unit.
 * Examples: 'càs' -> 'tbsp', 'kilo' -> 'kg'.
 */
export function normalizeUnit(rawUnit: string | undefined | null, lang?: string): string {
    if (!rawUnit) return '';
    const clean = rawUnit.toLowerCase().trim();
    
    if (lang && UNIT_BY_LANG[lang] && UNIT_BY_LANG[lang][clean]) {
        return UNIT_BY_LANG[lang][clean];
    }
    
    return UNIT_GLOBAL[clean] || clean;
}
