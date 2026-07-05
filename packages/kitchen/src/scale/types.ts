/**
 * A scaling request: either a flat multiplier, or a target quantity for a
 * specific ingredient that the engine must derive a multiplier from.
 */
export type ScaleRequest =
    | { type: 'factor'; value: number }
    | { type: 'target'; id: string; qty: number; unit: string | null };

export interface ScaleResolution {
    factor: number;
    resolvedFrom: 'factor' | 'target';
    targetId?: string;
    unitConverted?: boolean;
}

/**
 * Converts a numeric value between two unit strings (e.g. kg -> g).
 * Returns null when the two units belong to incompatible families
 * (e.g. mass <-> volume without a density), signaling the engine to fail
 * with a clear UnitMismatchError instead of guessing.
 */
export type UnitConverter = (value: number, fromUnit: string, toUnit: string) => number | null;

export abstract class ScaleError extends Error {
    abstract readonly code: string;
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class InvalidFactorError extends ScaleError {
    readonly code = 'INVALID_FACTOR';
    constructor(public readonly value: number, detail?: string) {
        super(detail ?? `Invalid scale factor "${value}". Use a positive, finite number.`);
    }
}

export class IngredientNotFoundError extends ScaleError {
    readonly code = 'INGREDIENT_NOT_FOUND';
    constructor(public readonly targetId: string, public readonly availableIds: string[]) {
        super(`Ingredient "${targetId}" not found in recipe shopping list.`);
    }
}

export class NestedOnlyTargetError extends ScaleError {
    readonly code = 'NESTED_ONLY_TARGET';
    constructor(public readonly targetId: string, public readonly parentId: string) {
        super(`"${targetId}" is only used inside the "${parentId}" sub-recipe and cannot be scaled directly. Scale "${parentId}" instead.`);
    }
}

export class AlternativeTargetError extends ScaleError {
    readonly code = 'ALTERNATIVE_TARGET';
    constructor(public readonly targetId: string, public readonly siblingIds: string[]) {
        super(
            `"${targetId}" is one option in an alternative-ingredient group (${[targetId, ...siblingIds].join(' or ')}) ` +
            `and can't be used as a scale reference on its own — pick an unambiguous ingredient elsewhere in the recipe.`
        );
    }
}

export class FixedIngredientError extends ScaleError {
    readonly code = 'FIXED_INGREDIENT';
    constructor(public readonly targetId: string, public readonly reason: 'protected' | 'text') {
        super(
            reason === 'text'
                ? `"${targetId}" is a non-numeric quantity (e.g. "a pinch") and cannot be used as a scale reference.`
                : `"${targetId}" is marked fixed (@=) and never scales, so it cannot be used as a scale reference.`
        );
    }
}

export class RelativeTargetError extends ScaleError {
    readonly code = 'RELATIVE_TARGET';
    constructor(public readonly targetId: string) {
        super(`"${targetId}" is a relative quantity computed from another ingredient — scale that ingredient instead of "${targetId}".`);
    }
}

export class AmbiguousMultiUnitError extends ScaleError {
    readonly code = 'AMBIGUOUS_MULTI_UNIT';
    constructor(public readonly targetId: string) {
        super(`"${targetId}" is used with multiple incompatible units across the recipe, so a single scale factor can't be derived from it.`);
    }
}

export class NonNumericTargetError extends ScaleError {
    readonly code = 'NON_NUMERIC_TARGET';
    constructor(public readonly targetId: string) {
        super(`"${targetId}" has no numeric quantity to scale from.`);
    }
}

export class UnitMismatchError extends ScaleError {
    readonly code = 'UNIT_MISMATCH';
    constructor(
        public readonly targetId: string,
        public readonly requestedUnit: string | null,
        public readonly actualUnit: string | null
    ) {
        super(
            `Unit mismatch for "${targetId}": you specified "${requestedUnit ?? '(none)'}" but the recipe uses "${actualUnit ?? '(none)'}". ` +
            `Provide a compatible unit, or a density via "gram db enrich" if converting between mass and volume.`
        );
    }
}
