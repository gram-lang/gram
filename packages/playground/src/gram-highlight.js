/*
Language: Gram
Description: Grammar for the Gram recipe language
*/

export default function(hljs) {
    const NUMBER = {
        className: 'number',
        begin: /\b\d+(?:\.\d+)?/,
        relevance: 0
    };

    const UNIT = {
        className: 'unit', // e.g. g, ml, tbsp
        begin: /\s*[a-zA-Z%°]+/,
        relevance: 0
    };

    const QUANTITY = {
        className: 'qty', // The {} braces
        begin: /\{/,
        end: /\}/,
        contains: [
            NUMBER,
            UNIT,
            {
              className: 'variable', // For relative % @ref
              begin: /@|&/,
              end: /(?=\}|\s)/ 
            }
        ],
        relevance: 0
    };

    const PREP = {
        className: 'string', // (diced) - loosely string-like
        begin: /\(/,
        end: /\)/,
        relevance: 0
    };

    const ALIAS = {
        className: 'title', // [alias]
        begin: /\[/,
        end: /\]/,
        relevance: 0
    };

    const ACTION = {
        className: 'meta', // [Mix] at start
        begin: /^\s*\[/,
        end: /\]/,
        relevance: 5
    };

    const FRONTMATTER = {
        className: 'frontmatter',
        begin: /^---$/,
        end: /^---$/,
        relevance: 10,
        contains: [
            {
                className: 'attr',
                begin: /^[a-zA-Z0-9_-]+:/,
                end: /$/
            },
            hljs.HASH_COMMENT_MODE
        ]
    };

    // Helper for Elements (Ingredient, Cookware, etc)
    function element(className, char) {
        return {
            className: className,
            begin: new RegExp(char + '[\\?\\-\\*\\&]?'),
            // Use explicit end chars and exclude them from the match
            // so they can be picked up by next modes (like Quantity or Prep)
            end: /(?=[\{\(\[\<\|\n@#~!&]|$)/, 
            relevance: 10
        };
    }

    const INGREDIENT = element('ingredient', '@');
    const COOKWARE = element('cookware', '#');
    const TIMER = element('timer', '~');
    const TEMP = element('temp', '!');
    const REFERENCE = element('reference', '&');
    const DECL = element('reference', '->&'); 

    const HEADER = {
        className: 'section',
        begin: /^##/,
        end: /$/,
        contains: [
            { className: 'timer', begin: /\{T\-/, end: /\}/ }, // Retro-planning
            DECL,
            QUANTITY,
            PREP
        ],
        relevance: 10
    };

    const COMMENT_LINE = hljs.COMMENT(/\/\//, /$/);
    const COMMENT_BLOCK = hljs.COMMENT(/\/\*/, /\*\//);

    return {
        name: 'Gram',
        aliases: ['gram', 'recipe'],
        case_insensitive: false,
        contains: [
            FRONTMATTER,
            COMMENT_LINE,
            COMMENT_BLOCK,
            HEADER,
            ACTION, // Matches ^[...] so must be before ALIAS
            
            DECL,
            INGREDIENT,
            COOKWARE,
            TIMER,
            TEMP,
            REFERENCE,

            QUANTITY,
            PREP,
            ALIAS, 
            
            { className: 'operator', begin: /\|/ },
            { className: 'operator', begin: /</ } 
        ]
    };
}
