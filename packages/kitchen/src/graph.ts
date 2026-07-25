import type { ProcessedSection } from "./types";

/**
 * DFS cycle detection over an arbitrary "depends on" graph (node -> its
 * dependencies). Returns every node that is part of at least one cycle,
 * direct (a -> a) or indirect (a -> b -> a). Shared by `detectCycles`
 * (ingredient formula dependencies) and `detectIntermediateCycles`
 * (section-level `->&name` / `&name` dependencies) — audit 2026-07-22,
 * kitchen finding F-012: the algorithm was already correct, only ever wired
 * to one of the two dependency domains the language actually has.
 */
function findCycles(graph: Map<string, Set<string>>): Set<string> {
	const visited = new Set<string>();
	const recursionStack = new Set<string>();
	const cycles = new Set<string>();

	function dfs(nodeId: string) {
		visited.add(nodeId);
		recursionStack.add(nodeId);

		const deps = graph.get(nodeId);
		if (deps) {
			for (const dep of deps) {
				if (!visited.has(dep)) {
					dfs(dep);
				} else if (recursionStack.has(dep)) {
					cycles.add(nodeId);
					cycles.add(dep);
				}
			}
		}
		recursionStack.delete(nodeId);
	}

	for (const [node] of graph) {
		if (!visited.has(node)) dfs(node);
	}

	return cycles;
}

/**
 * Tracks dependencies between ingredients (especially for relative quantities)
 * and returns a set of ingredient IDs involved in circular references.
 */
export function detectCycles(sections: ProcessedSection[]): Set<string> {
	const graph = new Map<string, Set<string>>();

	sections.forEach((sec) => {
		sec.ingredients.forEach((ing) => {
			if (ing.dependencies) {
				if (!graph.has(ing.id)) graph.set(ing.id, new Set());
				ing.dependencies.forEach((d) => {
					graph.get(ing.id)?.add(d);
				});
			}
		});
	});

	return findCycles(graph);
}

/**
 * Tracks dependencies between section-level intermediates: a section that
 * declares `->&produced` and references `&consumed` somewhere in its steps
 * depends on `consumed` being ready first. Returns every intermediate name
 * involved in a cycle (direct or indirect, e.g. `&a -> &b -> &a`) — this
 * dependency domain was previously invisible to `detectCycles` entirely, so
 * an indirect intermediate cycle went undetected (audit finding F-012).
 */
export function detectIntermediateCycles(
	sections: ProcessedSection[],
): Set<string> {
	const graph = new Map<string, Set<string>>();

	sections.forEach((sec) => {
		const produced = sec.intermediate_preparation;
		if (!produced) return;

		if (!graph.has(produced)) graph.set(produced, new Set());
		sec.ingredients.forEach((ing) => {
			if (ing.type === "reference" && ing.name && ing.name !== produced) {
				graph.get(produced)?.add(ing.name);
			}
		});
	});

	return findCycles(graph);
}
