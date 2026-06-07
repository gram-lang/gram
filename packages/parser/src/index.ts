import * as fs from 'fs';
import * as path from 'path';
import * as ohm from 'ohm-js';
import { 
    RecipeAST, SectionAST, StepAST, IngredientAST, CookwareAST, 
    QuantityAST, QuantityValueAST, RelativeQuantityAST, TextQuantityAST, 
    ReferenceAST, TimerAST, TemperatureAST, CommentAST, AlternativeAST, 
    IntermediateDecl 
} from './types';

export * from './types';

// Load Grammar
const grammarPath = path.join(__dirname, '../grammar.ohm');
const grammarContent = fs.readFileSync(grammarPath, 'utf-8');
const grammar = ohm.grammar(grammarContent);

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

/**
 * Trims a string.
 */
const clean = (str: string) => str.trim();

/**
 * Safely extracts the AST from an optional node (0 or 1 child).
 * Returns null if the node has no children.
 */
const getOpt = (node: any) => (node.children.length > 0 ? node.children[0].toAST() : null);

/**
 * Parses a fractional or decimal string into a value object.
 * e.g., "1/2" -> { type: 'fraction', value: 0.5, ... }
 */
const parseNumber = (n: string): QuantityValueAST | null => {
    if (!n) return null;
    const [numStr, denStr] = n.split('/');
    if (denStr) {
        const num = parseInt(numStr);
        const den = parseInt(denStr);
        return { type: 'fraction', value: num / den, numerator: num, denominator: den, text: n };
    } else {
        return { type: 'single', value: parseFloat(n), text: n };
    }
};

/**
 * Parses values from Frontmatter (removing quotes, brackets, etc.)
 */
const parseFrontmatterValue = (val: string): string | string[] => {
    val = val.trim();
    // Helper to strip surrounding quotes
    const strip = (s: string) => (s && (s.startsWith("'") || s.startsWith('"')) && s[0] === s[s.length - 1]) ? s.slice(1, -1) : s;
    
    // Handle Arrays [a, b]
    if (val.startsWith('[') && val.endsWith(']')) {
        const inner = val.slice(1, -1).trim();
        return inner ? inner.split(',').map(s => strip(s.trim())) : [];
    }
    return strip(val);
};

// ----------------------------------------------------------------------------
// SEMANTICS
// ----------------------------------------------------------------------------

const semantics = grammar.createSemantics();

semantics.addOperation('toAST', {

    // --- Structure ---

    Recipe(frontmatter, content) {
        const meta = getOpt(frontmatter) || {};
        const sections = getOpt(content) || [];
        return { type: 'Recipe', meta, children: sections } as RecipeAST;
    },

    Frontmatter(_1, _2, kv, _3, _4) {
        // Merge all KeyValues into a single object
        return kv.children
            .map(c => c.toAST())
            .reduce((acc, curr) => ({ ...acc, ...curr }), {});
    },

    KeyValue(key, _1, _2, value, _3) {
        return { [key.sourceString]: parseFrontmatterValue(value.sourceString) };
    },

    Content_explicit(_nls, sections) {
        return sections.children.map(s => s.toAST());
    },

    Content_implicit(nls, blocks) {
         return blocks.children.map(b => b.toAST());
    },

    Section(header, blocks) {
        const h = header.toAST();
        return { 
            type: 'Section', 
            title: h.title, 
            retroPlanning: h.retroPlanning,
            intermediateDecl: h.intermediateDecl,
            children: blocks.children.map(b => b.toAST()),
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        } as SectionAST;
    },

    header(_1, _2, title, extension, _3, _4) {
        let retroPlanning = null;
        let intermediateDecl = null;

        const ext = getOpt(extension);
        if (ext) {
             // headerExtension semantic action returns { retroPlanning, intermediateDecl }
             retroPlanning = ext.retroPlanning;
             intermediateDecl = ext.intermediateDecl;
        }

        return { 
            title: clean(title.sourceString).replace(/^##\s*/, ''),
            retroPlanning,
            intermediateDecl
        };
    },

    headerExtension_retro(retro, _sp, decl) {
        const intermediate = getOpt(decl);
        return { retroPlanning: retro.toAST(), intermediateDecl: intermediate };
    },
    
    headerExtension_decl(decl) {
        return { retroPlanning: null, intermediateDecl: decl.toAST() };
    },

    retroPlanning(_1, content, _2) {
        return clean(content.sourceString);
    },

    // --- Blocks & Steps ---

    Block_comment(comment, _nls) { return comment.toAST(); },
    Block_step(child) { return child.toAST(); },

    step(actionNode, line1, _nls, lines, _term) {
        const action = getOpt(actionNode);
        
        // Combine first line with subsequent lines, joined by a space
        const content: any[] = [line1.toAST()];
        lines.children.forEach(l => {
             content.push([{ type: 'Text', value: ' ' }]); // Space separator
             content.push(l.toAST());
        });

        // Flatten the array to unify text/ingredients flow
        const flatContent = content.flat().filter(c => c !== null);

        return {
            type: 'Step',
            action,
            children: flatContent,
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        } as StepAST;
    },

    startAction(_lb, txt, _rb, _sp) { return clean(txt.sourceString); },

    line(items) { return items.children.map(i => i.toAST()); },
    stepContent(child) { return child.toAST(); },
    
    intermediateDecl(_1, name, _2) {
        return { type: 'IntermediateDecl', name: clean(name.sourceString) } as IntermediateDecl;
    },

    // --- Text & Primitives ---

    text(spaces, chars) {
        const val = spaces.sourceString + chars.sourceString;
        return { type: 'Text', value: val, loc: { start: this.source.startIdx, end: this.source.endIdx }};
    },
    
    fallback(c) {
        return { type: 'Text', value: c.sourceString, fallback: true, loc: { start: this.source.startIdx, end: this.source.endIdx } };
    },

    nl(_r, _n) { return null; }, 
    ws(s) { return { type: 'Text', value: s.sourceString }; },

    // --- Ingredients ---

    Ingredient(child) { return child.toAST(); },
    
    Alternative(first, _bars, rest) {
        const options = [first.toAST(), ...rest.children.map(c => c.toAST())];
        return { type: 'Alternative', options, loc: { start: this.source.startIdx, end: this.source.endIdx } } as AlternativeAST;
    },

    simpleIngredient(_at, _mods, _name, _alias, _qty, _prep, _comp) {
        const modifiers = _mods.children.map(m => m.sourceString);
        return {
            type: 'Ingredient',
            name: _name.sourceString.trim(),
            modifiers,
            quantity: _qty.toAST(),
            alias: getOpt(_alias),
            preparation: getOpt(_prep),
            composite: getOpt(_comp),
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        } as IngredientAST;
    },

    composite(_lt, _sp1, _at, _sp2, _name, _sp3, _qty) {
        return {
             type: 'Composite',
             parent: _name.sourceString,
             quantity: getOpt(_qty)
        };
    },

    alias(_lb, _sp1, name, _sp2, _rb) { return clean(name.sourceString); },
    preparation(_lp, text, _rp) { return clean(text.sourceString); },
    unit(name) { return clean(name.sourceString); },
    
    ingredientQuantity(_lb, _s1, content, _s3, _rb) {
        return content.toAST();
    },

    relativeQuantity(val, _s1, _pct, _s2, marker, _s3, name) {
        return { 
            type: 'RelativeQuantity', 
            percent: parseFloat(val.sourceString), 
            target: clean(name.sourceString),
            referenceType: marker.sourceString === '&' ? 'variable' : 'ingredient',
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        } as RelativeQuantityAST;
    },
    
    absoluteQuantity(fixed, _sFixed, val, _s2, unit, _sUnit) {
        return { 
            type: 'Quantity', 
            value: getOpt(val), 
            unit: getOpt(unit), 
            fixed: fixed.children.length > 0, 
            loc: { start: this.source.startIdx, end: this.source.endIdx } 
        } as QuantityAST;
    },

    cookwareQuantity(_lb, _s1, fixed, _sFixed, val, _s2, _rb) {
        return { 
            type: 'Quantity', 
            value: getOpt(val), 
            unit: null, 
            fixed: fixed.children.length > 0, 
            loc: { start: this.source.startIdx, end: this.source.endIdx } 
        } as QuantityAST;
    },

    textQuantity(_lb, _s1, content, _s2, _rb) {
        return { type: 'TextQuantity', value: clean(content.sourceString), loc: { start: this.source.startIdx, end: this.source.endIdx } } as TextQuantityAST;
    },

    number(_1, _2, _3, _4, _5) {
         return parseNumber(this.sourceString); 
    },

    range(n1, _s1, _, _s2, n2) {
        const min = parseNumber(n1.sourceString);
        const max = parseNumber(n2.sourceString);
        if (min && max) {
            const avg = ((min.value as number) + (max.value as number)) / 2;
            return { type: 'range', value: avg, range: { min: min.value, max: max.value }, text: this.sourceString };
        }
        return null;
    },

    // --- Cookware ---

    CookwareAlternative(first, _bars, rest) { 
        return { 
            type: 'Alternative', 
            options: [first.toAST(), ...rest.children.map(c => c.toAST())], 
            loc: { start: this.source.startIdx, end: this.source.endIdx } 
        } as AlternativeAST; 
    },

    simpleCookware(_hash, mods, name, alias, qty, prep) {
         const modifiers = mods.children.map(c => c.sourceString);
         return {
            type: 'Cookware',
            name: clean(name.sourceString),
            modifiers,
            alias: getOpt(alias),
            quantity: qty.toAST(), // Mandatory
            preparation: getOpt(prep),
            loc: { start: this.source.startIdx, end: this.source.endIdx }
         } as CookwareAST;
    },

    // --- Other Elements ---

    Reference(_amp, _name, _qty) {
        return { 
            type: 'Reference', 
            name: _name.sourceString, 
            quantity: _qty.toAST(),
            loc: { start: this.source.startIdx, end: this.source.endIdx } 
        } as ReferenceAST;
    },

    Timer(_1, name, qty, asyncMod) { 
        const n = name.children.length > 0 ? clean(name.children[0].sourceString) : null;
        return { 
            type: 'Timer', 
            name: n, 
            quantity: qty.toAST(), 
            isAsync: asyncMod.children.length > 0,
            loc: { start: this.source.startIdx, end: this.source.endIdx } 
        } as TimerAST;
    },

    Temperature(_1, name, qty) {
        const n = name.children.length > 0 ? clean(name.children[0].sourceString) : null;
        return { type: 'Temperature', name: n, quantity: qty.toAST(), loc: { start: this.source.startIdx, end: this.source.endIdx } } as TemperatureAST;
    },
    
    Comment(_1, text) { return { type: 'Comment', value: text.sourceString, kind: 'line', loc: { start: this.source.startIdx, end: this.source.endIdx } } as CommentAST; },
    CommentBlock(_1, text, _2) { return { type: 'Comment', value: text.sourceString, kind: 'block', loc: { start: this.source.startIdx, end: this.source.endIdx } } as CommentAST; },
    
    _terminal() { return null; }
});

// ----------------------------------------------------------------------------
// EXPORTS
// ----------------------------------------------------------------------------

export function getAST(input: string): RecipeAST {
    const match = grammar.match(input);
    if (match.failed()) {
        throw new Error(match.message);
    }
    return semantics(match).toAST();
}

// export function parse removed. Use getAST() and then compileFromAST() from gram-compiler.
