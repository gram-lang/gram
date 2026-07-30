import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Turns ```mermaid fences into a <pre class="mermaid-diagram"> placeholder
 * that MermaidLoader.astro hydrates client-side, mirroring what
 * vitepress-mermaid-viewer did on the old site — without needing MDX/islands
 * on every page that happens to contain a diagram.
 */
export function remarkMermaid() {
	return (tree: Root) => {
		visit(tree, "code", (node, index, parent) => {
			if (node.lang !== "mermaid" || !parent || index === undefined) return;

			const source = node.value
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");

			parent.children[index] = {
				type: "html",
				value: `<pre class="mermaid-diagram">${source}</pre>`,
			};
		});
	};
}
