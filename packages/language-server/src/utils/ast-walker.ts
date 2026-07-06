import {
    RecipeAST, SectionAST, StepAST, IntermediateDecl, ReferenceAST, IngredientAST, AlternativeAST,
    isIntermediateDecl, isReference, isIngredient, isAlternative, isStep
} from '@gram-lang/parser';

export interface IntermediateDeclWithSection {
    decl: IntermediateDecl;
    section: SectionAST;
    step: StepAST | null;
}

export function collectIntermediates(ast: RecipeAST): IntermediateDeclWithSection[] {
    const results: IntermediateDeclWithSection[] = [];
    for (const section of ast.children) {
        if (section.intermediateDecl) {
            results.push({ decl: section.intermediateDecl, section, step: null });
        }
        for (const block of section.children) {
            if (!isStep(block)) continue;
            for (const child of block.children) {
                if (isIntermediateDecl(child)) {
                    results.push({ decl: child, section, step: block });
                }
            }
        }
    }
    return results;
}

export function collectReferences(ast: RecipeAST): ReferenceAST[] {
    const refs: ReferenceAST[] = [];
    for (const section of ast.children) {
        for (const block of section.children) {
            if (!isStep(block)) continue;
            for (const child of block.children) {
                if (isReference(child)) {
                    refs.push(child);
                }
            }
        }
    }
    return refs;
}

// Returns the raw source text of a step, preserving ingredients, cookware, etc.
export function getStepSourceText(step: StepAST, documentText: string): string {
    if (!step.loc) return '';
    return documentText.slice(step.loc.start, step.loc.end).trim();
}

export function collectIngredients(ast: RecipeAST): IngredientAST[] {
    const results: IngredientAST[] = [];
    for (const section of ast.children) {
        for (const block of section.children) {
            if (!isStep(block)) continue;
            for (const child of block.children) {
                if (isIngredient(child)) {
                    results.push(child);
                } else if (isAlternative(child)) {
                    for (const opt of child.options) {
                        if (isIngredient(opt)) results.push(opt);
                    }
                }
            }
        }
    }
    return results;
}

export function findNameAtOffset(ast: RecipeAST, offset: number): { name: string; kind: 'decl' | 'ref' } | null {
    const refs = collectReferences(ast);
    const ref = refs.find(r => r.loc && r.loc.start <= offset && offset <= r.loc.end);
    if (ref) return { name: ref.name, kind: 'ref' };

    const decls = collectIntermediates(ast);
    const decl = decls.find(d => d.decl.loc && d.decl.loc.start <= offset && offset <= d.decl.loc.end);
    if (decl) return { name: decl.decl.name, kind: 'decl' };

    return null;
}
