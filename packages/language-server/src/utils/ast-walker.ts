import {
    RecipeAST, SectionAST, StepAST, IntermediateDecl, ReferenceAST, IngredientAST, AlternativeAST,
    ASTNodeType
} from '@gram/parser';

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
            if (block.type !== ASTNodeType.Step) continue;
            for (const child of block.children) {
                if (child.type === ASTNodeType.IntermediateDecl) {
                    results.push({ decl: child as IntermediateDecl, section, step: block });
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
            if (block.type !== ASTNodeType.Step) continue;
            for (const child of block.children) {
                if (child.type === ASTNodeType.Reference) {
                    refs.push(child as ReferenceAST);
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
            if (block.type !== ASTNodeType.Step) continue;
            for (const child of block.children) {
                if (child.type === ASTNodeType.Ingredient) {
                    results.push(child as IngredientAST);
                } else if (child.type === ASTNodeType.Alternative) {
                    for (const opt of (child as AlternativeAST).options) {
                        if (opt.type === ASTNodeType.Ingredient) results.push(opt as IngredientAST);
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
