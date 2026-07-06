import { 
    type ASTNode, 
    ASTNodeType, 
    type IngredientAST, 
    type CookwareAST, 
    type TimerAST, 
    type TemperatureAST, 
    type ReferenceAST, 
    type IntermediateDecl, 
    type AlternativeAST, 
    type CommentAST, 
    type StepAST, 
    type SectionAST, 
    type QuantityAST, 
    type TextQuantityAST,
    type RelativeQuantityAST
} from './types';

export function isIngredient(node: ASTNode | null | undefined): node is IngredientAST {
    return node != null && node.type === ASTNodeType.Ingredient;
}

export function isCookware(node: ASTNode | null | undefined): node is CookwareAST {
    return node != null && node.type === ASTNodeType.Cookware;
}

export function isTimer(node: ASTNode | null | undefined): node is TimerAST {
    return node != null && node.type === ASTNodeType.Timer;
}

export function isTemperature(node: ASTNode | null | undefined): node is TemperatureAST {
    return node != null && node.type === ASTNodeType.Temperature;
}

export function isReference(node: ASTNode | null | undefined): node is ReferenceAST {
    return node != null && node.type === ASTNodeType.Reference;
}

export function isIntermediateDecl(node: ASTNode | null | undefined): node is IntermediateDecl {
    return node != null && node.type === ASTNodeType.IntermediateDecl;
}

export function isAlternative(node: ASTNode | null | undefined): node is AlternativeAST {
    return node != null && node.type === ASTNodeType.Alternative;
}

export function isComment(node: ASTNode | null | undefined): node is CommentAST {
    return node != null && node.type === ASTNodeType.Comment;
}

export function isStep(node: ASTNode | null | undefined): node is StepAST {
    return node != null && node.type === ASTNodeType.Step;
}

export function isSection(node: ASTNode | null | undefined): node is SectionAST {
    return node != null && node.type === ASTNodeType.Section;
}

export function isQuantity(node: any): node is QuantityAST {
    return node != null && node.type === ASTNodeType.Quantity;
}

export function isTextQuantity(node: any): node is TextQuantityAST {
    return node != null && node.type === ASTNodeType.TextQuantity;
}

export function isRelativeQuantity(node: any): node is RelativeQuantityAST {
    return node != null && node.type === ASTNodeType.RelativeQuantity;
}
