import { describe, it, expect } from "bun:test";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModel } from "ai";
import { importVideoWithAI } from "../src/services/importer";
import type { YoutubeMetadata } from "../src/services/youtube";
import {
	VIDEO_IMPORT_PREAMBLE,
	VIDEO_IMPORT_REMINDER,
} from "../src/prompts/video-import";

const META: YoutubeMetadata = {
	videoId: "dQw4w9WgXcQ",
	canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	title: "Pain perdu en 3 minutes",
	author: "Chaîne Test",
	durationSeconds: 180,
};

const CLEAN = `---
title: 'Pain perdu'
---

## Tremper
Fouetter @oeuf{1} avec @lait{100ml}, puis tremper @brioche{2 tranches}.
`;

/**
 * Captures what was actually sent, so the prompt's shape can be asserted.
 *
 * `supportedUrls` matters: it is how a provider tells the SDK "pass this URL
 * through, don't fetch it". @ai-sdk/google declares exactly these two patterns.
 * A mock without them makes the SDK download the URL and inline the bytes —
 * which is precisely the failure mode the canonical-URL rule exists to avoid,
 * so the mock has to declare them to reproduce production behaviour.
 */
function recordingModel(reply: string) {
	const calls: { system?: string; body: unknown }[] = [];
	const model = new MockLanguageModelV3({
		supportedUrls: {
			"*": [
				/^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+(?:&[\w=&.-]*)?$/,
				/^https:\/\/youtu\.be\/[\w-]+(?:\?[\w=&.-]*)?$/,
			],
		},
		doGenerate: async (options) => {
			const sys = (options.prompt as { role: string; content: unknown }[]).find(
				(m) => m.role === "system",
			);
			calls.push({
				system: typeof sys?.content === "string" ? sys.content : undefined,
				body: options.prompt,
			});
			return {
				content: [{ type: "text" as const, text: reply }],
				finishReason: "stop" as const,
				usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
				warnings: [],
			};
		},
	}) as unknown as LanguageModel;
	return { model, calls };
}

describe("importVideoWithAI — prompt shape", () => {
	it("puts the video framing BEFORE the spec, and the reminder after", async () => {
		// Measured, not stylistic. The spike first appended ~120 words of
		// extraction rules *after* GRAM_SPEC_PROMPT; being the last thing read,
		// they crowded out six hundred lines of writing guidance and the output
		// started leaving intermediates dangling. Moving them in front, with a
		// short reminder covering both concerns, took that to zero.
		const { model, calls } = recordingModel(CLEAN);
		await importVideoWithAI(META, model);

		const system = calls[0]?.system as string;
		const preamble = system.indexOf(VIDEO_IMPORT_PREAMBLE.slice(0, 40));
		const spec = system.indexOf("SECTION 3 — INGREDIENTS");
		const reminder = system.indexOf(VIDEO_IMPORT_REMINDER.slice(0, 40));

		expect(preamble).toBeGreaterThan(-1);
		expect(preamble).toBeLessThan(spec);
		expect(reminder).toBeGreaterThan(spec);
	});

	it("passes the canonical URL through untouched instead of downloading it", async () => {
		// If this ever comes back as bytes rather than the URL, the SDK fetched
		// the YouTube watch page and is about to send HTML labelled video/mp4.
		const { model, calls } = recordingModel(CLEAN);
		await importVideoWithAI(META, model);

		const messages = calls[0]?.body as {
			role: string;
			content: {
				type: string;
				data?: { type: string; url?: URL };
				mediaType?: string;
			}[];
		}[];
		const user = messages.find((m) => m.role === "user");
		const file = user?.content.find((p) => p.type === "file");

		// `type: "url"` is the pass-through. `type: "data"` would mean the SDK
		// fetched it and is sending bytes.
		expect(file?.data?.type).toBe("url");
		expect(String(file?.data?.url)).toBe(META.canonicalUrl);
		expect(file?.mediaType).toBe("video/mp4");
	});

	it("fences the title and channel as data", async () => {
		const { model, calls } = recordingModel(CLEAN);
		await importVideoWithAI(META, model);

		const messages = calls[0]?.body as {
			role: string;
			content: { type: string; text?: string }[];
		}[];
		const text = messages
			.find((m) => m.role === "user")
			?.content.find((p) => p.type === "text")?.text as string;
		expect(text).toContain("<<<METADATA");
		expect(text).toContain("Pain perdu en 3 minutes");
	});
});

describe("importVideoWithAI — reuses the import guardrails", () => {
	it("takes source and author from YouTube, not from the model", async () => {
		const invented = `---
title: 'Pain perdu'
author: 'Chef Inconnu'
source: ['https://example.com/invented']
---

## Tremper
Fouetter @oeuf{1} avec @lait{100ml}.
`;
		const { model } = recordingModel(invented);
		const result = await importVideoWithAI(META, model);

		expect(result.gramContent).toContain(
			"source: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ']",
		);
		expect(result.gramContent).toContain("author: 'Chaîne Test'");
		expect(result.gramContent).not.toContain("example.com");
	});

	it("catches lost content, exactly as the JSON-LD path does", async () => {
		const lossy = `---
title: 'Pain perdu'
---

## Tremper
Fouetter @oeuf{1} // TODO: pas indiqué, @lait{} et @sucre{}.
`;
		const { model } = recordingModel(lossy);
		const result = await importVideoWithAI(META, model);

		expect(result.lostIngredients).toHaveLength(2);
	});

	it("counts what the model wrote, since a video declares no ingredient list", async () => {
		const { model } = recordingModel(CLEAN);
		const result = await importVideoWithAI(META, model);

		expect(result.ingredientCount).toBe(3);
		expect(result.stepCount).toBe(0); // no [Action] prefixes in this fixture
		expect(result.title).toBe("Pain perdu en 3 minutes");
	});
});
