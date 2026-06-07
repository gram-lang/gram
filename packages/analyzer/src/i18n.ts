

// Unit Translations
export const UNIT_ALIASES: Record<string, string> = {
    // Volume & Mass - FR
    'càc': 'tsp', 'cac': 'tsp', 'c.à.c': 'tsp', 'cuillère à café': 'tsp', 'cuillères à café': 'tsp', 'cuillere a cafe': 'tsp', 'cuilleres a cafe': 'tsp',
    'càs': 'tbsp', 'cas': 'tbsp', 'c.à.s': 'tbsp', 'cuillère à soupe': 'tbsp', 'cuillères à soupe': 'tbsp', 'cuillere a soupe': 'tbsp', 'cuilleres a soupe': 'tbsp',
    'gramme': 'g', 'grammes': 'g',
    'kilo': 'kg', 'kilos': 'kg',
    'litre': 'l', 'litres': 'l'
};

export function resolveUnit(unit: string | undefined | null): string {
    if (!unit) return '';
    const lower = unit.toLowerCase().trim();
    return UNIT_ALIASES[lower] || lower;
}
