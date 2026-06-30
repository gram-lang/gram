# Parsing & AST

The `@gram/parser` package is the foundation of the Gram ecosystem. Its sole responsibility is to read raw `.gram` text and convert it into an Abstract Syntax Tree (AST).

## OhmJS

Gram's syntax rules are defined using [OhmJS](https://ohmjs.org/), an object-oriented parsing toolkit built around Parsing Expression Grammars (PEGs).

Ohm makes it extremely easy to build modular grammars. Because of this, `@gram/parser` is incredibly fast and strictly enforces the structural rules of the language (like the fact that spaces are forbidden inside a composite ingredient declaration).

## The Abstract Syntax Tree (AST)

If the parser succeeds, it outputs an AST. This is a tree of JavaScript objects representing every semantic token in the recipe.

For example, this simple step:
```gram
Add the @flour{200g}.
```

Is parsed into a `Step` node containing a `Text` node ("Add the ") and an `Ingredient` node:
```json
{
  "type": "Ingredient",
  "name": "flour",
  "quantity": {
    "type": "Quantity",
    "value": 200,
    "unit": "g"
  },
  "modifiers": []
}
```

### Supported AST Nodes

The parser exposes specific node types for everything in the Gram language:
- `Recipe`: The root node containing the frontmatter and a list of `Section` nodes.
- `Section`: A group of `Step` nodes.
- `Step`: A single paragraph containing `Text`, `Ingredient`, `Cookware`, `Timer`, `Temperature`, `Reference`, and `IntermediateDecl` nodes.
- `Alternative`: A grouping of items separated by the `|` operator.

## Purely Syntactic

It is important to remember that `@gram/parser` is purely syntactic. It has **zero logic**. 

It does not know:
- If a referenced variable `&dough` was actually declared earlier.
- If `200g` of `flour` needs to be scaled or converted.
- If `flour` exists in your `ingredients.yaml` database.

It simply asserts that the text is valid Gram syntax and hands the structured tree over to `@gram/kitchen`.
