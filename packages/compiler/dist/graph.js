"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCycles = detectCycles;
/**
 * Runs a Cycle Detection algorithm on the recipe graph using DFS.
 *
 * Tracks dependencies between ingredients (especially for relative quantities)
 * and returns a set of ingredient IDs involved in circular references.
 */
function detectCycles(sections) {
    const graph = new Map(); // id -> [dependencies]
    // 1. Build the adjacency list of ingredient dependencies
    sections.forEach(sec => {
        sec.ingredients.forEach(ing => {
            if (ing.dependencies) {
                if (!graph.has(ing.id))
                    graph.set(ing.id, new Set());
                ing.dependencies.forEach(d => graph.get(ing.id)?.add(d));
            }
        });
    });
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = new Set();
    // 2. DFS traversal to find back-edges (cycles)
    function dfs(nodeId) {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        const deps = graph.get(nodeId);
        if (deps) {
            for (const dep of deps) {
                if (!visited.has(dep)) {
                    dfs(dep);
                }
                else if (recursionStack.has(dep)) {
                    cycles.add(nodeId);
                    cycles.add(dep);
                }
            }
        }
        recursionStack.delete(nodeId);
    }
    // 3. Trigger DFS for all unvisited nodes in the graph
    for (const [node] of graph) {
        if (!visited.has(node))
            dfs(node);
    }
    return cycles;
}
