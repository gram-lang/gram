import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { UNIT_DICTIONARIES, TIME_DICTIONARIES } from '@gram/i18n';

export function isInsideBraces(prefix: string): boolean {
    let depth = 0;
    for (let i = prefix.length - 1; i >= 0; i--) {
        if (prefix[i] === '}') depth++;
        else if (prefix[i] === '{') {
            if (depth === 0) return true;
            depth--;
        }
    }
    return false;
}

function hasNumberBeforeCursor(prefix: string): boolean {
    const braceIdx = prefix.lastIndexOf('{');
    if (braceIdx === -1) return false;
    return /\d/.test(prefix.slice(braceIdx));
}

export function provideUnitCompletions(prefix: string): CompletionItem[] {
    if (!hasNumberBeforeCursor(prefix)) return [];

    const items: CompletionItem[] = [];
    const seen = new Set<string>();

    function add(label: string, canonical: string, sortPrefix: string) {
        if (seen.has(label)) return;
        seen.add(label);
        items.push({
            label,
            kind: CompletionItemKind.Unit,
            detail: canonical !== label ? `→ ${canonical}` : undefined,
            sortText: sortPrefix + label,
        });
    }

    // Canonical unit labels (from dictionary keys) — highest priority
    for (const canon of Object.keys(UNIT_DICTIONARIES.en)) {
        add(canon, canon, '0');
    }

    // FR aliases first (primary locale in GRAM)
    for (const [canon, aliases] of Object.entries(UNIT_DICTIONARIES.fr)) {
        for (const alias of aliases) add(alias, canon, '1');
    }

    // EN aliases
    for (const [canon, aliases] of Object.entries(UNIT_DICTIONARIES.en)) {
        for (const alias of aliases) add(alias, canon, '2');
    }

    // Time units (for timers ~{})
    for (const canon of Object.keys(TIME_DICTIONARIES.en)) {
        add(canon, canon, '3');
    }
    for (const [canon, aliases] of Object.entries(TIME_DICTIONARIES.fr)) {
        for (const alias of aliases) add(alias, canon, '4');
    }
    for (const [canon, aliases] of Object.entries(TIME_DICTIONARIES.en)) {
        for (const alias of aliases) add(alias, canon, '5');
    }

    return items;
}
