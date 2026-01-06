
import { compile } from './src/index';
import { getAST } from '../parser/src/index';

const GRAM = `
---
Recipe: Mass Test
densities: [flour:0.1, unknown:2.0]
---

Ingredients:
* @flour{1 cup}
* @sugar{1 kg}
* @egg{2}
* @water{100 ml}
* @unknown{100 ml}
`;

const ast = getAST(GRAM.trim());
console.log('Meta:', ast.meta);
const res = compile(ast);

if (res.sections && res.sections.length > 0) {
    const ingredients = res.sections[0].ingredients;
    ingredients.forEach(i => {
        console.log(`${i.id}: mass=${i.normalizedMass}, method=${i.conversionMethod}, est=${(i as any).isEstimate}`);
    });
}
console.log("Global Metrics:", res.metrics);

if (res.shopping_list) {
    console.log("Shopping List:");
    res.shopping_list.forEach((i: any) => {
        console.log(`- ${i.name || i.id}: mass=${i.normalizedMass}, method=${i.conversionMethod}, est=${i.isEstimate}`);
    });
} else {
    console.log("No shopping list.");
}
