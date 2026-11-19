import type { APIRoute } from "astro";
import { getAllOgEntries } from "../../lib/og/catalog";
import { renderOgPng } from "../../lib/og/render";
import type { OgCardInput } from "../../lib/og/types";

export async function getStaticPaths() {
	const entries = await getAllOgEntries();
	return entries.map(({ slug, card }) => ({
		params: { slug },
		props: { card },
	}));
}

export const GET: APIRoute = async ({ props }) => {
	const png = await renderOgPng(props.card as OgCardInput);
	return new Response(new Uint8Array(png), {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
};
