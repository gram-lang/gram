import { defineCollection, z } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { glob } from "astro/loaders";

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema(),
	}),
	blog: defineCollection({
		loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
		schema: z.object({
			title: z.string(),
			date: z.date(),
			locale: z.enum(["en", "fr"]).default("en"),
			tags: z.array(z.string()).default([]),
			description: z.string().optional(),
		}),
	}),
};
