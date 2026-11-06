import { describe, expect, it } from "bun:test";
import { analyze } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { getDictionary } from "@gram-lang/i18n";
import { getAST } from "@gram-lang/parser";
import {
	JSON_TREE_CSS,
	astInspector,
	getInspector,
	inspectors,
	jsonInspector,
	jsonTreeInspector,
	outputs,
	renderJsonTree,
	renderSExpr,
	views,
} from "../src/index";

const SOURCE = `---
title: Pancakes
---

## Batter

[Mix] Whisk @flour{250g} with @milk{500ml} and rest ~_{1-2h}.
`;

const ast = getAST(SOURCE);
const analyzed = analyze(compile(ast), {}).result;

describe("the inspectors", () => {
	it("read a stage of the pipeline, for a code pane or a tree", () => {
		expect(inspectors.map((i) => [i.id, i.stage, i.presentation])).toEqual([
			["ast", "composedAst", "code"],
			["json", "analyzed", "code"],
			["json-tree", "analyzed", "tree"],
		]);
		expect(astInspector.language).toBe("scheme");
		expect(jsonInspector.language).toBe("json");
		expect(getInspector("json-tree")).toBe(jsonTreeInspector);
		expect(getInspector("recipe")).toBeUndefined();
	});

	it("write the AST as an S-expression, without type and loc", () => {
		const text = astInspector.serialize(ast);
		expect(text).toBe(renderSExpr(ast));
		expect(text.startsWith("(Recipe")).toBe(true);
		expect(text).not.toContain(":loc");
		expect(text).toMatch(/\n {2,}\(/); // the children are indented
	});

	it("write a range as min-max, and nothing as nil", () => {
		expect(renderSExpr({ type: "Timer", value: { min: 1, max: 2 } })).toBe(
			"(Timer :value 1-2)",
		);
		expect(renderSExpr(null)).toBe("nil");
	});

	it("write the analyzed recipe as JSON, or as a tree", () => {
		expect(jsonInspector.serialize(analyzed)).toBe(
			JSON.stringify(analyzed, null, 2),
		);
		expect(jsonTreeInspector.serialize(analyzed)).toBe(
			renderJsonTree(analyzed),
		);
	});
});

describe("each inspector, on a fixture", () => {
	const artifacts = {
		composedAst: ast,
		compiled: compile(ast),
		analyzed,
	};

	for (const inspector of inspectors) {
		it(`${inspector.id} serializes it the same way every time`, () => {
			const serialize = inspector.serialize as (artifact: unknown) => string;
			const text = serialize(artifacts[inspector.stage]);
			expect(text.length).toBeGreaterThan(0);
			expect(serialize(artifacts[inspector.stage])).toBe(text);
		});
	}

	// The JSON itself is pinned by the conformance corpus; what is pinned here
	// is how the inspectors write it.
	it("writes the AST as it always has", () => {
		expect(astInspector.serialize(ast)).toMatchSnapshot();
	});

	it("writes the tree as it always has", () => {
		expect(
			renderJsonTree(
				{
					title: "Pancakes",
					tags: ["sweet"],
					meta: { portions: 4, vegan: false },
					empty: {},
				},
				{ expandDepth: 1 },
			),
		).toMatchSnapshot();
	});
});

describe("renderJsonTree", () => {
	it("folds each object and array in a native details, open by default", () => {
		const html = renderJsonTree({ a: [1, 2], b: { c: true } });
		expect(html.match(/<details class="jt-node" open>/g)).toHaveLength(3);
		expect(html).toContain('<span class="jt-count">2 items</span>');
		expect(html).toContain('<span class="jt-count">1 item</span>');
		expect(html).toContain('<span class="jt-boolean">true</span>');
	});

	it("starts folded below the depth asked for", () => {
		const html = renderJsonTree({ a: { b: { c: 1 } } }, { expandDepth: 1 });
		expect(html.match(/ open>/g)).toHaveLength(1);
		expect(html.match(/<details/g)).toHaveLength(3);
	});

	it("writes empty containers and primitives on one line, with commas between", () => {
		const html = renderJsonTree({ e: {}, f: [], n: null, s: "x" });
		expect(html).toContain('<span class="jt-punct">{}</span>');
		expect(html).toContain('<span class="jt-punct">[]</span>');
		expect(html).toContain('<span class="jt-null">null</span>');
		// The last entry has no comma.
		expect(html).toContain(
			'<span class="jt-string">&quot;x&quot;</span></div></div>',
		);
	});

	it("escapes keys and strings", () => {
		const html = renderJsonTree({ "<img src=x>": "</div><script>" });
		expect(html).not.toContain("<img");
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});

	it("leaves out what JSON leaves out, and never loops", () => {
		const loop: Record<string, unknown> = { a: undefined };
		loop.self = loop;
		const html = renderJsonTree(loop);
		expect(html).not.toContain("&quot;a&quot;");
		expect(html).toContain("[Circular]");
	});

	it("ships a stylesheet whose colors are variables", () => {
		expect(JSON_TREE_CSS).toContain(".gram-json-tree");
		expect(JSON_TREE_CSS).toContain("var(--gram-json-key");
	});
});

describe("outputs", () => {
	it("lists the views, then the inspectors, each id once", () => {
		expect(outputs).toEqual([...views, ...inspectors]);
		expect(outputs.map((o) => o.kind)).toEqual([
			...views.map(() => "renderer"),
			...inspectors.map(() => "inspector"),
		]);
		const ids = outputs.map((o) => o.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("has a name in every language, for the surfaces that list them", () => {
		for (const lang of ["en", "fr"]) {
			const names = getDictionary(lang).renderer.outputs;
			for (const output of outputs) {
				expect(names[output.id], `${output.id} in ${lang}`).toBeString();
			}
		}
	});
});
