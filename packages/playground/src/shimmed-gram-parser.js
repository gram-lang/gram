"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAST = getAST;
const fs = __importStar(({}));
const path = __importStar(({}));
const ohm = __importStar(require("ohm-js"));
const types_1 = ({ ASTNodeType: {"Recipe":"Recipe","Section":"Section","Step":"Step","Comment":"Comment","Text":"Text","IntermediateDecl":"IntermediateDecl","RelativeQuantity":"RelativeQuantity","TextQuantity":"TextQuantity","Quantity":"Quantity","Ingredient":"Ingredient","Composite":"Composite","Cookware":"Cookware","Reference":"Reference","Timer":"Timer","Temperature":"Temperature","Alternative":"Alternative"} });
__exportStar(({ ASTNodeType: {"Recipe":"Recipe","Section":"Section","Step":"Step","Comment":"Comment","Text":"Text","IntermediateDecl":"IntermediateDecl","RelativeQuantity":"RelativeQuantity","TextQuantity":"TextQuantity","Quantity":"Quantity","Ingredient":"Ingredient","Composite":"Composite","Cookware":"Cookware","Reference":"Reference","Timer":"Timer","Temperature":"Temperature","Alternative":"Alternative"} }), exports);
const schemas_1 = require("./schemas");
// Load Grammar
// grammarPath suppressed
const grammarContent = "GRAM {\n  Recipe = Frontmatter? Content?\n  \n  Content = \n    | (nl* Section)+      -- explicit\n    | (nl* Block)+        -- implicit\n\n  Frontmatter = \"---\" nl KeyValue* \"---\" (nl | end)\n  KeyValue = key \":\" sp* value nl\n  key = (alnum | \"_\" | \"-\")+\n  value = (~nl any)*\n\n  Section = header Block*\n  header = \"##\" sp+ title headerExtension? sp* nl+\n  headerExtension = \n      | retroPlanning sp* intermediateDecl?  -- retro\n      | intermediateDecl                     -- decl\n  titleStop = nl | \"->&\" | \"{T-\"\n  title = (~titleStop any)*\n  \n  retroPlanning = \"{T-\" (~\"}\" any)+ \"}\"\n  \n  Block = \n    | Comment nl*       -- comment\n    | (~header step)    -- step\n  \n  step = startAction? line (nl line)* (nl+ | end)\n  startAction = \"[\" (~\"]\" any)+ \"]\" sp*\n  line = stepContent+\n  stepContent = \n    | text\n    | ws\n    | intermediateDecl\n    | applySyntactic<Element> \n    | fallback\n    \n  ws = space+\n\n  fallback = ~nl any\n\n  Element = \n    | Ingredient\n    | Cookware\n    | Timer\n    | Temperature\n    | Reference\n    | CommentBlock\n    | Comment\n\n  intermediateDecl = \"->&\" name \"{}\"\n\n  // Ingredients\n  Ingredient = \n     | Alternative\n     | simpleIngredient\n\n  Alternative = simpleIngredient (\"|\" simpleIngredient)+\n  \n  // Rule: Quantity is mandatory (it's the delimiter)\n  simpleIngredient = \"@\" modifier* name alias? ingredientQuantity preparation? composite?\n\n  modifier = \"?\" | \"-\" | \"*\" | \"&\"\n  alias = \"[\" space* name space* \"]\"\n  ingredientQuantity = \"{\" space* (relativeQuantity | absoluteQuantity) space* \"}\"\n  relativeQuantity = number space* \"%\" space* (\"@\" | \"&\") space* name\n  absoluteQuantity = (fixed space*)? (range | number)? space* (unit space*)?\n  textQuantity = \"{\" space* (~\"}\" any)+ space* \"}\"\n  fixed = \"=\"\n  unit = unitName\n  unitName = (alnum | sp | \"°\" | \"%\")+\n  preparation = \"(\" (~\")\" any)* \")\"\n  composite = \"<\" space* \"@\" space* name space* ingredientQuantity?\n\n  // Cookware\n  // Specs say use braces too.\n  Cookware = \n    | CookwareAlternative\n    | simpleCookware\n\n  CookwareAlternative = simpleCookware (\"|\" simpleCookware)+\n  simpleCookware = \"#\" modifier* name alias? cookwareQuantity preparation?\n\n  // Restrict cookware quantity to only numbers/fixed, NO UNITS.\n  // Allowed: {}, {2}, {=1}\n  cookwareQuantity = \"{\" space* (fixed space*)? number? space* \"}\"\n\n  // Timer\n  Timer = \"~\" name? ingredientQuantity \"&\"?\n  \n  // Temperature\n  Temperature = \"!\" name? (ingredientQuantity | textQuantity)\n\n\n  // Comments\n  Comment = \"//\" (~nl any)*\n  CommentBlock = \"/*\" (~\"*/\" any)* \"*/\"\n\n  // Primitives\n  name = (~(syntaxChar | nl) any)+\n  \n  number = digit+ (\".\" digit+)? (\"/\" digit+)?\n  range = number space* \"-\" space* number\n\n  text = space* (~(elementStart | nl) any)+\n  \n  Reference = \"&\" name ingredientQuantity\n\n  // SyntaxChar used for name content exclusion\n  // Restricted to true delimiters that start a new component\n  syntaxChar = \"{\" | \"}\" | \"[\" | \"]\" | \"(\" | \")\" | \"<\" | \"|\" | \":\" \n  \n  // Name can contain '&' or '@' or other symbols, as long as it doesn't look like a start of a new element if specific context requires it?\n  // Actually, standard grammar strategy: consume until a known delimiter.\n  // The delimiters are:\n  // - `{` (start of quantity)\n  // - `[` (start of alias)\n  // - `(` (start of preparation)\n  // - `<` (start of composite)\n  // - `|` (start of alternative)\n  // - newline\n  \n  // We removed @, #, ~, !, &, ?, * from syntaxChar list effectively allowing them in names.\n\n  \n  // ElementStart used for text content exclusion\n  // This remains strict to identify WHERE an element starts in free text.\n  elementStart = \"@\" | \"#\" | \"~\" | \"!\" | \"//\" | \"/*\" | \"->&\" | \"&\"\n  \n  nl = \"\\r\"? \"\\n\"\n  sp = \" \" | \"\\t\"\n  space := sp\n}\n";
const grammar = ohm.grammar(grammarContent);
// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------
/**
 * Trims a string.
 */
const clean = (str) => str.trim();
/**
 * Safely extracts the AST from an optional node (0 or 1 child).
 * Returns null if the node has no children.
 */
const getOpt = (node) => (node.children.length > 0 ? node.children[0].toAST() : null);
/**
 * Parses a fractional or decimal string into a value object.
 * e.g., "1/2" -> { type: 'fraction', value: 0.5, ... }
 */
const parseNumber = (n) => {
    if (!n)
        return null;
    const [numStr, denStr] = n.split('/');
    if (denStr) {
        const num = parseInt(numStr);
        const den = parseInt(denStr);
        return { type: 'fraction', value: num / den, numerator: num, denominator: den, text: n };
    }
    else {
        return { type: 'single', value: parseFloat(n), text: n };
    }
};
/**
 * Parses values from Frontmatter (removing quotes, brackets, etc.)
 */
const parseFrontmatterValue = (val) => {
    val = val.trim();
    // Helper to strip surrounding quotes
    const strip = (s) => (s && (s.startsWith("'") || s.startsWith('"')) && s[0] === s[s.length - 1]) ? s.slice(1, -1) : s;
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
        let meta = getOpt(frontmatter) || {};
        const metaResult = schemas_1.MetaSchema.safeParse(meta);
        if (!metaResult.success) {
            console.warn("[GRAM Parser] Invalid Front-Matter detected, ignoring metadata. Error:", metaResult.error.errors[0].message);
            meta = {};
        }
        else {
            meta = metaResult.data;
        }
        const sections = getOpt(content) || [];
        return { type: types_1.ASTNodeType.Recipe, meta, children: sections };
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
            type: types_1.ASTNodeType.Section,
            title: h.title,
            retroPlanning: h.retroPlanning,
            intermediateDecl: h.intermediateDecl,
            children: blocks.children.map(b => b.toAST()),
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
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
        const content = [line1.toAST()];
        lines.children.forEach(l => {
            content.push([{ type: types_1.ASTNodeType.Text, value: ' ' }]); // Space separator
            content.push(l.toAST());
        });
        // Flatten the array to unify text/ingredients flow
        const flatContent = content.flat().filter(c => c !== null);
        return {
            type: types_1.ASTNodeType.Step,
            action,
            children: flatContent,
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
    },
    startAction(_lb, txt, _rb, _sp) { return clean(txt.sourceString); },
    line(items) { return items.children.map(i => i.toAST()); },
    stepContent(child) { return child.toAST(); },
    intermediateDecl(_1, name, _2) {
        return { type: types_1.ASTNodeType.IntermediateDecl, name: clean(name.sourceString) };
    },
    // --- Text & Primitives ---
    text(spaces, chars) {
        const val = spaces.sourceString + chars.sourceString;
        return { type: types_1.ASTNodeType.Text, value: val, loc: { start: this.source.startIdx, end: this.source.endIdx } };
    },
    fallback(c) {
        return { type: types_1.ASTNodeType.Text, value: c.sourceString, fallback: true, loc: { start: this.source.startIdx, end: this.source.endIdx } };
    },
    nl(_r, _n) { return null; },
    ws(s) { return { type: types_1.ASTNodeType.Text, value: s.sourceString }; },
    // --- Ingredients ---
    Ingredient(child) { return child.toAST(); },
    Alternative(first, _bars, rest) {
        const options = [first.toAST(), ...rest.children.map(c => c.toAST())];
        return { type: types_1.ASTNodeType.Alternative, options, loc: { start: this.source.startIdx, end: this.source.endIdx } };
    },
    simpleIngredient(_at, _mods, _name, _alias, _qty, _prep, _comp) {
        const modifiers = _mods.children.map(m => m.sourceString);
        return {
            type: types_1.ASTNodeType.Ingredient,
            name: _name.sourceString.trim(),
            modifiers,
            quantity: _qty.toAST(),
            alias: getOpt(_alias),
            preparation: getOpt(_prep),
            composite: getOpt(_comp),
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
    },
    composite(_lt, _sp1, _at, _sp2, _name, _sp3, _qty) {
        return {
            type: types_1.ASTNodeType.Composite,
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
            type: types_1.ASTNodeType.RelativeQuantity,
            percent: parseFloat(val.sourceString),
            target: clean(name.sourceString),
            referenceType: marker.sourceString === '&' ? 'variable' : 'ingredient',
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
    },
    absoluteQuantity(fixed, _sFixed, val, _s2, unit, _sUnit) {
        return {
            type: types_1.ASTNodeType.Quantity,
            value: getOpt(val),
            unit: getOpt(unit),
            fixed: fixed.children.length > 0,
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
    },
    cookwareQuantity(_lb, _s1, fixed, _sFixed, val, _s2, _rb) {
        return {
            type: types_1.ASTNodeType.Quantity,
            value: getOpt(val),
            unit: null,
            fixed: fixed.children.length > 0,
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
    },
    textQuantity(_lb, _s1, content, _s2, _rb) {
        return { type: types_1.ASTNodeType.TextQuantity, value: clean(content.sourceString), loc: { start: this.source.startIdx, end: this.source.endIdx } };
    },
    number(_1, _2, _3, _4, _5) {
        return parseNumber(this.sourceString);
    },
    range(n1, _s1, _, _s2, n2) {
        const min = parseNumber(n1.sourceString);
        const max = parseNumber(n2.sourceString);
        if (min && max) {
            const avg = (min.value + max.value) / 2;
            return { type: 'range', value: avg, range: { min: min.value, max: max.value }, text: this.sourceString };
        }
        return null;
    },
    // --- Cookware ---
    CookwareAlternative(first, _bars, rest) {
        return {
            type: types_1.ASTNodeType.Alternative,
            options: [first.toAST(), ...rest.children.map(c => c.toAST())],
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
    },
    simpleCookware(_hash, mods, name, alias, qty, prep) {
        const modifiers = mods.children.map(c => c.sourceString);
        return {
            type: types_1.ASTNodeType.Cookware,
            name: clean(name.sourceString),
            modifiers,
            alias: getOpt(alias),
            quantity: qty.toAST(), // Mandatory
            preparation: getOpt(prep),
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
    },
    // --- Other Elements ---
    Reference(_amp, _name, _qty) {
        return {
            type: types_1.ASTNodeType.Reference,
            name: _name.sourceString,
            quantity: _qty.toAST(),
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
    },
    Timer(_1, name, qty, asyncMod) {
        const n = name.children.length > 0 ? clean(name.children[0].sourceString) : null;
        return {
            type: types_1.ASTNodeType.Timer,
            name: n,
            quantity: qty.toAST(),
            isAsync: asyncMod.children.length > 0,
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
    },
    Temperature(_1, name, qty) {
        const n = name.children.length > 0 ? clean(name.children[0].sourceString) : null;
        const qAST = qty.toAST();
        const base = {
            type: types_1.ASTNodeType.Temperature,
            name: n,
            loc: { start: this.source.startIdx, end: this.source.endIdx }
        };
        if (qAST.type === types_1.ASTNodeType.TextQuantity) {
            return { ...base, text: qAST.value };
        }
        if (qAST.type === types_1.ASTNodeType.Quantity && !qAST.value) {
            return { ...base, text: qAST.unit || '' };
        }
        return {
            ...base,
            value: qAST.value || null,
            unit: qAST.unit || null
        };
    },
    Comment(_1, text) { return { type: types_1.ASTNodeType.Comment, value: text.sourceString, kind: 'line', loc: { start: this.source.startIdx, end: this.source.endIdx } }; },
    CommentBlock(_1, text, _2) { return { type: types_1.ASTNodeType.Comment, value: text.sourceString, kind: 'block', loc: { start: this.source.startIdx, end: this.source.endIdx } }; },
    _terminal() { return null; }
});
// ----------------------------------------------------------------------------
// EXPORTS
// ----------------------------------------------------------------------------
function getAST(input) {
    const match = grammar.match(input);
    if (match.failed()) {
        throw new Error(match.message);
    }
    return semantics(match).toAST();
}
// export function parse removed. Use getAST() and then compileFromAST() from gram-compiler.
