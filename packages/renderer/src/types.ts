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
}

export interface RendererClasses {
  recipeTitle?: string;
  recipeMeta?: string;
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
}
