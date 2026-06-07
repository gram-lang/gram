type StateDefinition = Record<string, string[]>; // key: lang (en, fr), value: aliases

const STATE_DEFINITIONS: Record<string, StateDefinition> = {
    'canned': {
        'en': ['canned'],
        'fr': ['conserve', 'boite', 'boîte', 'bocal']
    },
    'dried': {
        'en': ['dried'],
        'fr': ['sec', 'séché']
    },
    'frozen': {
        'en': ['frozen'],
        'fr': ['surgelé', 'congelé']
    },
    'cooked': {
        'en': ['cooked'],
        'fr': ['cuit']
    },
    'default': {
        'en': ['raw', 'fresh'],
        'fr': ['cru', 'frais']
    }
};

// Build the lookup map (alias -> canonical)
export const STATE_ALIASES: Record<string, string> = {};

Object.entries(STATE_DEFINITIONS).forEach(([canonical, langs]) => {
    // Map self
    STATE_ALIASES[canonical] = canonical;
    
    // Map aliases from all languages
    Object.values(langs).forEach(aliases => {
        aliases.forEach(alias => {
            STATE_ALIASES[alias] = canonical;
        });
    });
});

export function resolveState(state: string | undefined): string {
    if (!state) return 'default';
    const lower = state.toLowerCase().trim();
    return STATE_ALIASES[lower] || lower;
}

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
