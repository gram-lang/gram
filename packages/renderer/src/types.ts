export interface RendererIcons {
  hourglass?: string;
  timer?: string;
  thermometer?: string;
  caretRight?: string;
  arrowRight?: string;
  arrowUDownLeft?: string;
  warning?: string;
  pencilSimple?: string;
  clock?: string;
  fire?: string;
  knife?: string;
  scales?: string;
  clockCounterClockwise?: string;
  arrowElbowDownRight?: string;
}

export interface RendererClasses {
  recipeTitle?: string;
  recipeMeta?: string;
  recipeTimingsGrid?: string;
  timingCard?: string;
  metaItem?: string;
  metaIcon?: string;
  metaContent?: string;
  metaLabel?: string;
  metaValue?: string;
  metaEst?: string;
  recipeMetaSecondary?: string;
  metadataGrid?: string;
  metaSecondaryItem?: string;
  shoppingList?: string;
  cookwareList?: string;
  instructions?: string;
  sectionHeader?: string;
  sectionIngredients?: string;
  stepsList?: string;
  stepItem?: string;
  stepAction?: string;
  stepComment?: string;
  ingredient?: string;
  reference?: string;
  cookware?: string;
  timer?: string;
  temperature?: string;
  declaration?: string;
  massBadge?: string;
  prepText?: string;
  optionalText?: string;
  formulaText?: string;
}

export interface RendererOptions {
  icons?: RendererIcons;
  classes?: RendererClasses;
  formatFraction?: (value: number) => string;
  formatDuration?: (minutes: number) => string;
  /** When true, ingredient quantities are omitted from step text (not from shopping list or section mise en place). */
  hideStepQty?: boolean;
  bakersReference?: string;
  bakersMathOnly?: boolean;
}

export interface RenderContext {
  registry?: {
    ingredients?: Record<string, any>;
    cookware?: Record<string, any>;
  };
  icons?: RendererIcons;
  classes?: RendererClasses;
  formatFraction?: (value: number) => string;
  formatDuration?: (minutes: number) => string;
  /** Set to true when formatting step tokens to suppress quantity display. */
  hideIngredientQty?: boolean;

  // Passed down from RendererOptions
  bakersMathOnly?: boolean;
  
  // Internal properties for formatting
  _bakersMathEnabled?: boolean;
  _bakersMathReferenceMass?: number;
  _bakersMathOnly?: boolean;

  /** Controls the display style of elements like ingredient preparations. Default is 'inline'. */
  formatMode?: 'inline' | 'mise-en-place' | 'shopping-list';
}
