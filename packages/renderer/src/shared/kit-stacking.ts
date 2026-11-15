/**
 * Keeps each list of a recipe view (a shopping list, a section's ingredients)
 * to one layout: when one of its lines no longer fits on a line, with its
 * amount pushed down under the name, every line of that list puts its amount
 * under its name (`kit-list-stacked`), so a reader never wonders which amount
 * goes with which name. Each list decides for itself; another list of the
 * page keeps its compact lines.
 *
 * Measured on what is shown (font included), again when a list changes width
 * or the view is redrawn. Without a script, each line decides for itself
 * (`screen.css`), and print is untouched.
 *
 * Self-contained (no import, no outer variable): `TOOLTIP_SCRIPT` inlines its
 * source for a standalone page.
 */
export function watchListStacking(root: HTMLElement | Document): () => void {
	if (typeof ResizeObserver === "undefined") return () => {};
	const STACKED = "kit-list-stacked";
	const LISTS = ".kit-list:not(.sub-kit-list)";
	const widths = new WeakMap<Element, number>();

	/** True when a line's amount sits below its name: it did not fit. */
	function wraps(line: Element): boolean {
		const name = line.querySelector(".kit-name, .alt-group");
		const qty = line.querySelector(":scope > .kit-qty");
		if (!name || !qty) return false;
		const n = name.getBoundingClientRect();
		const q = qty.getBoundingClientRect();
		return q.top >= n.top + n.height / 2;
	}

	function update(list: Element): void {
		list.classList.remove(STACKED);
		const lines = list.querySelectorAll("li > label > span");
		for (let i = 0; i < lines.length; i++) {
			if (wraps(lines[i] as Element)) {
				list.classList.add(STACKED);
				return;
			}
		}
	}

	const resizes = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const width = Math.round(entry.contentRect.width);
			// Stacking changes a list's height only: never measure it again for that.
			if (widths.get(entry.target) === width) continue;
			widths.set(entry.target, width);
			update(entry.target);
		}
	});

	function scan(): void {
		resizes.disconnect();
		const lists = root.querySelectorAll(LISTS);
		for (let i = 0; i < lists.length; i++) {
			const list = lists[i] as Element;
			widths.delete(list);
			resizes.observe(list);
		}
	}

	let frame = 0;
	function rescan(): void {
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			scan();
		});
	}

	/** True when a node is, or holds, a list (not a tooltip being filled). */
	function bringsLists(nodes: NodeList): boolean {
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i] as Element;
			if (node.nodeType !== 1) continue;
			if (node.matches(LISTS) || node.querySelector(LISTS)) return true;
		}
		return false;
	}

	// A view redrawn in place (the preview, the playground) brings new lists.
	const mutations =
		typeof MutationObserver === "undefined"
			? null
			: new MutationObserver((records) => {
					for (const record of records) {
						if (
							bringsLists(record.addedNodes) ||
							bringsLists(record.removedNodes)
						) {
							rescan();
							return;
						}
					}
				});
	mutations?.observe(root, { childList: true, subtree: true });
	// A web font that arrives late changes every width.
	if (typeof document !== "undefined" && document.fonts) {
		document.fonts.ready.then(rescan, () => {});
	}
	scan();

	return () => {
		if (frame) cancelAnimationFrame(frame);
		mutations?.disconnect();
		resizes.disconnect();
	};
}
