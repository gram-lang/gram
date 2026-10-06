import type { Root, Text } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

export interface FrenchTypographyOptions {
	/**
	 * Utiliser l'espace fine insécable (U+202F) pour ! ? ; les incises et les nombres.
	 * Si false, utilise l'espace insécable standard (U+00A0) partout.
	 * @default true
	 */
	useNarrow?: boolean;
}

export const NBSP = "\u00A0"; // Espace insécable standard
export const NNBSP = "\u202F"; // Espace fine insécable

export function formatFrenchTypography(text: string, useNarrow = true): string {
	const fineSpace = useNarrow ? NNBSP : NBSP;
	let val = text;

	// 1. Deux-points (toujours espace insécable standard U+00A0 devant)
	val = val.replace(/(\S)[ \t]+:(?=[\s»”’"'\n\r]|$)/g, `$1${NBSP}:`);

	// 2. Point d'interrogation, d'exclamation, point-virgule (espace fine insécable ou standard)
	val = val.replace(
		/(\S)[ \t]+([?!;]+)(?=[\s)\]»”’"'\n\r]|$)/g,
		`$1${fineSpace}$2`,
	);

	// 3. Guillemets français « mot et mot »
	// Après « : espace insécable
	val = val.replace(/«[ \t]+/g, `«${NBSP}`);
	// Avant » : espace insécable
	val = val.replace(/[ \t]+»/g, `${NBSP}»`);

	// 4. Symboles %, €, $, etc. après un chiffre
	val = val.replace(/(\d)[ \t]+([%‰°€$£¥])/g, `$1${NBSP}$2`);

	// 5. Tiret cadratin ou demi-cadratin comme incise ( — ou – )
	val = val.replace(/(\S)[ \t]+([—–])(?=[ \t])/g, `$1${fineSpace}$2`);

	// 6. Tranches de 3 chiffres dans les nombres (ex. 10 000, 1 000 000)
	while (/(\b\d{1,3})[ \t]+(\d{3})\b/.test(val)) {
		val = val.replace(/(\b\d{1,3})[ \t]+(\d{3})\b/g, `$1${fineSpace}$2`);
	}

	return val;
}

export function remarkFrenchTypography(options: FrenchTypographyOptions = {}) {
	const useNarrow = options.useNarrow ?? true;

	return (tree: Root, file: VFile) => {
		const rawPath = file?.path || file?.history?.[0] || "";
		const normalizedPath = rawPath.replace(/\\/g, "/");
		const astroData = file?.data as
			| { astro?: { frontmatter?: { lang?: string; locale?: string } } }
			| undefined;
		const lang =
			astroData?.astro?.frontmatter?.lang ??
			astroData?.astro?.frontmatter?.locale;

		const isFrench = normalizedPath.includes("/fr/") || lang === "fr";
		if (!isFrench) return;

		visit(tree, "text", (node: Text) => {
			node.value = formatFrenchTypography(node.value, useNarrow);
		});
	};
}
