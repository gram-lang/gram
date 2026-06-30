# How to Customize HTML Rendering

If you are building a web application and want to display Gram recipes, you can use the `@gram/renderer` package to generate semantic HTML directly from the JSON AST.

However, you likely have your own design system (TailwindCSS, Bootstrap) and your own icon sets (Lucide, Heroicons). The renderer uses an **Inversion of Control** architecture, allowing you to inject your own classes and SVG icons without forking the package.

## Basic Setup

First, parse and compile your recipe:

```typescript
import { parse } from '@gram/parser';
import { processSections, generateShoppingList } from '@gram/kitchen';
import { toHTML } from '@gram/renderer';

// 1. Get the AST
const ast = parse("## Dough \n Add @flour{200g}.");

// 2. Compile logic
const compiled = {
  sections: processSections(ast),
  shopping_list: generateShoppingList(ast)
};
```

## Injecting Custom Icons

The `toHTML` function accepts a second `options` parameter. You can provide an `icons` object containing raw SVG strings. 

The renderer uses specific keys internally (like `clock` for timers, `fire` for temperatures, `list` for shopping lists). 

```typescript
const myCustomIcons = {
  clock: '<svg class="w-4 h-4 text-gray-500" viewBox="0 0 24 24">...</svg>',
  fire: '<svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24">...</svg>'
};

const html = toHTML(compiled, {
  icons: myCustomIcons
});
```

Whenever the renderer encounters a `Timer` node, it will inject your custom `clock` SVG next to the duration.

## Injecting Custom CSS Classes

Similarly, you can inject your own utility classes (like Tailwind) into the generated DOM structure. 

The renderer defines a specific set of injectable keys (e.g., `recipeContainer`, `sectionTitle`, `ingredientLabel`).

```typescript
const html = toHTML(compiled, {
  icons: myCustomIcons,
  classes: {
    recipeContainer: 'max-w-3xl mx-auto bg-white shadow-lg rounded-xl',
    sectionTitle: 'text-2xl font-bold text-gray-900 border-b pb-2',
    ingredientLabel: 'font-semibold text-emerald-600',
    timerBadge: 'inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded px-2'
  }
});
```

## Direct JSON Consumption

If generating HTML strings is too restrictive for your framework (e.g., you want interactive React states for checking off ingredients), you should bypass `toHTML` entirely.

The `compiled` object is a simple, serializable JSON tree. You can map over it natively in your framework:

```tsx
// Example in React
export function RecipeView({ recipe }) {
  return (
    <div className="recipe">
      {recipe.sections.map((section, idx) => (
        <section key={idx}>
          <h2>{section.title}</h2>
          <ul>
            {section.steps.map((step, sIdx) => (
              <li key={sIdx}>{/* Render custom step components */}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```
