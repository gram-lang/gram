import type { OgAccent, OgCardInput, OgCodeToken } from "./types";

type SatoriChild = SatoriElement | string | number;

export interface SatoriElement {
	type: string;
	props: Record<string, unknown>;
}

// Colors derived directly from packages/docs/src/styles/global.css tokens.
const SITE_BG = "#1c1916"; // hsl(30, 12%, 10%) --sl-color-bg
const SITE_SURFACE = "#14110e"; // hsl(30, 16%, 7%) --sl-color-black
const SITE_BORDER = "#3f3831"; // hsl(30, 12%, 22%) --sl-color-gray-5
const SITE_TEXT = "#c9c4be"; // hsl(30, 8%, 77%) --sl-color-text
const SITE_MUTED = "#988f86"; // hsl(30, 8%, 56%) --sl-color-gray-3

const ACCENT_PALETTE: Record<
	OgAccent,
	{ bar: string; primary: string; soft: string; border: string }
> = {
	orange: {
		bar: "#ff7f00",
		primary: "#ff8c1a",
		soft: "rgba(255, 127, 0, 0.16)",
		border: "rgba(255, 127, 0, 0.55)",
	},
	teal: {
		bar: "#258681",
		primary: "#2dd4bf",
		soft: "rgba(37, 134, 129, 0.24)",
		border: "rgba(37, 134, 129, 0.65)",
	},
	amber: {
		bar: "#f59e0b",
		primary: "#fbbf24",
		soft: "rgba(245, 158, 11, 0.16)",
		border: "rgba(245, 158, 11, 0.55)",
	},
	blue: {
		bar: "#3b82f6",
		primary: "#60a5fa",
		soft: "rgba(59, 130, 246, 0.18)",
		border: "rgba(59, 130, 246, 0.55)",
	},
};

function h(
	type: string,
	style: Record<string, string | number>,
	children?: SatoriChild | Array<SatoriChild | false | null | undefined>,
	extraProps?: Record<string, unknown>,
): SatoriElement {
	const normalizedChildren = Array.isArray(children)
		? children.filter(
				(child): child is SatoriChild =>
					child !== false && child !== null && child !== undefined,
			)
		: children;

	return {
		type,
		props: {
			...extraProps,
			style,
			...(normalizedChildren !== undefined
				? { children: normalizedChildren }
				: {}),
		},
	};
}

function truncateText(text: string | undefined, maxLength: number): string {
	if (!text) return "";
	const clean = text.replace(/\s+/g, " ").trim();
	if (clean.length <= maxLength) return clean;
	const sliced = clean.slice(0, maxLength - 1);
	const lastSpace = sliced.lastIndexOf(" ");
	return `${(lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}…`;
}

function titleFontSize(title: string, baseSize = 70): number {
	if (title.length > 68) return baseSize - 20;
	if (title.length > 46) return baseSize - 12;
	if (title.length > 28) return baseSize - 6;
	return baseSize;
}

function topicAccent(topicSlug: string): OgAccent {
	switch (topicSlug) {
		case "devlog":
			return "teal";
		case "tutorials":
			return "amber";
		case "announcements":
			return "blue";
		default:
			return "orange";
	}
}

function cardAccent(card: OgCardInput): OgAccent {
	switch (card.kind) {
		case "home":
			return "orange";
		case "blog":
			return topicAccent(card.topicSlug);
		case "docs":
			return card.accent;
		case "playground":
			return "teal";
		case "changelog":
			return "blue";
	}
}

function renderPill(
	label: string,
	accent: OgAccent,
	mono = false,
): SatoriElement {
	const palette = ACCENT_PALETTE[accent];
	return h(
		"div",
		{
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			height: 40,
			padding: "0 18px",
			borderRadius: 4,
			border: `2px solid ${palette.primary}`,
			color: palette.primary,
			fontSize: 19,
			lineHeight: 1,
			fontWeight: 600,
			fontFamily: mono ? "JetBrains Mono" : "Inter",
			letterSpacing: mono ? "-0.02em" : "0.01em",
		},
		label,
	);
}

function renderHeader(
	logoDataUri: string,
	badgeLabel?: string,
	accent: OgAccent = "orange",
	extraPill?: string,
): SatoriElement {
	return h(
		"div",
		{
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			width: "100%",
		},
		[
			h("div", { display: "flex", alignItems: "center", gap: 20 }, [
				h("img", { width: 66, height: 66 }, undefined, {
					src: logoDataUri,
					width: 66,
					height: 66,
				}),
				h(
					"div",
					{
						display: "flex",
						fontSize: 48,
						fontWeight: 700,
						color: "#ffffff",
						letterSpacing: "-0.02em",
					},
					"Gram",
				),
			]),
			badgeLabel || extraPill
				? h("div", { display: "flex", alignItems: "center", gap: 12 }, [
						badgeLabel ? renderPill(badgeLabel, accent) : false,
						extraPill ? renderPill(extraPill, "amber", true) : false,
					])
				: false,
		],
	);
}

function renderFooter(leftLabel: string, rightLabel: string): SatoriElement {
	return h(
		"div",
		{
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			width: "100%",
			paddingTop: 22,
			borderTop: `1px solid ${SITE_BORDER}`,
		},
		[
			h(
				"div",
				{
					display: "flex",
					fontSize: 22,
					color: SITE_MUTED,
					fontFamily: "JetBrains Mono",
				},
				leftLabel,
			),
			h(
				"div",
				{
					display: "flex",
					fontSize: 22,
					color: SITE_TEXT,
					fontWeight: 600,
					fontFamily: "JetBrains Mono",
				},
				rightLabel,
			),
		],
	);
}

function renderGramCodeLine(tokens: OgCodeToken[]): SatoriElement {
	if (tokens.length === 0) {
		return h("div", { display: "flex", height: 10 });
	}

	// Group non-whitespace Shiki fragments into unbreakable words so wraps
	// never split `@` from its ingredient or drop spaces between flex items.
	const words: Array<{
		parts: OgCodeToken[];
		spaceBefore: boolean;
		spaceAfter: boolean;
	}> = [];
	let pendingSpace = false;

	const pushPart = (text: string, color: string) => {
		if (
			!pendingSpace &&
			words.length > 0 &&
			!words[words.length - 1].spaceAfter
		) {
			words[words.length - 1].parts.push({ text, color });
		} else {
			words.push({
				parts: [{ text, color }],
				spaceBefore: pendingSpace,
				spaceAfter: false,
			});
			pendingSpace = false;
		}
	};

	for (const tok of tokens) {
		for (const segment of tok.text.match(/\s+|\S+/g) ?? []) {
			if (/^\s+$/.test(segment)) {
				if (words.length > 0) {
					words[words.length - 1].spaceAfter = true;
				} else {
					pendingSpace = true;
				}
			} else {
				pushPart(segment, tok.color);
			}
		}
	}

	return h(
		"div",
		{
			display: "flex",
			flexWrap: "wrap",
			fontSize: 16,
			lineHeight: 1.6,
			fontFamily: "JetBrains Mono",
			color: "#e1e4e8",
		},
		words.map(({ parts, spaceBefore, spaceAfter }) =>
			h(
				"span",
				{
					display: "flex",
					...(spaceBefore ? { marginLeft: 9 } : {}),
					...(spaceAfter ? { marginRight: 9 } : {}),
				},
				parts.map((part) =>
					h(
						"span",
						{
							display: "flex",
							color: part.color,
							whiteSpace: "pre",
						},
						part.text,
					),
				),
			),
		),
	);
}

function renderGramSnippetBox(tokenLines: OgCodeToken[][]): SatoriElement {
	return h(
		"div",
		{
			display: "flex",
			flexDirection: "column",
			width: 470,
			flexShrink: 0,
			padding: "24px 26px",
			backgroundColor: SITE_SURFACE,
			border: `1px solid ${SITE_BORDER}`,
			gap: 8,
			boxSizing: "border-box",
		},
		tokenLines.map(renderGramCodeLine),
	);
}

function renderHomeCard(
	card: Extract<OgCardInput, { kind: "home" }>,
	logoDataUri: string,
): SatoriElement {
	return h(
		"div",
		{
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-between",
			width: "100%",
			flex: 1,
		},
		[
			renderHeader(logoDataUri, undefined, "orange", `v${card.version}`),
			h(
				"div",
				{
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 44,
					width: "100%",
				},
				[
					h(
						"div",
						{
							display: "flex",
							flexDirection: "column",
							gap: 22,
							flex: 1,
							minWidth: 0,
						},
						[
							h(
								"div",
								{
									display: "flex",
									fontSize: 66,
									fontWeight: 700,
									lineHeight: 1.06,
									color: "#ffffff",
									letterSpacing: "-0.03em",
									textWrap: "balance",
								},
								card.subtitle,
							),
							h(
								"div",
								{
									display: "flex",
									fontSize: 27,
									lineHeight: 1.42,
									color: SITE_TEXT,
									textWrap: "balance",
								},
								truncateText(card.description, 150),
							),
						],
					),
					renderGramSnippetBox(card.recipeTokenLines),
				],
			),
			renderFooter(
				card.locale === "fr"
					? "DSL open-source de recettes"
					: "Open-source recipe DSL",
				"gram-lang.org",
			),
		],
	);
}

function renderBlogCard(
	card: Extract<OgCardInput, { kind: "blog" }>,
	logoDataUri: string,
): SatoriElement {
	const accent = cardAccent(card);

	return h(
		"div",
		{
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-between",
			width: "100%",
			flex: 1,
		},
		[
			renderHeader(logoDataUri, card.topicLabel, accent, card.versionTag),
			h(
				"div",
				{
					display: "flex",
					flexDirection: "column",
					gap: 20,
					maxWidth: 1060,
				},
				[
					card.dateLabel
						? h(
								"div",
								{
									display: "flex",
									fontSize: 23,
									fontWeight: 600,
									color: ACCENT_PALETTE[accent].primary,
								},
								card.dateLabel,
							)
						: false,
					h(
						"div",
						{
							display: "flex",
							fontSize: titleFontSize(card.title, 70),
							fontWeight: 700,
							lineHeight: 1.1,
							color: "#ffffff",
							letterSpacing: "-0.03em",
							textWrap: "balance",
						},
						card.title,
					),
					card.description
						? h(
								"div",
								{
									display: "flex",
									fontSize: 29,
									lineHeight: 1.42,
									color: SITE_TEXT,
									textWrap: "balance",
								},
								truncateText(card.description, 165),
							)
						: false,
				],
			),
			renderFooter(
				card.locale === "fr" ? "Blog · Gram" : "Gram Blog",
				"gram-lang.org",
			),
		],
	);
}

function renderDocsCard(
	card: Extract<OgCardInput, { kind: "docs" }>,
	logoDataUri: string,
): SatoriElement {
	return h(
		"div",
		{
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-between",
			width: "100%",
			flex: 1,
		},
		[
			renderHeader(logoDataUri, card.sectionLabel, card.accent),
			h(
				"div",
				{
					display: "flex",
					flexDirection: "column",
					gap: 22,
					maxWidth: 1060,
				},
				[
					h(
						"div",
						{
							display: "flex",
							fontSize: titleFontSize(card.title, 72),
							fontWeight: 700,
							lineHeight: 1.1,
							color: "#ffffff",
							letterSpacing: "-0.03em",
							textWrap: "balance",
						},
						card.title,
					),
					card.description
						? h(
								"div",
								{
									display: "flex",
									fontSize: 29,
									lineHeight: 1.42,
									color: SITE_TEXT,
									textWrap: "balance",
								},
								truncateText(card.description, 170),
							)
						: false,
				],
			),
			renderFooter(card.breadcrumbPath, "gram-lang.org"),
		],
	);
}

function renderSurfaceCard(
	card: Extract<OgCardInput, { kind: "playground" | "changelog" }>,
	logoDataUri: string,
): SatoriElement {
	const accent = cardAccent(card);
	const badge =
		card.kind === "playground"
			? card.locale === "fr"
				? "Bac à sable interactif"
				: "Interactive Sandbox"
			: card.locale === "fr"
				? "Historique des versions"
				: "Release History";

	return h(
		"div",
		{
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-between",
			width: "100%",
			flex: 1,
		},
		[
			renderHeader(
				logoDataUri,
				badge,
				accent,
				card.version ? `v${card.version}` : undefined,
			),
			h(
				"div",
				{
					display: "flex",
					flexDirection: "column",
					gap: 22,
					maxWidth: 1060,
				},
				[
					h(
						"div",
						{
							display: "flex",
							fontSize: 72,
							fontWeight: 700,
							lineHeight: 1.08,
							color: "#ffffff",
							letterSpacing: "-0.03em",
							textWrap: "balance",
						},
						card.title,
					),
					h(
						"div",
						{
							display: "flex",
							fontSize: 29,
							lineHeight: 1.42,
							color: SITE_TEXT,
							textWrap: "balance",
						},
						truncateText(card.description, 175),
					),
				],
			),
			renderFooter(
				card.kind === "playground"
					? card.locale === "fr"
						? "/fr/play · Parseur, AST, Plan de marche"
						: "/play · Parser, AST, Run sheet"
					: card.locale === "fr"
						? "/fr/changelog"
						: "/changelog",
				"gram-lang.org",
			),
		],
	);
}

export function buildOgElement(
	card: OgCardInput,
	logoDataUri: string,
): SatoriElement {
	const accent = cardAccent(card);
	const palette = ACCENT_PALETTE[accent];

	let inner: SatoriElement;
	switch (card.kind) {
		case "home":
			inner = renderHomeCard(card, logoDataUri);
			break;
		case "blog":
			inner = renderBlogCard(card, logoDataUri);
			break;
		case "docs":
			inner = renderDocsCard(card, logoDataUri);
			break;
		case "playground":
		case "changelog":
			inner = renderSurfaceCard(card, logoDataUri);
			break;
	}

	return h(
		"div",
		{
			display: "flex",
			flexDirection: "column",
			width: 1200,
			height: 630,
			backgroundColor: SITE_BG,
			fontFamily: "Inter",
			color: "#ffffff",
		},
		[
			h(
				"div",
				{
					display: "flex",
					flexDirection: "column",
					width: 1200,
					height: 618,
					boxSizing: "border-box",
					padding: "46px 64px 36px 64px",
				},
				[inner],
			),
			h("div", {
				display: "flex",
				width: 1200,
				height: 12,
				backgroundColor: palette.bar,
			}),
		],
	);
}
