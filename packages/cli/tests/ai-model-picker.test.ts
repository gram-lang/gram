import { describe, it, expect, beforeEach, mock } from "bun:test";

// The picker is the one piece of Chantier 1 that needs a terminal, so it gets
// tested against a stubbed @clack/prompts instead. What matters here is the
// list it builds and how it reports a cancel — the rendering itself is clack's
// business, and `gram init` has exercised these same two prompts for a while.

type Prompt = { message: string; options?: { value: string; label: string }[] };

const asked: Prompt[] = [];
let answers: unknown[] = [];

const CANCEL = Symbol.for("clack:cancel");

mock.module("@clack/prompts", () => ({
	select: (opts: Prompt) => {
		asked.push(opts);
		return Promise.resolve(answers.shift());
	},
	text: (opts: Prompt) => {
		asked.push(opts);
		return Promise.resolve(answers.shift());
	},
	isCancel: (v: unknown) => v === CANCEL,
	log: { step: () => {}, warn: () => {}, error: () => {} },
}));

const { pickAiModel } = await import("../src/ui/ai-model");

function labels(prompt: Prompt): string[] {
	return (prompt.options ?? []).map((o) => o.label);
}

describe("pickAiModel", () => {
	beforeEach(() => {
		asked.length = 0;
		answers = [];
	});

	it("offers every provider, then that provider's recommended models", async () => {
		answers = ["anthropic", "claude-haiku-4.5"];
		const picked = await pickAiModel();

		expect(picked).toEqual({
			provider: "anthropic",
			model: "claude-haiku-4.5",
		});
		expect(labels(asked[0])).toEqual([
			"Google (Gemini)",
			"OpenAI (ChatGPT)",
			"Anthropic (Claude)",
			"Ollama (Local)",
		]);
		expect(labels(asked[1])).toEqual([
			"claude-sonnet-4.6 (Recommended)",
			"claude-haiku-4.5",
			"claude-fable-5",
			"Other (Manual entry)",
		]);
	});

	it("keeps an off-list model in the running, without calling it recommended", async () => {
		answers = ["google", "gemini-2.0-legacy"];
		await pickAiModel({
			provider: "google",
			model: "gemini-2.0-legacy",
			providerSource: "config",
			modelSource: "config",
		});

		expect(labels(asked[1])).toEqual([
			"gemini-2.0-legacy (current)",
			"gemini-3.5-flash (Recommended)",
			"gemini-3.1-pro",
			"Other (Manual entry)",
		]);
	});

	it("does not list the current model twice when it is already recommended", async () => {
		answers = ["google", "gemini-3.1-pro"];
		await pickAiModel({
			provider: "google",
			model: "gemini-3.1-pro",
			providerSource: "config",
			modelSource: "config",
		});

		expect(labels(asked[1])).toEqual([
			"gemini-3.5-flash (Recommended)",
			"gemini-3.1-pro",
			"Other (Manual entry)",
		]);
	});

	it("asks for a name when the model is not on the list", async () => {
		answers = ["openai", "other", "gpt-6-preview"];
		const picked = await pickAiModel();

		expect(picked).toEqual({ provider: "openai", model: "gpt-6-preview" });
		expect(asked).toHaveLength(3);
	});

	it("returns null when the provider prompt is canceled", async () => {
		answers = [CANCEL];
		expect(await pickAiModel()).toBeNull();
	});

	it("returns null when the model prompt is canceled", async () => {
		answers = ["google", CANCEL];
		expect(await pickAiModel()).toBeNull();
	});

	it("returns null on an empty manual entry rather than an empty model name", async () => {
		answers = ["google", "other", ""];
		expect(await pickAiModel()).toBeNull();
	});
});
