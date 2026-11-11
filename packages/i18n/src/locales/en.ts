// The views of a recipe that stopped compiling: shared by the renderer's
// error model (`describeError`) and the playground's error card.
const VIEWS_PAUSED = {
	title: "Generation paused",
	description:
		"The recipe contains blocking errors preventing preview generation.",
};

export const en = {
	renderer: {
		viewsPaused: VIEWS_PAUSED.title,
		viewsPausedDescription: VIEWS_PAUSED.description,
		/** What a surface offers next to paused views: jump to the error. */
		showError: "Show the error",
		/** An output the recipe has nothing for (a run sheet with nothing to schedule). */
		outputEmpty: "Nothing to show for this recipe.",
		/** The serving time controls of a view laid out in time (the editor's panel). */
		serving: {
			label: "Served at",
			clear: "Clear",
			clearTitle: "Back to the plan in days before the service",
			suggest: "When to serve?",
			none: "No serving time works in the next seven days.",
			whyNot: "Why not the others?",
			earliest: "Earliest: {when}",
		},
		/** The session controls of a view (the editor's panel): scale, baker's reference, stock. */
		session: {
			title: "Scale and stock",
			scale: "Scale",
			byIngredient: "or by ingredient",
			ingredient: "Choose an ingredient",
			qty: "Quantity",
			unit: "Unit",
			apply: "Apply",
			bakersReference: "Baker's reference",
			auto: "Automatic (@*)",
			stock: "In stock",
			stockHint:
				"Already on hand: one shopping-list line, and its steps leave the plan.",
			reset: "Reset",
			scaled: "{factor} %",
			inStock: "{n} in stock",
			scaleError: "Scale not applied: {reason}",
		},
		/** The name of each output of the renderer (`outputs`), by its id. */
		outputs: {
			recipe: "Recipe",
			runSheet: "Run sheet",
			ast: "AST",
			json: "JSON",
			"json-tree": "JSON tree",
		} as Record<string, string>,
		/** The name of each format a view can be written in (`FORMATS`). */
		formats: {
			html: "HTML",
			markdown: "Markdown",
			text: "Text",
			print: "Print",
		} as Record<string, string>,
		shoppingList: "Shopping List",
		/** The ingredients a section uses, above its steps. */
		ingredients: "Ingredients",
		instructions: "Instructions",
		/** The comments at the end of a line, gathered under the recipe. */
		notes: "Notes",
		/** Between the options of an alternative (`@butter|oil`). */
		or: "or",
		/** The head of the metadata block of the Markdown recipe. */
		metadata: "Metadata",
		/** Marks a composite ingredient (`@yolk<@egg`) in a list. */
		composite: "Composite",
		/** Under a composite in the shopping list, the share of the item used whole (`@egg{1}` next to `@yolk<@egg`). */
		directUse: "Direct use",
		/** The label of the total mass in the recipe's header. */
		totalMass: "Total Mass",
		incomplete: "Incomplete",
		/** After a timer that is a passive wait, and the short mark of an alternative. */
		passive: "passive",
		alt: "alt",
		unknownIngredient: "[Unknown Ingredient]",
		unknownReference: "[Unknown Reference]",
		/** The portions of the recipe (`portions:`), and once it is scaled. */
		servings: "{count} portions",
		servingsScaled: "{count} portions (×{factor})",
		/** The word after the portions stepper, by plural category (`Intl.PluralRules`). */
		portionsUnit: { one: "portion", other: "portions" },
		/** The badge of a scaled recipe in the hero bar ("×1.5"). */
		scaledRecipe: "Scaled recipe",
		/** The pencil button beside the portions, where the surface can change them. */
		changePortions: "Change the portions",
		cookware: "Cookware",
		equipment: "Equipment",
		nutrition: "Nutrition",
		totalTime: "Total Time",
		idleTime: "Idle Time",
		activeTime: "Active Time",
		prepTime: "Prep Time",
		totalTimeTooltip: "Total time = prep + active + idle",
		/** Under the total time's breakdown: where the hour-by-hour plan lives. */
		totalTimeRunSheetHint: "For the hour-by-hour plan, see the {view}.",
		activeTimeCardTooltip: "Active Time = Sum of manual work time",
		prepTimeTooltip:
			"Prep Time = Time to gather and prepare ingredients and cookware",
		miseEnPlace: "Mise en place",
		scheduleLabel: "Mise en place",
		restsLabel: "Waits",
		restsShortest: "Shortest",
		restsBalanced: "Middle",
		restsLongest: "Longest",
		schedulePerSection: "By section",
		scheduleUpfront: "All at the start",
		schedulePerDay: "By working day",
		dayBefore: "D-",
		dayToday: "Day D",
		runSheetStep: "Step {n}",
		runSheetRest: "Wait",
		runSheetUnnamedSection: "Recipe",
		runSheetProblems: "To fix",
		runSheetOutside:
			"{task}, around {time}, falls when you are not available, and no wait can be moved to fix it.",
		runSheetExceeds:
			"{task} takes {duration} without a break, more than your longest availability ({largest}): widen it.",
		runSheetDayMismatch:
			"The work of {day} falls on {actual} instead of {expected}.",
		runSheetPast:
			"The first task should have started {start}, and it is already {now}.",
		runSheetMulti: "Only the first of {count} recipes is planned.",
		runSheetTitle: "Run sheet",
		runSheetFor: "For {date} at {time}",
		runSheetDays: "{n} day",
		runSheetDaysMany: "{n} days",
		runSheetVisits: "{n} visit to the kitchen",
		runSheetVisitsMany: "{n} visits to the kitchen",
		runSheetWork: "{duration} of work in all",
		runSheetServe: "Serve",
		runSheetAbout: "~ {duration}",
		runSheetKit: "To take out",
		runSheetLegendCook: "in the kitchen",
		runSheetLegendThread: "what goes on without you",
		runSheetProgram: "To do",
		runSheetExecution: "Execution",
		runSheetIngredients: "Ingredients",
		runSheetStart: "Start: {time}",
		runSheetContinued: "continued",
		runSheetLeaving: "Before leaving",
		runSheetMadeOn: "made {day}",
		runSheetMadeAt: "made at {time}",
		runSheetMadeEarlier: "made earlier",
		runSheetInStock: "in stock",
		runSheetProgramStep: "step {n}",
		runSheetProgramSteps: "steps {from} to {to}",
		runSheetRange: "{min} to {max}",
		runSheetPossibleFrom: "Possible from {time}.",
		runSheetFixedService:
			"Can't start earlier: the “{rest}” wait ({section}) can't be longer than {length} and ends when you serve.",
		runSheetFixedVisit:
			"Can't start earlier: the “{rest}” wait ({section}) can't be longer than {length} and must be over before {sections}.",
		runSheetNextVisit: "Next visit: {when}",
		runSheetNextVisitSameDay: "Next visit: later the same day",
		runSheetServeAt: "Serve at {time}",
		runSheetStretchedTo:
			"{wait} extended to {to} (planned {range}) so the work falls within your availability.",
		runSheetShortenedTo:
			"{wait} shortened to {to} (planned {range}) so the work falls within your availability.",
		runSheetUntilClock: "until {time}",
		runSheetNothing: "Nothing to plan.",
		runSheetFindOk: "{when} — start {start} · {visits} · {adjusted}",
		runSheetFindRejected: "{when} — not possible. {reason}",
		runSheetFindStart: "You would have to start {start}, which has passed.",
		runSheetFindNone: "No serving time works between {from} and {to}.",
		runSheetAdjusted: "{n} wait adjusted",
		runSheetAdjustedMany: "{n} waits adjusted",
		runSheetNoAdjustment: "no wait adjusted",
		runSheetEarliest: "Ready as early as {when} if you start now.",
		runSheetEarliestNone:
			"Nothing works in the next {days} days (searched until {until}).",
		est: "(est.)",
		passiveTimeTooltip: "Passive Time (Waiting, resting...)",
		activeTimeTooltip: "Active Time",
		estimateTooltip: "Estimate",
		coverageTooltip: "Coverage",
		unknownCookware: "[Unknown Cookware]",
		reset: "Reset",
		originalRecipe: "Original recipe",
		sectionStandardizedMass: "Section standardized mass",
		bakersPercentage: "Baker's Percentage",
		standardized: "Standardized",
		optional: "Optional",
		calculationPartialOrFailed: "Calculation partial or failed",
		ingredientsOverhead: "Ingredients lookup (base)",
		cookwareOverhead: "Cookware lookup (base)",
		breakdownActive: "Active",
		breakdownPassive: "Passive",
		breakdownTimer: "Timer",
		breakdownPrep: "Preparation",
		// What separates a label from its value: no space before the colon in English.
		colon: ": ",
		standardizedMass: "Standardized mass",
		quantity: "Quantity",
		intermediateIngredient: "Intermediate ingredient",
		// The rows of the tooltip of an ingredient in a step.
		tooltipMass: "Mass",
		tooltipPreparation: "Preparation",
		tooltipBakers: "Baker's %",
		tooltipTakenFrom: "Taken from",
		alternatives: "Alternatives",
		// The deprecated portions stepper of the HTML recipe (`interactiveScaling`).
		// @remove-in: 2.0.0 [renderer-interactive-scaling]
		decreasePortions: "Decrease portions",
		editPortions: "Edit portions directly",
		increasePortions: "Increase portions",
		returnToStep: "Return to step",
		mixedUnitsTooltip:
			"Couldn't be combined into one total — add a density to the ingredient database to merge them",
		mixedUnits: "Mixed units",
		copyShoppingList: "Copy list",
		copied: "Copied!",
		toggleStepDone: "Toggle step completion",
		purchasingWeight: "Purchasing Weight (including waste/peel)",
		gross: "gross",
		intermediateResult: "Intermediate result for this section",
		moduleFrom: "From this module",
		estimatedSuffix: " (Estimated)",
		missingMass: " (Missing: ",
		someIngredients: "some ingredients",
		// The tooltip of a mass (the hero bar's total, a section's badge).
		massTitle: "Ingredient mass, before cooking",
		massSectionTitle: "Mass of this section's ingredients, before cooking",
		massEstimated: "Estimated",
		massEstimatedDetail: "converted with an average value",
		massIncomplete: "Incomplete",
		massIncompleteDetail: "no known mass",
		massMethodDensity: "average density",
		massMethodUnitWeight: "average unit weight",
		massIncompleteHint:
			"Give these a weight in grams, or a density or unit weight in densities: or the ingredient database",
		// Nutrition bases. Which one is shown is the renderer's
		// `nutritionBasis` option; the analyzer computes all three.
		nutritionWholeRecipe: "Whole recipe",
		nutritionPerPortion: "Per portion",
		nutritionPer100g: "Per 100 g",
		// Gram models no cooking loss, so a per-100 g figure is per 100 g of
		// the raw assembled mixture — said plainly rather than left implied.
		// The partial variant is used as soon as some ingredient lacks
		// nutrition data, because the mass then covers only what was counted
		// and not the whole recipe; hedging that way when everything *is*
		// covered would only weaken the message.
		nutritionRawMassNote: "Based on {mass} of ingredients, before cooking",
		nutritionRawMassNotePartial:
			"Based on the {mass} with nutrition data, before cooking",
		incompleteData: "Incomplete data",
		/** Under the nutrition of the text format when a mass was estimated from a density. */
		nutritionEstimated: "estimated values",
		// One entry per key in @gram-lang/analyzer's NUTRIENTS table; the
		// renderer test asserts the two stay in step. A sub-macro's label is
		// prefixed with `ofWhich` at display time rather than baked in here,
		// so the same string works standalone and nested.
		// The nutrition table of the HTML recipe: salt is shown in place of
		// sodium, and the reference intakes are the EU ones.
		nutritionSalt: "Salt",
		nutritionTableTitle: "Nutrition information",
		nutritionReferenceIntake: "%RI",
		nutritionReferenceIntakeNote:
			"Reference intake of an average adult (8,400 kJ / 2,000 kcal)",
		nutritionNutrient: "Nutrient",
		nutritionWholeRecipeTotal: "Whole recipe: {kcal}",
		ofWhich: "of which",
		nutrients: {
			calories: "Energy",
			fat: "Fat",
			sat_fat: "saturates",
			mono_fat: "mono-unsaturates",
			poly_fat: "poly-unsaturates",
			carbs: "Carbohydrates",
			sugar: "sugars",
			fiber: "Fiber",
			protein: "Protein",
			sodium: "Sodium",
			alcohol: "Alcohol",
		},
	},
	playground: {
		title: "Gram Playground",
		inputTab: "Input (.gram)",
		writePlaceholder: "Write your recipe here...",
		outputTab: "Output",
		// The label of the old view selector: the views are tabs now.
		// @remove-in: 2.0.0 [i18n-playground-view-labels]
		viewLabel: "View:",
		formatLabel: "Format",
		loadExample: "Load Example...",
		recipe: "Recipe",
		studioTitle: "Recipe settings",
		settingsButton: "Settings",
		activeOptionsBadge: "{count} active",
		resetAll: "Reset all",
		resetSection: "Reset",
		openScheduleSettings: "Adjust schedule",
		scheduleButton: "Schedule",
		sections: {
			schedule: "Schedule & Service",
			scale: "Scale & Portions",
			bakersMath: "Baker's math",
			display: "Display",
			physics: "Physical analysis & Nutrition",
			stock: "Stock & Modules",
		},
		badges: {
			default: "Default",
			active: "Active",
			inactive: "Inactive",
			standardized: "Standardized",
			nutritionActive: "Nutrition active",
			byIngredient: "By ingredient",
			inStock: "{count} in stock",
			serveAt: "Served at {time}",
			customHours: "Custom hours",
		},
		a11y: {
			closeDrawer: "Close settings panel",
		},
		examples: {
			newRecipe: "Blank (New Recipe)",
			canneles: "Bordeaux Cannelés",
			empanadas: "Beef Empanadas",
		},
		views: {
			// The labels of the old view selector: the outputs are now named by
			// `renderer.outputs`, and the formats by `renderer.formats`.
			// @remove-in: 2.0.0 [i18n-playground-view-labels]
			json: "JSON Output",
			ast: "AST (Raw)",
			jsonTree: "Interactive Tree",
			markdown: "Markdown",
			preview: "Preview (HTML)",
			runSheet: "Run sheet",
			serveWhenTitle: "When to serve?",
			serveWhenNone: "No serving time works in the next seven days.",
			serveWhenWhyNot: "Why not the others?",
			earliestTitle: "Ready as early as",
			earliestNone: "Nothing works in the next 14 days.",
			earliestUse: "Serve then",
			planSummary: "Plan",
			planServeAt: "Serving time",
			planTimeZone: "Time zone",
			planAvailability: "Daily availability",
			planSpecificHours: "Specific hours by day of the week",
			planDayUnavailable: "Unavailable",
			serveAtClear: "Clear",
			serveAtClearTitle: "Clear serve time",
			serveOtherSlots: "Other slots",
			planClear: "Clear the plan",
			planInvalid: "This plan can't be made: {message}",
			// @remove-in: 2.0.0 [i18n-gantt-keys]
			gantt_active: "Active Task",
			gantt_passive: "Background Task",
			gantt_compact: "Compact View",
			gantt_time: "Time",
			gantt_cook: "Actions",
			gantt_timer: "Timer",
			gantt_prep: "Prep",
			gantt_empty:
				"No timing data available. Write a recipe with steps and durations to see the chart.",
			gantt_compressed: "Time compressed (idle period)",
			gantt_assembly: "Assembly / Dependencies",
			gantt_more_sections: "+{count} more...",
			gantt_section: "Section",
			gantt_mode_forward: "Stopwatch (T+)",
			gantt_mode_reverse: "Countdown (T-)",
			gantt_mode_target: "Target Time",
			gantt_target_time_label: "Serve at:",
		},
		options: {
			scaleTitle: "Modify Quantities",
			scalePortions: "Portions",
			scaleGlobal: "Overall Scale",
			scaleByIngredient: "By Ingredient",
			selectIngredient: "Select ingredient...",
			qty: "Qty",
			unit: "Unit",
			apply: "Apply",
			bakersMath: "Baker's Math",
			enableBakersMath: "Enable Baker's Math",
			bakersMathDesc: "Shows ingredients as % of reference.",
			hideAbsolute: "Hide absolute weights",
			showComments: "Show comments",
			commentsDesc:
				"The notes of the recipe (// like this), in the recipe and in the run sheet.",
			showStepQuantities: "Quantities in the steps",
			stepQuantitiesDesc:
				"Writes the quantity of each ingredient in the text of the steps, after its name.",
			nutritionBasis: "Nutrition basis",
			nutritionBasisAuto: "Automatic (every basis, side by side)",
			rejectedSlots: "Unavailable slots:",
			forceReference: "Force Reference:",
			autoDetect: "Auto (detect @*)",
			physicalAnalysis: "Physical Analysis",
			massStandardization: "Mass Standardization",
			massDesc: "Converts all ingredient quantities into grams.",
			yieldManagement: "Yield Management",
			nutrition: "Nutrition Estimation",
			stockTitle: "Stock (skip steps)",
			stockDesc:
				"Treat as already on hand — collapses to one shopping-list line, no timeline steps.",
		},
		help: {
			schedule:
				"Controls when ingredient prep and weighing take place in the schedule: right before each section, all upfront at the start of the recipe, or at the beginning of each working day.",
			rests:
				"Sets the target duration for steps with a flexible time range (e.g. 2h to 12h): the minimum required time, the maximum allowed time, or a balanced midpoint.",
			serveAt:
				"Target meal date and time. The schedule is calculated backwards from this deadline to tell you when to start and be ready right on time.",
			serveSuggestions:
				"Recommended serving times. Gram evaluates rest ranges and your kitchen hours to suggest feasible meal times that require no overnight work.",
			timeZone:
				"Sets the time zone used to display exact clock times on the run sheet and accurately handle day transitions.",
			availability:
				"Your daily kitchen hours. The schedule organizes tasks so you never have to cook outside this window (such as overnight).",
			scalePortions:
				"Sets how many portions the recipe makes: every quantity follows. The same as the overall scale, counted in portions.",
			scaleGlobal:
				"Adjusts all ingredient quantities and portions according to the specified percentage (e.g. 200% to double, 50% to halve).",
			scaleByIngredient:
				"Proportionally recalculates the entire recipe to match the exact quantity you have on hand for a specific ingredient (e.g. only 3 eggs or 250g of butter).",
			bakersMath:
				"Expresses each ingredient as a percentage of a base ingredient set at 100% (typically flour, or any chosen ingredient), making ratios and formulation easy to evaluate.",
			comments:
				"Shows or leaves out the comments written in the recipe with //: the notes alone on a line and the ones at the end of a line. They are set apart discreetly in the run sheet.",
			stepQuantities:
				"Writes each quantity in the step that uses it, with its weight in grams when the masses are standardized. Leave it off for shorter steps: the quantities stay in the ingredient lists.",
			nutritionBasis:
				"Which basis the nutrition panel shows, when the nutrition is estimated. Automatic shows per 100 g and per portion side by side, with the whole recipe under them, in every recipe format.",
			bakersMathOnly:
				"Hides gram weights to display only relative percentages, turning the recipe into a pure ratio formula.",
			bakersReference:
				"Manually selects which ingredient serves as the 100% baseline, overriding automatic detection of the @* ingredient in the recipe.",
			massStandardization:
				"Converts volume measurements (spoons, cups, ml) into grams according to the database densities.",
			yieldManagement:
				"Calculates gross purchasing weight to obtain the desired net quantity, accounting for peeling and trimming waste in the database.",
			nutrition:
				"Estimates calories and macronutrients (protein, carbs, fat, fiber) per serving or per 100g via the nutritional tables in the database.",
			/** The note of the "Schedule & Service" section: what these settings change in each view. */
			scheduleNote:
				"These settings mostly shape the run sheet. In the recipe, only the total and idle times change.",
			scheduleNoteLink: "See the run sheet",
			physicsDisclaimer:
				"In this playground, physical and nutritional calculations rely on an ingredient database limited to example recipes.",
			stockItem:
				"Marks this imported preparation as already on hand in your kitchen. Its prep steps are removed from the schedule, keeping only its final use.",
		},
		output: {
			copy: "Copy to clipboard",
			print: "Print this view",
			/** The tabs of the views of the recipe. */
			views: "Views",
			/** The tab of the inspectors (AST, JSON), apart from the views. */
			inspect: "Inspect",
			loading: "Loading viewer...",
		},
		warnings: {
			consoleTitle: "Diagnostics & Debug",
			errors: "Errors",
			error: "Error",
			warnings: "Warnings",
			warning: "Warning",
			infos: "Notices",
			info: "Notice",
			item: "Item",
			show: "Show",
			expandConsole: "Expand console",
			collapseConsole: "Collapse console",
		},
		errorState: {
			title: VIEWS_PAUSED.title,
			blockingDescription: VIEWS_PAUSED.description,
			jumpToError: "Jump to error",
			line: "Line",
		},
		tabs: {
			addFile: "Add file",
			removeFile: "Remove file",
			renameFile: "Rename file",
			entryFile: "Entry",
			newFileName: "New file name",
			previewingStandalone: "Standalone preview of",
			openFiles: "Open files",
			hasErrors: "has errors",
		},
		mobileTabs: {
			editor: "Editor",
			preview: "Preview",
		},
		fullscreen: "Fullscreen",
		exitFullscreen: "Exit fullscreen",
		analysisOptions: "Analysis Options",
		analysis: "Analysis",
		massNorm: "Mass Normalization",
		yieldMgmt: "Yield Management (Gross Mass)",
		nutritionEst: "Nutrition Estimation",
		statusValid: "Valid",
		statusWarnings: "Warnings",
		copyBtn: "Copy to Clipboard",
	},
};

export type GramLocale = typeof en;
