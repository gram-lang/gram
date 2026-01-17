"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_ALIASES = void 0;
exports.resolveState = resolveState;
const STATE_DEFINITIONS = {
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
exports.STATE_ALIASES = {};
Object.entries(STATE_DEFINITIONS).forEach(([canonical, langs]) => {
    // Map self
    exports.STATE_ALIASES[canonical] = canonical;
    // Map aliases from all languages
    Object.values(langs).forEach(aliases => {
        aliases.forEach(alias => {
            exports.STATE_ALIASES[alias] = canonical;
        });
    });
});
function resolveState(state) {
    if (!state)
        return 'default';
    const lower = state.toLowerCase().trim();
    return exports.STATE_ALIASES[lower] || lower;
}
