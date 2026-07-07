# How to Build a Custom UI (Consuming JSON)

If you are building a modern web application (e.g., using React, Vue, Svelte, or Next.js), you should consume Gram's compiled **JSON data** directly and map it to your own UI components.

While the raw output of the parser is an Abstract Syntax Tree (AST), the `@gram-lang/kitchen` and `@gram-lang/analyzer` packages transform this AST into a highly structured, render-ready JSON object. This guide shows you how to programmatically extract this JSON data and understand its structure so you can build anything you want.

## 1. Getting the JSON Data

Gram is designed to run anywhere (Node.js, Edge, or directly in the browser). To get the fully enriched JSON representation of a recipe, you compose the three core packages:

```typescript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';
import { analyze } from '@gram-lang/analyzer';

function getRecipeData(sourceCode: string) {
  // 1. Parse text into syntax tree
  const ast = getAST(sourceCode);
  
  // 2. Compile into structured sections
  const compiled = compile(ast);

  // 3. Enrich with culinary math (yields, baker's math, scaling)
  const analyzed = analyze(compiled, { 
    db: myDatabase // optional: your loaded ingredients database
  });

  return analyzed.result;
}
```

> **Tip**: If you are exclusively running in a Node.js environment (e.g., a CLI tool or a Next.js server), you can use the `runPipeline(filePath)` helper from `@gram-lang/cli` which wraps this logic and handles file reading for you.

## 2. Understanding the JSON Structure

The returned JSON object represents the complete, structured recipe. It contains everything you need to build a UI.

Here are the most important fields in the root object:
- `title` *(string)*: The name of the recipe (from the `# Header`).
- `meta` *(object)*: Key-value pairs for metadata (e.g. `author`, `yield`).
- `shopping_list` *(array)*: An aggregated list of all ingredients across all sections.
- `sections` *(array)*: The actual instructions, broken down by recipe section.

### Inside a Section

Each `section` in the `sections` array has its own `ingredients`, `cookware`, and `steps`.

```json
{
  "title": "Dough",
  "ingredients": [ ... ],
  "cookware": [ ... ],
  "steps": [
    {
      "type": "step",
      "action": "Mix",
      "content": [
        "The ",
        {
          "id": "flour",
          "_usageId": "1",
          "qty": 500,
          "unit": "g",
          "normalizedMass": 500
        },
        " and ",
        {
          "id": "water",
          "_usageId": "2",
          "qty": 350,
          "unit": "ml"
        },
        "."
      ],
      "timings": {
        "start": 0,
        "end": 2,
        "activeDuration": 2
      }
    }
  ]
}
```

## 3. Rendering Logic

Because Gram's JSON payload is highly structured, building a UI is a matter of writing simple loops or `map` functions in your frontend framework.

### Example: Rendering Steps in React

Here is a conceptual example of how you might render the `steps` array in React:

```tsx
function RecipeStep({ step }) {
  // If it's a simple comment node
  if (step.type === 'comment') {
    return <p className="text-gray-500 italic">{step.value}</p>;
  }

  // If it's a standard instruction step
  if (step.type === 'step') {
    return (
      <li>
        {step.action && <strong>[{step.action}] </strong>}
        {step.content.map((token, i) => (
          <StepToken key={i} token={token} />
        ))}
      </li>
    );
  }
}

// A polymorphic component to render inline tokens
function StepToken({ token, cookwareRegistry }) {
  // 1. Strings are just raw text
  if (typeof token === 'string') {
    return <span>{token}</span>;
  }

  // 2. Ingredients and Cookware are optimized objects without a 'type' field, but with an 'id'.
  // We infer the type by checking if the ID exists in our cookware registry.
  if (!token.type && token.id) {
    const isCookware = !!cookwareRegistry[token.id];
    
    if (isCookware) {
      return <span className="text-blue-600 font-bold">{token.id}</span>;
    } else {
      return <span className="text-green-600 font-bold">{token.id} ({token.qty}{token.unit})</span>;
    }
  }

  // 3. Other tokens (timers, temperatures) have explicit 'type' fields
  switch (token.type) {
    case 'timer':
      return <span className="bg-yellow-100 px-1 rounded">{token.quantity?.value}{token.unit}</span>;
    case 'temperature':
      // unit is already normalized to °C/°F — no extra ° to add here
      return <span className="text-red-600">{token.quantity?.value}{token.unit}</span>;
    default:
      return null;
  }
}
```

By mapping the `type` property to your own components, you have **total control** over the design, interactivity, and accessibility of your recipe application!
