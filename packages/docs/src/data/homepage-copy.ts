export interface HomepageCopy {
	versionText: string;
	heroTitle: string;
	heroSubtitle: string;
	heroDescription: string;
	heroGetStarted: string;
	heroPlayground: string;

	recipeFileName: string;
	recipeCode: string;

	whyGram: string;
	whyGramDesc: string;
	learnMore: string;
	philosophy: Array<{
		title: string;
		icon: string;
		details: string;
		link: string;
	}>;

	discoverGram: string;
	discoverDesc: string;

	tabNutritionTitle: string;
	tabNutritionDesc: string;
	tabNutritionLink: string;
	tabScheduleTitle: string;
	tabScheduleDesc: string;
	tabScheduleLink: string;
	tabScaleTitle: string;
	tabScaleDesc: string;
	tabScaleLink: string;
	tryPlaygroundBtn: string;

	tabInput: string;
	tabOutput: string;

	nutritionInput: string;
	nutritionOutput: string;
	scheduleInput: string;
	scheduleOutput: string;
	scaleInput: string;
	scaleOutput: string;

	getInvolved: string;
	readBookTitle: string;
	readBookDesc: string;
	readBookLink: string;

	contributeTitle: string;
	contributeDesc: string;
	contributeLink: string;

	tryTitle: string;
	tryDesc: string;
}

export const homepageCopy: Record<"en" | "fr", HomepageCopy> = {
	en: {
		versionText: "Version 1.0.0-beta.5",
		heroTitle: "Gram",
		heroSubtitle: "An open-source markup language for recipes.",
		heroDescription:
			"Treat your recipes like code. Built to handle complex culinary logic, Gram compiles your plain-text instructions into structured, predictable, and relational data.",
		heroGetStarted: "Get Started",
		heroPlayground: "Playground",

		recipeFileName: "lemon-curd.gram",
		recipeCode: `## Lemon Curd

[Mix] Whisk @lemon juice{100 g}<@lemons{3}, @eggs{2}, and @sugar{120% @&lemon juice} in a #saucepan{}. ->&base{}

[Cook] Heat the &base{} to ^{82C} over medium heat for ~{5m}.

[Emulsify] Remove from heat and blend in @butter{120 g}. Chill for ~_fridge{2h}.`,

		whyGram: "Design Philosophy",
		whyGramDesc:
			"Gram is built to be simple to write, easy to version, and powerful to parse.",
		learnMore: "Learn more",
		philosophy: [
			{
				title: "Plain Text & Git Friendly",
				icon: "document",
				details:
					"No proprietary database or vendor lock-in. Your recipes are simple text files that can be versioned with Git, shared easily, and edited in any text editor.",
				link: "/docs/explanation/philosophy",
			},
			{
				title: "Dynamic Evaluation",
				icon: "setting",
				details:
					"Stop calculating hydration or portion sizes manually. The language natively handles arithmetic expressions, variable declarations, and unit conversions.",
				link: "/docs/explanation/scaling",
			},
			{
				title: "Type-Safe Tooling",
				icon: "laptop",
				details:
					"Powered by a dedicated Language Server (LSP) giving you real-time diagnostics, semantic highlighting, and autocomplete directly in your IDE.",
				link: "/docs/reference/tooling/vscode-extension",
			},
			{
				title: "Compile Everywhere",
				icon: "puzzle",
				details:
					"Gram parses your recipes into a rich AST. Easily export them to JSON, Markdown, render them as HTML, or feed them into your favorite static site generator to build your own custom cookbook.",
				link: "/docs/reference/api/kitchen",
			},
			{
				title: "Powerful CLI",
				icon: "rocket",
				details:
					"Manage your workspace directly from the terminal. The official CLI lets you initialize projects, format files, and compile your recipes with ease.",
				link: "/docs/reference/tooling/cli",
			},
		],

		discoverGram: "Gram in Practice",
		discoverDesc:
			"A few examples of how the compiler parses plain text into structured recipe data.",

		tabNutritionTitle: "Database & Nutrition",
		tabNutritionDesc:
			"Standardize measurements and calculate nutrition using a local database generated automatically from your workspace.",
		tabNutritionLink: "/docs/how-to/manage-database/",
		tabScheduleTitle: "ALAP Scheduling",
		tabScheduleDesc:
			"Extracts duration metadata to build an execution timeline, scheduling passive tasks 'As Late As Possible'.",
		tabScheduleLink: "/docs/explanation/alap-scheduling",
		tabScaleTitle: "Baker's Math & Precision",
		tabScaleDesc:
			"Supports baker's percentages. Declare ingredients relative to a base ingredient to easily scale your recipes.",
		tabScaleLink: "/docs/how-to/scale-recipes/",
		tryPlaygroundBtn: "Try it in the Playground",

		tabInput: "Gram Syntax",
		tabOutput: "Parsed Result",

		nutritionInput: `## Chantilly Cream\n\n[Whisk] @heavy cream{1 cup} and @powdered sugar{2 tbsp} until soft peaks form.\n\n[Fold] Gently incorporate @vanilla extract{1 tsp}.`,
		nutritionOutput: JSON.stringify(
			{
				shopping_list: [
					{
						id: "heavy-cream",
						name: "heavy cream",
						qty: 1,
						unit: "cup",
						normalizedMass: 240,
						isEstimate: true,
						conversionMethod: "estimate",
					},
					{
						id: "powdered-sugar",
						name: "powdered sugar",
						qty: 2,
						unit: "tbsp",
						normalizedMass: 300,
						isEstimate: true,
						conversionMethod: "estimate",
					},
					{
						id: "vanilla-extract",
						name: "vanilla extract",
						qty: 1,
						unit: "tsp",
						normalizedMass: 300,
						isEstimate: true,
						conversionMethod: "estimate",
					},
				],
			},
			null,
			2,
		),

		scheduleInput: `## Tomato Basil Pasta\n\n[Boil] The @pasta{200g} in salted water for ~_boiling{10min}. ->&cooked pasta{}\n\n[Sauté] @cherry tomatoes{200g} and @garlic{2 cloves} in @olive oil{} for ~{5min}. ->&sauce\n\n[Toss] The &cooked pasta{} into the hot &sauce with @fresh basil{1 handful}.`,
		scheduleOutput: JSON.stringify(
			{
				metrics: {
					totalTime: 19,
					totalBreakdown: [
						{
							label: "timer_named:boiling",
							duration: 10,
						},
						{
							label: "section_active:Tomato Basil Pasta",
							duration: 2,
						},
					],
					idleTime: 5,
					activeTime: 7,
					activeBreakdown: [
						{
							label: "section_active:Tomato Basil Pasta",
							duration: 7,
						},
					],
					preparationTime: 7,
					prepBreakdown: [
						{
							label: "ingredients_overhead",
							duration: 7,
						},
					],
				},
			},
			null,
			2,
		),

		scaleInput: `## Country Loaf\n\n[Mix] The @*bread flour{400g}, @whole wheat flour{100g}, @water{75% @&bread flour}, @salt{2% @&bread flour}, and @levain{20% @&bread flour}.`,
		scaleOutput: JSON.stringify(
			{
				shopping_list: [
					{
						id: "bread-flour",
						name: "bread flour",
						modifiers: ["bakers_percentage"],
						qty: 400,
						unit: "g",
						normalizedMass: 400,
						isEstimate: false,
						conversionMethod: "physical",
						bakersPercentage: 100,
					},
					{
						id: "whole-wheat-flour",
						name: "whole wheat flour",
						qty: 100,
						unit: "g",
						normalizedMass: 100,
						isEstimate: false,
						conversionMethod: "physical",
						bakersPercentage: 25,
					},
					{
						id: "water",
						name: "Water",
						relative: true,
						normalizedMass: 300,
						isEstimate: false,
						conversionMethod: "relative",
						qty: 300,
						unit: "g",
						bakersPercentage: 75,
					},
					{
						id: "salt",
						name: "Salt",
						relative: true,
						normalizedMass: 8,
						isEstimate: false,
						conversionMethod: "relative",
						qty: 8,
						unit: "g",
						bakersPercentage: 2,
					},
					{
						id: "levain",
						name: "levain",
						relative: true,
						normalizedMass: 80,
						isEstimate: false,
						conversionMethod: "relative",
						qty: 80,
						unit: "g",
						bakersPercentage: 20,
					},
				],
			},
			null,
			2,
		),

		getInvolved: "Get Involved",
		readBookTitle: "Explore the Language",
		readBookDesc:
			"The official documentation provides a complete guide to Gram's syntax, tooling, and inner workings. Ideal for getting started or deep-diving into the language.",
		readBookLink: "Read the docs",

		contributeTitle: "Contribute",
		contributeDesc:
			"Gram is built openly and collaboratively. You can browse the source code, report issues, or submit patches to the compiler and documentation.",
		contributeLink: "View on official repository",

		tryTitle: "Start Cooking",
		tryDesc:
			"Scaffold a new recipe workspace in seconds. The CLI sets up everything you need to start writing Gram locally.",
	},
	fr: {
		versionText: "Version 1.0.0-beta.5",
		heroTitle: "Gram",
		heroSubtitle: "Un langage de balisage open-source pour vos recettes.",
		heroDescription:
			"Traitez vos recettes comme du code. Conçu pour gérer la complexité de la logique culinaire, Gram compile vos instructions en texte brut vers des données structurées, prévisibles et relationnelles.",
		heroGetStarted: "Démarrer",
		heroPlayground: "Playground",

		recipeFileName: "cremeux-citron.gram",
		recipeCode: `## Crémeux Citron

[Mélanger] Fouetter le @jus de citron{100 g}<@citrons{3}, les @œufs{2}, et le @sucre{120% @&jus de citron} dans une #casserole{}. ->&base{}

[Cuire] Chauffer la &base{} à ^{82C} sur feu moyen pendant ~{5m}.

[Emulsionner] Retirer du feu et incorporer le @beurre{120 g}. Réserver au frais pendant ~_frigo{2h}.`,

		whyGram: "Philosophie",
		whyGramDesc:
			"Pensé pour être simple à écrire, intuitif à versionner et redoutable au parsing.",
		learnMore: "En savoir plus",
		philosophy: [
			{
				title: "Texte Brut & Git",
				icon: "document",
				details:
					"Aucune base de données propriétaire ni d'enfermement. Vos recettes sont de simples fichiers texte, prêts à être versionnés sur Git, partagés librement et édités où vous le souhaitez.",
				link: "/fr/docs/explanation/philosophy",
			},
			{
				title: "Évaluation Dynamique",
				icon: "setting",
				details:
					"Fini les calculs manuels pour l'hydratation ou le redimensionnement de vos plats. Gram interprète nativement l'arithmétique, les variables et la conversion d'unités.",
				link: "/fr/docs/explanation/scaling",
			},
			{
				title: "Un Outillage Robuste",
				icon: "laptop",
				details:
					"Grâce à son serveur de langage (LSP) dédié, profitez de l'autocomplétion, de la coloration sémantique et du retour d'erreurs en temps réel, directement dans votre éditeur favori.",
				link: "/fr/docs/reference/tooling/vscode-extension",
			},
			{
				title: "Exportez Partout",
				icon: "puzzle",
				details:
					"Gram transforme vos recettes en un arbre de données (AST) riche. Générez du JSON ou du Markdown, et alimentez n'importe quel générateur de site statique pour créer le livre de recettes de vos rêves.",
				link: "/fr/docs/reference/api/kitchen",
			},
			{
				title: "Une CLI pour les Devs",
				icon: "rocket",
				details:
					"Pilotez votre espace de travail depuis le terminal. La CLI officielle vous permet d'initialiser un projet, de formater vos fichiers et de compiler vos recettes en une seule commande.",
				link: "/fr/docs/reference/tooling/cli",
			},
		],

		discoverGram: "Gram en Pratique",
		discoverDesc:
			"Découvrez comment le compilateur transforme vos instructions textuelles en données structurées.",

		tabNutritionTitle: "Base de Données & Nutrition",
		tabNutritionDesc:
			"Uniformisez vos mesures et calculez les apports nutritionnels grâce à une base de données locale générée automatiquement à partir de vos fichiers.",
		tabNutritionLink: "/fr/docs/how-to/manage-database/",
		tabScheduleTitle: "Planification Intelligente (ALAP)",
		tabScheduleDesc:
			"Générez des diagrammes d'exécution. Gram extrait vos temps de cuisson et repousse les tâches passives 'Aussi Tard Que Possible' pour optimiser votre temps en cuisine.",
		tabScheduleLink: "/fr/docs/explanation/alap-scheduling",
		tabScaleTitle: "Le Pourcentage du Boulanger",
		tabScaleDesc:
			"Gérez nativement le pourcentage du boulanger. Liez vos ingrédients à une masse de référence pour recalculer n'importe quelle recette en un instant.",
		tabScaleLink: "/fr/docs/how-to/scale-recipes/",
		tryPlaygroundBtn: "Tester dans le Playground",

		tabInput: "Syntaxe Gram",
		tabOutput: "Résultat Parsé",

		nutritionInput: `## Crème Chantilly\n\n[Fouetter] La @crème liquide{1 cup} et le @sucre glace{2 tbsp} jusqu'à obtenir des pics souples.\n\n[Incorporer] Ajouter délicatement l'@extrait de vanille{1 tsp}.`,
		nutritionOutput: JSON.stringify(
			{
				shopping_list: [
					{
						id: "creme-liquide",
						name: "crème liquide",
						qty: 1,
						unit: "cup",
						normalizedMass: 240,
						isEstimate: true,
						conversionMethod: "estimate",
					},
					{
						id: "sucre-glace",
						name: "sucre glace",
						qty: 2,
						unit: "tbsp",
						normalizedMass: 300,
						isEstimate: true,
						conversionMethod: "estimate",
					},
					{
						id: "extrait-de-vanille",
						name: "extrait de vanille",
						qty: 1,
						unit: "tsp",
						normalizedMass: 300,
						isEstimate: true,
						conversionMethod: "estimate",
					},
				],
			},
			null,
			2,
		),

		scheduleInput: `## Pâtes Tomate Basilic\n\n[Bouillir] Les @pâtes{200g} dans de l'eau salée pendant ~_ebullition{10min}. ->&pâtes cuites{}\n\n[Sauter] Les @tomates cerises{200g} et l'@ail{2 gousses} dans de l'@huile d'olive{} pendant ~{5min}. ->&sauce\n\n[Mélanger] Les &pâtes cuites{} dans la &sauce chaude avec du @basilic frais{1 poignée}.`,
		scheduleOutput: JSON.stringify(
			{
				metrics: {
					totalTime: 19,
					totalBreakdown: [
						{
							label: "timer_named:ebullition",
							duration: 10,
						},
						{
							label: "section_active:Pâtes Tomate Basilic",
							duration: 2,
						},
					],
					idleTime: 5,
					activeTime: 7,
					activeBreakdown: [
						{
							label: "section_active:Pâtes Tomate Basilic",
							duration: 7,
						},
					],
					preparationTime: 7,
					prepBreakdown: [
						{
							label: "ingredients_overhead",
							duration: 7,
						},
					],
				},
			},
			null,
			2,
		),

		scaleInput: `## Pain de Campagne\n\n[Mélanger] La @*farine à pain{400g}, la @farine complète{100g}, l'@eau{75% @&farine à pain}, le @sel{2% @&farine à pain}, et le @levain{20% @&farine à pain}.`,
		scaleOutput: JSON.stringify(
			{
				shopping_list: [
					{
						id: "farine-a-pain",
						name: "farine à pain",
						modifiers: ["bakers_percentage"],
						qty: 400,
						unit: "g",
						normalizedMass: 400,
						isEstimate: false,
						conversionMethod: "physical",
						bakersPercentage: 100,
					},
					{
						id: "farine-complete",
						name: "farine complète",
						qty: 100,
						unit: "g",
						normalizedMass: 100,
						isEstimate: false,
						conversionMethod: "physical",
						bakersPercentage: 25,
					},
					{
						id: "eau",
						name: "Eau",
						relative: true,
						normalizedMass: 300,
						isEstimate: false,
						conversionMethod: "relative",
						qty: 300,
						unit: "g",
						bakersPercentage: 75,
					},
					{
						id: "sel",
						name: "Sel",
						relative: true,
						normalizedMass: 8,
						isEstimate: false,
						conversionMethod: "relative",
						qty: 8,
						unit: "g",
						bakersPercentage: 2,
					},
					{
						id: "levain",
						name: "levain",
						relative: true,
						normalizedMass: 80,
						isEstimate: false,
						conversionMethod: "relative",
						qty: 80,
						unit: "g",
						bakersPercentage: 20,
					},
				],
			},
			null,
			2,
		),

		getInvolved: "Rejoindre le Projet",
		readBookTitle: "Découvrir le Langage",
		readBookDesc:
			"Le guide de référence pour tout comprendre de Gram : sa syntaxe, son outillage et son moteur. Le point d'entrée idéal pour se lancer ou creuser les concepts avancés.",
		readBookLink: "Lire la documentation",

		contributeTitle: "Contribuer",
		contributeDesc:
			"Gram est un projet ouvert et collaboratif. N'hésitez pas à explorer le code source, signaler un bug ou proposer des améliorations sur le compilateur et la documentation.",
		contributeLink: "Voir sur le dépôt officiel",

		tryTitle: "Créer un Projet",
		tryDesc:
			"Démarrez un nouvel espace de travail en quelques secondes. Notre CLI s'occupe de générer tout le nécessaire pour que vous puissiez écrire vos premières recettes en un clin d'œil.",
	},
};
