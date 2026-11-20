import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori, { type Font } from "satori";
import sharp from "sharp";
import logoSvg from "../../../public/logo.svg?raw";
import { buildOgElement } from "./templates";
import type { OgCardInput } from "./types";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

let cachedFonts: Font[] | null = null;
let cachedLogoDataUri: string | null = null;

function loadFont(specifier: string): Buffer {
	const require = createRequire(import.meta.url);
	return readFileSync(require.resolve(specifier));
}

function getFonts(): Font[] {
	if (cachedFonts) return cachedFonts;

	cachedFonts = [
		{
			name: "Inter",
			data: loadFont("@fontsource/inter/files/inter-latin-400-normal.woff"),
			weight: 400,
			style: "normal",
		},
		{
			name: "Inter",
			data: loadFont("@fontsource/inter/files/inter-latin-ext-400-normal.woff"),
			weight: 400,
			style: "normal",
		},
		{
			name: "Inter",
			data: loadFont("@fontsource/inter/files/inter-latin-600-normal.woff"),
			weight: 600,
			style: "normal",
		},
		{
			name: "Inter",
			data: loadFont("@fontsource/inter/files/inter-latin-ext-600-normal.woff"),
			weight: 600,
			style: "normal",
		},
		{
			name: "Inter",
			data: loadFont("@fontsource/inter/files/inter-latin-700-normal.woff"),
			weight: 700,
			style: "normal",
		},
		{
			name: "Inter",
			data: loadFont("@fontsource/inter/files/inter-latin-ext-700-normal.woff"),
			weight: 700,
			style: "normal",
		},
		{
			name: "JetBrains Mono",
			data: loadFont(
				"@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
			),
			weight: 400,
			style: "normal",
		},
		{
			name: "JetBrains Mono",
			data: loadFont(
				"@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-normal.woff",
			),
			weight: 400,
			style: "normal",
		},
		{
			name: "JetBrains Mono",
			data: loadFont(
				"@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff",
			),
			weight: 600,
			style: "normal",
		},
		{
			name: "JetBrains Mono",
			data: loadFont(
				"@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-600-normal.woff",
			),
			weight: 600,
			style: "normal",
		},
	];
	return cachedFonts;
}

export function getLogoDataUri(): string {
	if (cachedLogoDataUri) return cachedLogoDataUri;
	// Ensure explicit viewBox so Satori/sharp scales the 127x125 icon cleanly.
	const normalizedSvg = logoSvg.includes("viewBox=")
		? logoSvg
		: logoSvg.replace("<svg ", '<svg viewBox="0 0 127 125" ');
	cachedLogoDataUri = `data:image/svg+xml;base64,${Buffer.from(normalizedSvg).toString("base64")}`;
	return cachedLogoDataUri;
}

export async function renderOgPng(card: OgCardInput): Promise<Buffer> {
	const element = buildOgElement(card, getLogoDataUri());
	const svg = await satori(element as Parameters<typeof satori>[0], {
		width: OG_WIDTH,
		height: OG_HEIGHT,
		fonts: getFonts(),
	});

	return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
