import type {
	CompilationResult,
	AggregatedIngredient,
} from "@gram-lang/kitchen";

export interface CookTimer {
	id: string;
	name: string;
	durationMs: number;
	/** The target states of its step, to check when it rings. Since 1.5.0. */
	checks?: string[];
}

export interface ActiveTimer extends CookTimer {
	startedAt: number;
	done: boolean;
}

export interface FlatStep {
	globalIndex: number;
	sectionIndex: number;
	sectionTitle: string | null;
	isFirstOfSection: boolean;
	sectionIngredients: AggregatedIngredient[];
	step: any; // ProcessedStep
	timers: CookTimer[];
}

export interface RecipeData {
	title: string | null;
	shoppingList: any[];
	steps: FlatStep[];
	registry: CompilationResult["registry"];
	massMap: Record<string, number>;
	/** The language of the cook's words (`Target:`), from the config. */
	lang?: string;
}

export type Phase = "mise-en-place" | "section-start" | "cooking" | "end";
