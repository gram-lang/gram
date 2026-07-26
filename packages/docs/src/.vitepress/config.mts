import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-mermaid-viewer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gramGrammarPath = path.resolve(
	__dirname,
	"../../../vscode-extension/dist/syntaxes/gram.tmLanguage.json",
);
const gramGrammar = JSON.parse(fs.readFileSync(gramGrammarPath, "utf-8"));

export default withMermaid(
	defineConfig({
		title: "Gram",
		description: "A smart, data-driven recipe markup language for developers.",
		base: "/",
		cleanUrls: false,
		ignoreDeadLinks: true,
		srcExclude: ["**/reference/api/parts/**"],

		vite: {
			build: {
				target: "esnext",
				chunkSizeWarningLimit: 4000, // Increase warning limit to 4MB for Monaco Editor
				rollupOptions: {
					output: {
						manualChunks(id) {
							if (
								id.includes("node_modules/monaco-editor") ||
								id.includes("node_modules/@guolao/vue-monaco-editor")
							) {
								return "monaco-editor";
							}
							if (
								id.includes("node_modules/shiki") ||
								id.includes("node_modules/@shikijs")
							) {
								return "shiki";
							}
						},
					},
				},
			},
			optimizeDeps: {
				include: [
					"dayjs",
					"dayjs/plugin/duration.js",
					"mermaid",
					"vitepress-mermaid-viewer",
				],
				esbuildOptions: {
					target: "esnext",
				},
			},
		},

		head: [
			["link", { rel: "icon", href: "/logo.svg" }],
			["script", { src: "https://unpkg.com/@phosphor-icons/web" }],
			[
				"script",
				{},
				`
			if (typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '/index.html')) {
				var lang = navigator.language || navigator.userLanguage || '';
				if (lang.toLowerCase().startsWith('fr') && !sessionStorage.getItem('lang_redirected')) {
					sessionStorage.setItem('lang_redirected', 'true');
					window.location.replace('/fr/');
				}
			}
			`,
			],
		],

		markdown: {
			languages: [
				{
					...gramGrammar,
					name: "gram",
				},
			],
		},

		locales: {
			root: {
				label: "English",
				lang: "en",
				themeConfig: {
					nav: [
						{ text: "Documentation", link: "/explanation/philosophy" },
						{ text: "Playground", link: "/play" },
						{
							text: "v1.0.0-beta.5",
							items: [{ text: "v1.0.0-beta.5 (Current)", link: "/" }],
						},
					],
					sidebar: [
						{
							text: "Introduction",
							collapsed: false,
							items: [
								{ text: "What is Gram?", link: "/explanation/philosophy" },
								{ text: "Getting Started", link: "/tutorials/getting-started" },
								{ text: "Your First Recipe", link: "/tutorials/first-recipe" },
							],
						},
						{
							text: "How-To Guides",
							collapsed: false,
							items: [
								{ text: "Manage Database", link: "/how-to/manage-database" },
								{
									text: "Scale Recipes Dynamically",
									link: "/how-to/scale-recipes",
								},
								{
									text: "Generate Shopping List",
									link: "/how-to/weekly-shopping-list",
								},
								{
									text: "How to Build a Custom UI",
									link: "/how-to/build-custom-ui",
								},
							],
						},
						{
							text: "Reference",
							collapsed: true,
							items: [
								{
									text: "Document Structure",
									link: "/reference/syntax/document-structure",
								},
								{ text: "Ingredients", link: "/reference/syntax/ingredients" },
								{ text: "Cookware", link: "/reference/syntax/cookware" },
								{ text: "Times", link: "/reference/syntax/times" },
								{
									text: "Temperatures",
									link: "/reference/syntax/temperatures",
								},
								{
									text: "Intermediate Variables",
									link: "/reference/syntax/intermediate-variables",
								},
								{
									text: "Relative Quantities",
									link: "/reference/syntax/relative-quantities",
								},
								{
									text: "Composite Ingredients",
									link: "/reference/syntax/composite-ingredients",
								},
								{ text: "Cheatsheet", link: "/reference/syntax/cheatsheet" },
								{
									text: "Writing Gram Programmatically",
									link: "/reference/syntax/ai-generation-notes",
								},
								{ text: "CLI Commands", link: "/reference/tooling/cli" },
								{
									text: "VS Code Extension",
									link: "/reference/tooling/vscode-extension",
								},
								{
									text: "Language Server",
									link: "/reference/tooling/language-server",
								},
							],
						},
						{
							text: "API Reference",
							collapsed: true,
							items: [
								{ text: "Overview", link: "/reference/api/" },
								{ text: "@gram-lang/parser", link: "/reference/api/parser" },
								{ text: "@gram-lang/kitchen", link: "/reference/api/kitchen" },
								{
									text: "@gram-lang/analyzer",
									link: "/reference/api/analyzer",
								},
								{
									text: "@gram-lang/renderer",
									link: "/reference/api/renderer",
								},
								{ text: "@gram-lang/format", link: "/reference/api/format" },
								{ text: "@gram-lang/i18n", link: "/reference/api/i18n" },
								{ text: "Data Formats", link: "/reference/api/data-formats" },
								{ text: "Warnings", link: "/reference/api/warnings" },
							],
						},
						{
							text: "Gram Engine",
							collapsed: true,
							items: [
								{
									text: "The Gram Lifecycle",
									link: "/explanation/engine/lifecycle",
								},
								{ text: "Parsing & AST", link: "/explanation/engine/parser" },
								{
									text: "Compilation & Structure",
									link: "/explanation/engine/kitchen",
								},
								{
									text: "Semantic Analysis",
									link: "/explanation/engine/analyzer",
								},
								{
									text: "Rendering & Output",
									link: "/explanation/engine/renderer",
								},
							],
						},
						{
							text: "Deep Dives",
							collapsed: true,
							items: [
								{
									text: "ALAP Scheduling",
									link: "/explanation/alap-scheduling",
								},
								{ text: "Mass & Yield", link: "/explanation/mass-and-yield" },
								{ text: "Nutrition", link: "/explanation/nutrition" },
								{
									text: "Shopping Lists",
									link: "/explanation/shopping-list-aggregation",
								},
								{ text: "Scaling", link: "/explanation/scaling" },
							],
						},
					],
				},
			},
			fr: {
				label: "Français",
				lang: "fr",
				link: "/fr/",
				description:
					"Un langage de balisage de recettes intelligent et orienté données pour les développeurs.",
				themeConfig: {
					nav: [
						{ text: "Documentation", link: "/fr/explanation/philosophy" },
						{ text: "Playground", link: "/fr/play" },
						{
							text: "v1.0.0-beta.5",
							items: [{ text: "v1.0.0-beta.5 (Actuelle)", link: "/fr/" }],
						},
					],
					sidebar: [
						{
							text: "Introduction",
							collapsed: false,
							items: [
								{
									text: "C'est quoi Gram ?",
									link: "/fr/explanation/philosophy",
								},
								{
									text: "Pour commencer",
									link: "/fr/tutorials/getting-started",
								},
								{
									text: "Votre première recette",
									link: "/fr/tutorials/first-recipe",
								},
							],
						},
						{
							text: "Guides pratiques",
							collapsed: false,
							items: [
								{
									text: "Gérer la base de données",
									link: "/fr/how-to/manage-database",
								},
								{
									text: "Mise à l'échelle dynamique",
									link: "/fr/how-to/scale-recipes",
								},
								{
									text: "Générer la liste de courses",
									link: "/fr/how-to/weekly-shopping-list",
								},
								{
									text: "Créer une UI personnalisée",
									link: "/fr/how-to/build-custom-ui",
								},
							],
						},
						{
							text: "Référence",
							collapsed: true,
							items: [
								{
									text: "Structure du Document",
									link: "/fr/reference/syntax/document-structure",
								},
								{
									text: "Ingrédients",
									link: "/fr/reference/syntax/ingredients",
								},
								{ text: "Matériel", link: "/fr/reference/syntax/cookware" },
								{ text: "Temps", link: "/fr/reference/syntax/times" },
								{
									text: "Températures",
									link: "/fr/reference/syntax/temperatures",
								},
								{
									text: "Variables Intermédiaires",
									link: "/fr/reference/syntax/intermediate-variables",
								},
								{
									text: "Quantités Relatives",
									link: "/fr/reference/syntax/relative-quantities",
								},
								{
									text: "Ingrédients Composites",
									link: "/fr/reference/syntax/composite-ingredients",
								},
								{ text: "Antisèche", link: "/fr/reference/syntax/cheatsheet" },
								{
									text: "Génération Automatisée de Gram",
									link: "/fr/reference/syntax/ai-generation-notes",
								},
								{ text: "Commandes CLI", link: "/fr/reference/tooling/cli" },
								{
									text: "Extension VS Code",
									link: "/fr/reference/tooling/vscode-extension",
								},
								{
									text: "Language Server",
									link: "/fr/reference/tooling/language-server",
								},
							],
						},
						{
							text: "Référence API",
							collapsed: true,
							items: [
								{ text: "Vue d'ensemble", link: "/fr/reference/api/" },
								{ text: "@gram-lang/parser", link: "/fr/reference/api/parser" },
								{
									text: "@gram-lang/kitchen",
									link: "/fr/reference/api/kitchen",
								},
								{
									text: "@gram-lang/analyzer",
									link: "/fr/reference/api/analyzer",
								},
								{
									text: "@gram-lang/renderer",
									link: "/fr/reference/api/renderer",
								},
								{ text: "@gram-lang/format", link: "/fr/reference/api/format" },
								{ text: "@gram-lang/i18n", link: "/fr/reference/api/i18n" },
								{
									text: "Formats de Données",
									link: "/fr/reference/api/data-formats",
								},
								{ text: "Avertissements", link: "/fr/reference/api/warnings" },
							],
						},
						{
							text: "Moteur Gram",
							collapsed: true,
							items: [
								{
									text: "Cycle de vie",
									link: "/fr/explanation/engine/lifecycle",
								},
								{
									text: "Parsing & AST",
									link: "/fr/explanation/engine/parser",
								},
								{
									text: "Compilation & Structure",
									link: "/fr/explanation/engine/kitchen",
								},
								{
									text: "Analyse Sémantique",
									link: "/fr/explanation/engine/analyzer",
								},
								{
									text: "Rendu & Sortie",
									link: "/fr/explanation/engine/renderer",
								},
							],
						},
						{
							text: "Analyses approfondies",
							collapsed: true,
							items: [
								{
									text: "Ordonnancement ALAP",
									link: "/fr/explanation/alap-scheduling",
								},
								{
									text: "Masse & Rendement",
									link: "/fr/explanation/mass-and-yield",
								},
								{ text: "Nutrition", link: "/fr/explanation/nutrition" },
								{
									text: "Liste de courses",
									link: "/fr/explanation/shopping-list-aggregation",
								},
								{ text: "Mise à l'échelle", link: "/fr/explanation/scaling" },
							],
						},
					],
					outline: {
						label: "Sur cette page",
					},
					docFooter: {
						prev: "Page précédente",
						next: "Page suivante",
					},
					returnToTopLabel: "Retour en haut",
					sidebarMenuLabel: "Menu",
					darkModeSwitchLabel: "Apparence",
					lightModeSwitchLabel: "Apparence",
				},
			},
		},

		themeConfig: {
			logo: "/logo.svg",
			search: {
				provider: "local",
				options: {
					locales: {
						fr: {
							translations: {
								button: {
									buttonText: "Rechercher",
									buttonAriaLabel: "Rechercher",
								},
								modal: {
									displayDetails: "Afficher les détails",
									resetButtonTitle: "Effacer",
									backButtonTitle: "Fermer",
									noResultsText: "Aucun résultat pour",
									footer: {
										selectText: "pour sélectionner",
										navigateText: "pour naviguer",
										closeText: "pour fermer",
									},
								},
							},
						},
					},
				},
			},
			socialLinks: [
				{
					icon: {
						svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Codeberg</title><path d="M11.999.747A11.974 11.974 0 0 0 0 12.75c0 2.254.635 4.465 1.833 6.376L11.837 6.19c.072-.092.251-.092.323 0l4.178 5.402h-2.992l.065.239h3.113l.882 1.138h-3.674l.103.374h3.86l.777 1.003h-4.358l.135.483h4.593l.695.894h-5.038l.165.589h5.326l.609.785h-5.717l.182.65h6.038l.562.727h-6.397l.183.65h6.717A12.003 12.003 0 0 0 24 12.75 11.977 11.977 0 0 0 11.999.747zm3.654 19.104.182.65h5.326c.173-.204.353-.433.513-.65zm.385 1.377.18.65h3.563c.233-.198.485-.428.712-.65zm.383 1.377.182.648h1.203c.356-.204.685-.412 1.042-.648zz"/></svg>',
					},
					link: "https://codeberg.org/abiwab/gram",
				},
			],
		},
	}),
);
