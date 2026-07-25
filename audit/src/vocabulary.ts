// Generic AST-shape walker, built on the real parser types
// (packages/parser/src/types.ts), not string/regex matching. Used both to
// build the trusted-corpus vocabulary and to compute a given snippet's own
// shape set for comparison. Deliberately mirrors the defensive style already
// fixed in packages/language-server/src/utils/ast-walker.ts (guard
// Array.isArray before recursing) rather than reusing its exports, which are
// collection-specific (collectIngredients/collectReferences/...), not a
// generic walk.

interface WalkContext {
	inStepScope: boolean;
}

function addModifierKeys(
	modifiers: unknown,
	prefix: string,
	shapes: Set<string>,
): void {
	if (!Array.isArray(modifiers)) return;
	for (const m of modifiers) shapes.add(`${prefix}:modifier=${m}`);
}

function walk(node: unknown, shapes: Set<string>, ctx: WalkContext): void {
	if (!node || typeof node !== "object") return;

	if (Array.isArray(node)) {
		for (const child of node) walk(child, shapes, ctx);
		return;
	}

	const record = node as Record<string, unknown>;
	const type = record.type;
	if (typeof type === "string") shapes.add(type);

	switch (type) {
		case "Ingredient": {
			addModifierKeys(record.modifiers, "Ingredient", shapes);
			const composite = record.composite as Record<string, unknown> | null | undefined;
			if (composite) {
				shapes.add("Ingredient:hasComposite");
				if (composite.preparation) shapes.add("Ingredient:compositeHasPreparation");
			}
			if (record.preparation) shapes.add("Ingredient:ownHasPreparation");
			break;
		}
		case "Cookware": {
			addModifierKeys(record.modifiers, "Cookware", shapes);
			if (record.preparation) shapes.add("Cookware:hasPreparation");
			break;
		}
		case "Composite": {
			if (record.preparation) shapes.add("Composite:hasPreparation");
			break;
		}
		case "Timer":
			shapes.add(`Timer:isPassive=${Boolean(record.isPassive)}`);
			break;
		case "RelativeQuantity":
			shapes.add(`RelativeQuantity:referenceType=${String(record.referenceType)}`);
			break;
		case "IntermediateDecl":
			shapes.add(ctx.inStepScope ? "IntermediateDecl:step-level" : "IntermediateDecl:section-level");
			break;
		case "Section":
			if (record.retroPlanning) shapes.add("Section:hasRetroPlanning");
			break;
		default:
			break;
	}

	const childCtx: WalkContext = { inStepScope: type === "Step" || ctx.inStepScope };
	for (const key of Object.keys(record)) {
		if (key === "type" || key === "loc") continue;
		const value = record[key];
		if (Array.isArray(value)) {
			for (const child of value) walk(child, shapes, childCtx);
		} else if (value && typeof value === "object") {
			walk(value, shapes, childCtx);
		}
	}
}

export function collectShapes(ast: unknown): Set<string> {
	const shapes = new Set<string>();
	walk(ast, shapes, { inStepScope: false });
	return shapes;
}

function collectNames(ast: unknown, names: string[]): void {
	if (!ast || typeof ast !== "object") return;
	if (Array.isArray(ast)) {
		for (const child of ast) collectNames(child, names);
		return;
	}
	const record = ast as Record<string, unknown>;
	if (
		(record.type === "Ingredient" || record.type === "Cookware") &&
		typeof record.name === "string"
	) {
		names.push(record.name);
	}
	for (const key of Object.keys(record)) {
		if (key === "type" || key === "loc") continue;
		const value = record[key];
		if (Array.isArray(value) || (value && typeof value === "object")) {
			collectNames(value, names);
		}
	}
}

export function collectIngredientCookwareNames(ast: unknown): string[] {
	const names: string[] = [];
	collectNames(ast, names);
	return names;
}
