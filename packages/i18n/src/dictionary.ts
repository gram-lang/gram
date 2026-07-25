export type LanguageDict = Record<string, string[]>;
export type CompiledDict = Record<string, string>;

/** Compiles alias lists into O(1) lookup tables, per language plus a unified global fallback. */
export function compileDictionary(dictionaries: Record<string, LanguageDict>): {
	byLang: Record<string, CompiledDict>;
	global: CompiledDict;
} {
	const byLang: Record<string, CompiledDict> = {};
	const global: CompiledDict = {};

	for (const [lang, dict] of Object.entries(dictionaries)) {
		const compiledLang: CompiledDict = {};
		for (const [canonical, aliases] of Object.entries(dict)) {
			// Include the canonical unit itself as an alias for safety
			compiledLang[canonical] = canonical;
			global[canonical] = canonical;

			for (const alias of aliases) {
				const lowerAlias = alias.toLowerCase();
				compiledLang[lowerAlias] = canonical;
				global[lowerAlias] = canonical;
			}
		}
		byLang[lang] = compiledLang;
	}

	return { byLang, global };
}
