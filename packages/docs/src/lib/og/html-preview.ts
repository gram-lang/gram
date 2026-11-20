import { getLogoDataUri } from "./render";
import { buildOgElement, type SatoriElement } from "./templates";
import type { OgCardInput } from "./types";

const UNITLESS_PROPS = new Set([
	"flex",
	"flexGrow",
	"flexShrink",
	"fontWeight",
	"lineHeight",
	"opacity",
	"zIndex",
]);

function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function styleToCss(style: Record<string, string | number>): string {
	return Object.entries(style)
		.map(([key, value]) => {
			const cssProp = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
			const cssVal =
				typeof value === "number" && value !== 0 && !UNITLESS_PROPS.has(key)
					? `${value}px`
					: String(value);
			return `${cssProp}: ${cssVal}`;
		})
		.join("; ");
}

function serializeNode(node: SatoriElement | string | number): string {
	if (typeof node === "string" || typeof node === "number") {
		return escapeHtml(String(node));
	}

	const { style = {}, children, ...attrs } = node.props;
	const attrPairs: string[] = [];

	const css = styleToCss(style as Record<string, string | number>);
	if (css) attrPairs.push(`style="${escapeHtml(css)}"`);

	for (const [k, v] of Object.entries(attrs)) {
		if (v === undefined || v === null) continue;
		attrPairs.push(`${k}="${escapeHtml(String(v))}"`);
	}

	const attrString = attrPairs.length > 0 ? ` ${attrPairs.join(" ")}` : "";

	if (node.type === "img") {
		return `<img${attrString} />`;
	}

	const childHtml = Array.isArray(children)
		? children.map(serializeNode).join("")
		: children !== undefined && children !== null
			? serializeNode(children as SatoriElement | string | number)
			: "";

	return `<${node.type}${attrString}>${childHtml}</${node.type}>`;
}

export function renderOgHtml(card: OgCardInput): string {
	return serializeNode(buildOgElement(card, getLogoDataUri()));
}
