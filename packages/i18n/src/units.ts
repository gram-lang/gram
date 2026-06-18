import { compileDictionary, LanguageDict } from './dictionary';

const en: LanguageDict = {
    // Volume — spoons
    tsp:   ['teaspoon', 'teaspoons'],
    tbsp:  ['tablespoon', 'tablespoons'],
    // Volume — cups & imperial
    cup:   ['cups'],
    pt:    ['pint', 'pints'],
    qt:    ['quart', 'quarts'],
    'fl oz': ['floz', 'fl. oz.', 'fluid ounce', 'fluid ounces'],
    // Volume — metric
    ml:    ['milliliter', 'milliliters'],
    cl:    ['centiliter', 'centiliters'],
    dl:    ['deciliter', 'deciliters'],
    l:     ['liter', 'liters'],
    // Weight — metric
    mg:    ['milligram', 'milligrams'],
    g:     ['gram', 'grams'],
    kg:    ['kilo', 'kilos', 'kilogram', 'kilograms'],
    // Weight — imperial
    oz:    ['ounce', 'ounces'],
    lb:    ['lbs', 'pound', 'pounds'],
};

const fr: LanguageDict = {
    // Volume — cuillères
    tsp:   ['càc', 'cac', 'c.à.c', 'cuillère à café', 'cuillères à café', 'cuillere a cafe', 'cuilleres a cafe'],
    tbsp:  ['càs', 'cas', 'c.à.s', 'cuillère à soupe', 'cuillères à soupe', 'cuillere a soupe', 'cuilleres a soupe'],
    // Volume — tasse & mesures anglo-saxonnes
    cup:   ['tasse', 'tasses'],
    pt:    ['pinte', 'pintes'],
    qt:    ['quart', 'quarts'],
    'fl oz': ['once liquide', 'onces liquides'],
    // Volume — métrique
    ml:    ['millilitre', 'millilitres'],
    cl:    ['centilitre', 'centilitres'],
    dl:    ['décilitre', 'décilitres', 'decilitre', 'decilitres'],
    l:     ['litre', 'litres'],
    // Poids — métrique
    mg:    ['milligramme', 'milligrammes'],
    g:     ['gramme', 'grammes'],
    kg:    ['kilo', 'kilos', 'kilogramme', 'kilogrammes'],
    // Poids — impérial
    oz:    ['once', 'onces'],
    lb:    ['livre', 'livres'],
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
