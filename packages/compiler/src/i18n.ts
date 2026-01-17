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
