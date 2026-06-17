import {
    RecipeAST, SectionAST, StepAST, IntermediateDecl, ReferenceAST,
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

export function findStepTextContent(step: StepAST): string {
    return step.children
        .filter(c => c.type === ASTNodeType.Text)
        .map(c => (c as any).value as string)
        .join('')
        .trim();
}
