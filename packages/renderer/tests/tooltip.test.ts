import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { attachTooltips, TOOLTIP_SCRIPT } from "../src/index";

describe("Universal Tooltip Engine", () => {
	it("exports a non-empty standalone TOOLTIP_SCRIPT", () => {
		expect(typeof TOOLTIP_SCRIPT).toBe("string");
		expect(TOOLTIP_SCRIPT.length).toBeGreaterThan(50);
		expect(TOOLTIP_SCRIPT).toContain("gram-global-tooltip");
		expect(TOOLTIP_SCRIPT).toContain("gram-has-js-tooltips");
	});

	it("returns a no-op cleanup function safely in non-DOM environments", () => {
		const cleanup = attachTooltips();
		expect(typeof cleanup).toBe("function");
		cleanup();
	});

	describe("with DOM environment", () => {
		let originalDocument: any;
		let originalWindow: any;

		beforeEach(() => {
			originalDocument = (globalThis as any).document;
			originalWindow = (globalThis as any).window;

			class MockClassList {
				private classes = new Set<string>();
				add(c: string) {
					this.classes.add(c);
				}
				remove(c: string) {
					this.classes.delete(c);
				}
				contains(c: string) {
					return this.classes.has(c);
				}
				toggle(c: string): boolean {
					if (this.contains(c)) {
						this.remove(c);
						return false;
					} else {
						this.add(c);
						return true;
					}
				}
			}

			class MockElement {
				tagName: string;
				id = "";
				className = "";
				classList = new MockClassList();
				attributes = new Map<string, string>();
				children: MockElement[] = [];
				parentNode: MockElement | null = null;
				textContent = "";
				innerHTML = "";
				style: Record<string, string> = {};
				private listeners = new Map<string, Function[]>();

				constructor(tag: string) {
					this.tagName = tag.toUpperCase();
				}

				setAttribute(name: string, value: string) {
					this.attributes.set(name, value);
				}
				getAttribute(name: string) {
					return this.attributes.get(name) ?? null;
				}
				hasAttribute(name: string) {
					return this.attributes.has(name);
				}

				appendChild(child: MockElement) {
					child.parentNode = this;
					this.children.push(child);
					return child;
				}

				removeChild(child: MockElement) {
					const idx = this.children.indexOf(child);
					if (idx !== -1) {
						this.children.splice(idx, 1);
						child.parentNode = null;
					}
					return child;
				}

				remove() {
					this.parentNode?.removeChild(this);
				}

				scrollIntoView(options?: any) {
					(this as any)._scrolled = options;
				}

				closest(selector: string): MockElement | null {
					let curr: MockElement | null = this;
					while (curr) {
						if (
							selector.includes("[data-tooltip]") &&
							curr.hasAttribute("data-tooltip")
						) {
							return curr;
						}
						if (
							selector.includes("[data-ref-id]") &&
							curr.hasAttribute("data-ref-id")
						) {
							return curr;
						}
						// The trigger of an intermediate's link: only the step's
						// result line and the section badge, not the step itself.
						if (
							selector.includes(".step-result-item[data-declares]")
								? curr.hasAttribute("data-declares") &&
									(curr.className.includes("step-result-item") ||
										curr.className.includes("section-declaration-badge"))
								: selector.includes("[data-declares]") &&
									curr.hasAttribute("data-declares")
						) {
							return curr;
						}
						if (
							selector.includes(".kit-list") &&
							curr.className.includes("kit-list")
						) {
							return curr;
						}
						if (
							selector.includes(".has-rich-tooltip") &&
							curr.className.includes("has-rich-tooltip")
						) {
							return curr;
						}
						if (
							selector.includes(".timing-pill") &&
							curr.className.includes("timing-pill")
						) {
							return curr;
						}
						if (
							selector.includes(".timing-card") &&
							curr.className.includes("timing-card")
						) {
							return curr;
						}
						if (
							selector.includes(".steps li") &&
							curr.tagName === "LI" &&
							!curr.className.includes("step-comment")
						) {
							return curr;
						}
						if (
							selector.includes(".copy-shopping-btn") &&
							curr.className.includes("copy-shopping-btn")
						) {
							return curr;
						}
						if (
							selector.includes(".prep-accordion") &&
							curr.className.includes("prep-accordion")
						) {
							return curr;
						}
						if (
							selector.includes(".ingredient") &&
							curr.className.includes("ingredient")
						) {
							return curr;
						}
						if (selector.includes("section") && curr.tagName === "SECTION") {
							return curr;
						}
						if (
							selector.includes("li.kit-ingredient") &&
							curr.className.includes("kit-ingredient")
						) {
							return curr;
						}
						curr = curr.parentNode;
					}
					return null;
				}

				querySelectorAll(selector: string): MockElement[] {
					const results: MockElement[] = [];
					const check = (el: MockElement) => {
						if (selector.includes("[data-declares~=")) {
							const m = selector.match(/~="([^"]+)"/);
							if (
								m &&
								(el.getAttribute("data-declares") || "")
									.split(/\s+/)
									.includes(m[1])
							) {
								results.push(el);
							}
						}
						if (selector.includes("[data-ref-id=")) {
							const m = selector.match(/="([^"]+)"/);
							if (m && el.getAttribute("data-ref-id") === m[1]) {
								results.push(el);
							}
						}
						if (selector.includes('.ingredient[data-name="')) {
							const m = selector.match(/data-name="([^"]+)"/);
							if (
								m &&
								el.className.includes("ingredient") &&
								el.getAttribute("data-name") === m[1]
							) {
								results.push(el);
							}
						}
						if (selector.includes("li.kit-ingredient")) {
							if (el.className.includes("kit-ingredient")) {
								results.push(el);
							}
						}
						if (selector.includes(".mep-group")) {
							if (el.className.includes("mep-group")) {
								results.push(el);
							}
						}
						for (const c of el.children) check(c);
					};
					check(this);
					return results;
				}

				querySelector(selector: string): MockElement | null {
					const all = this.querySelectorAll(selector);
					if (all.length > 0) return all[0];
					for (const child of this.children) {
						if (
							selector.includes(".timing-tooltip") &&
							child.className.includes("timing-tooltip")
						) {
							return child;
						}
						if (
							selector.includes(".kit-name") &&
							child.className.includes("kit-name")
						)
							return child;
						if (
							selector.includes(".kit-qty") &&
							child.className.includes("kit-qty")
						)
							return child;
						if (
							selector.includes(".copy-label") &&
							child.className.includes("copy-label")
						)
							return child;
						if (
							selector.includes(".copy-icon") &&
							child.className.includes("copy-icon")
						)
							return child;
						if (
							selector.includes(".check-icon") &&
							child.className.includes("check-icon")
						)
							return child;
						if (
							selector.includes("[data-name]") &&
							child.hasAttribute("data-name")
						)
							return child;
						const deeper = child.querySelector(selector);
						if (deeper) return deeper;
					}
					return null;
				}

				contains(other: MockElement): boolean {
					if (other === this) return true;
					return this.children.some((c) => c.contains(other));
				}

				getBoundingClientRect() {
					return {
						left: 50,
						top: 100,
						width: 80,
						height: 20,
						right: 130,
						bottom: 120,
					};
				}

				addEventListener(type: string, fn: Function) {
					const list = this.listeners.get(type) ?? [];
					list.push(fn);
					this.listeners.set(type, list);
				}

				removeEventListener(type: string, fn: Function) {
					const list = this.listeners.get(type) ?? [];
					const idx = list.indexOf(fn);
					if (idx !== -1) list.splice(idx, 1);
				}

				dispatchEvent(event: {
					type: string;
					target?: any;
					bubbles?: boolean;
				}) {
					event.target = this;
					let curr: MockElement | null = this;
					while (curr) {
						const list = curr.listeners.get(event.type);
						if (list) {
							for (const fn of list) fn(event);
						}
						curr = event.bubbles ? curr.parentNode : null;
					}
				}
			}

			const body = new MockElement("body");
			const doc = {
				body,
				createElement: (tag: string) => new MockElement(tag),
				getElementById: (id: string): MockElement | null => {
					function find(el: MockElement): MockElement | null {
						if (el.id === id) return el;
						for (const c of el.children) {
							const res = find(c);
							if (res) return res;
						}
						return null;
					}
					return find(body);
				},
				addEventListener: body.addEventListener.bind(body),
				removeEventListener: body.removeEventListener.bind(body),
			};

			const win = {
				innerWidth: 1024,
				innerHeight: 768,
				addEventListener: () => {},
				removeEventListener: () => {},
			};

			(globalThis as any).document = doc;
			(globalThis as any).window = win;
		});

		afterEach(() => {
			(globalThis as any).document = originalDocument;
			(globalThis as any).window = originalWindow;
		});

		it("attaches to DOM elements and handles tooltip lifecycle", () => {
			const container = (document as any).createElement("div");
			const target = (document as any).createElement("span");
			target.setAttribute("data-tooltip", "200 g\n— finely sliced");
			target.textContent = "onions";
			container.appendChild(target);
			document.body.appendChild(container);

			const cleanup = attachTooltips(container as any);

			expect(document.body.classList.contains("gram-has-js-tooltips")).toBe(
				true,
			);
			const tooltipEl = document.getElementById("gram-global-tooltip");
			expect(tooltipEl).not.toBeNull();
			expect((tooltipEl as any).className).toContain("gram-tooltip-fixed");

			// Trigger pointerover
			target.dispatchEvent({ type: "pointerover", bubbles: true });
			expect((tooltipEl as any).classList.contains("visible")).toBe(true);
			expect((tooltipEl as any).textContent).toBe("200 g\n— finely sliced");

			// Trigger pointerout
			target.dispatchEvent({ type: "pointerout", bubbles: true });
			expect((tooltipEl as any).classList.contains("visible")).toBe(false);

			// Clean up
			cleanup();
			expect(document.body.classList.contains("gram-has-js-tooltips")).toBe(
				false,
			);
			expect(document.getElementById("gram-global-tooltip")).toBeNull();
			container.remove();
		});

		it("shows the rich tooltip of a mass, which has no data-tooltip of its own", () => {
			const mass = (document as any).createElement("div");
			mass.className = "hero-item hero-mass has-rich-tooltip";
			const value = (document as any).createElement("span");
			value.className = "mass-value";
			mass.appendChild(value);
			const richTip = (document as any).createElement("div");
			richTip.className = "timing-tooltip";
			richTip.innerHTML =
				'<div class="timing-tooltip-title">Ingredient mass</div><div class="timing-row">pepper</div>';
			mass.appendChild(richTip);
			document.body.appendChild(mass);

			const cleanup = attachTooltips(mass as any);
			const tooltipEl = document.getElementById("gram-global-tooltip")!;

			value.dispatchEvent({ type: "pointerover", bubbles: true });
			expect((tooltipEl as any).classList.contains("visible")).toBe(true);
			expect((tooltipEl as any).innerHTML).toContain("Ingredient mass");
			expect((tooltipEl as any).innerHTML).toContain("pepper");

			cleanup();
			mass.remove();
		});

		it("shows the card of an element of a step, not its plain-text fallback", () => {
			const target = (document as any).createElement("span");
			target.setAttribute("data-tooltip", "Quantity: 200 g");
			target.setAttribute(
				"data-tooltip-html",
				'<div class="gram-tip"><span class="gram-tip-title">flour</span></div>',
			);
			document.body.appendChild(target);

			const cleanup = attachTooltips(target as any);
			const tooltipEl = document.getElementById("gram-global-tooltip")!;

			target.dispatchEvent({ type: "pointerover", bubbles: true });
			expect((tooltipEl as any).classList.contains("visible")).toBe(true);
			expect((tooltipEl as any).innerHTML).toContain("gram-tip-title");

			cleanup();
			target.remove();
		});

		it("handles rich timing tooltips from .timing-pill", () => {
			const pill = (document as any).createElement("span");
			pill.className = "timing-pill total";
			pill.setAttribute("data-tooltip", "Total: 45m");

			const richTip = (document as any).createElement("div");
			richTip.className = "timing-tooltip";
			richTip.innerHTML =
				'<div class="timing-tooltip-title">Total</div><div class="timing-row">Row 1</div>';
			pill.appendChild(richTip);
			document.body.appendChild(pill);

			const cleanup = attachTooltips(pill as any);
			const tooltipEl = document.getElementById("gram-global-tooltip")!;

			pill.dispatchEvent({ type: "pointerover", bubbles: true });
			expect((tooltipEl as any).classList.contains("visible")).toBe(true);
			expect((tooltipEl as any).innerHTML).toContain("timing-tooltip-title");
			expect((tooltipEl as any).innerHTML).toContain("Row 1");

			pill.dispatchEvent({ type: "pointerout", bubbles: true });
			expect((tooltipEl as any).classList.contains("visible")).toBe(false);

			cleanup();
			pill.remove();
		});

		it("highlights and scrolls to intermediate producers on reference hover and click", () => {
			const container = (document as any).createElement("div");

			// Step 1: declares "dough"
			const step1 = (document as any).createElement("li");
			step1.setAttribute("data-declares", "dough");
			const declBadge = (document as any).createElement("span");
			declBadge.className = "declaration-badge";
			declBadge.setAttribute("data-declares", "dough");
			step1.appendChild(declBadge);
			container.appendChild(step1);

			// Step 2: references "dough"
			const step2 = (document as any).createElement("li");
			const refSpan = (document as any).createElement("span");
			refSpan.className = "reference";
			refSpan.setAttribute("data-ref-id", "dough");
			step2.appendChild(refSpan);
			container.appendChild(step2);

			document.body.appendChild(container);

			const cleanup = attachTooltips(container as any);

			// Hover over reference: producer step gets highlighted
			refSpan.dispatchEvent({ type: "pointerover", bubbles: true });
			expect(step1.classList.contains("gram-highlight-producer")).toBe(true);
			expect(refSpan.classList.contains("gram-highlight-active")).toBe(true);

			// Pointer out: highlight cleared
			refSpan.dispatchEvent({ type: "pointerout", bubbles: true });
			expect(step1.classList.contains("gram-highlight-producer")).toBe(false);

			// Click on reference: triggers scrollIntoView on producer and pulse
			refSpan.dispatchEvent({ type: "click", bubbles: true });
			expect((step1 as any)._scrolled).toEqual({
				behavior: "smooth",
				block: "center",
			});
			expect(step1.classList.contains("gram-pulse-producer")).toBe(true);

			cleanup();
			container.remove();
		});

		it("highlights the whole section that makes an intermediate, not only its title", () => {
			const container = (document as any).createElement("div");

			// `## Dough ->&dough`: the title and its badge declare it
			const section = (document as any).createElement("section");
			const header = (document as any).createElement("h3");
			// The mock keeps `className` and `classList` apart: set both.
			header.className = "section-header";
			header.classList.add("section-header");
			header.setAttribute("data-declares", "dough");
			const badge = (document as any).createElement("span");
			badge.className = "section-declaration-badge";
			badge.classList.add("section-declaration-badge");
			badge.setAttribute("data-declares", "dough");
			header.appendChild(badge);
			section.appendChild(header);
			container.appendChild(section);

			// A later section uses it in its list of ingredients
			const kitList = (document as any).createElement("ul");
			kitList.className = "kit-list";
			const kitName = (document as any).createElement("span");
			kitName.className = "kit-name reference";
			kitName.setAttribute("data-ref-id", "dough");
			kitList.appendChild(kitName);
			container.appendChild(kitList);

			document.body.appendChild(container);
			const cleanup = attachTooltips(container as any);

			kitName.dispatchEvent({ type: "pointerover", bubbles: true });
			expect(section.classList.contains("gram-highlight-producer")).toBe(true);
			expect(header.classList.contains("gram-highlight-producer")).toBe(false);
			expect(badge.classList.contains("gram-highlight-producer")).toBe(false);

			kitName.dispatchEvent({ type: "pointerout", bubbles: true });
			expect(section.classList.contains("gram-highlight-producer")).toBe(false);

			cleanup();
			container.remove();
		});

		it("links an intermediate from its result line only, not from anywhere in the step", () => {
			const container = (document as any).createElement("div");

			// Step 1 makes "dough": the step and its "↳ dough" line declare it
			const step1 = (document as any).createElement("li");
			step1.setAttribute("data-declares", "dough");
			const stepText = (document as any).createElement("span");
			step1.appendChild(stepText);
			const result = (document as any).createElement("span");
			result.className = "declaration step-result-item";
			result.setAttribute("data-declares", "dough");
			step1.appendChild(result);
			container.appendChild(step1);

			// Step 2 uses it
			const step2 = (document as any).createElement("li");
			const refSpan = (document as any).createElement("span");
			refSpan.className = "reference";
			refSpan.setAttribute("data-ref-id", "dough");
			step2.appendChild(refSpan);
			container.appendChild(step2);

			document.body.appendChild(container);
			const cleanup = attachTooltips(container as any);

			// Anywhere else in the step: nothing
			stepText.dispatchEvent({ type: "pointerover", bubbles: true });
			expect(refSpan.classList.contains("gram-highlight-consumer")).toBe(false);
			stepText.dispatchEvent({ type: "pointerout", bubbles: true });
			stepText.dispatchEvent({ type: "click", bubbles: true });
			expect((refSpan as any)._scrolled).toBeUndefined();

			// The result line: highlights and leads to where it is used
			result.dispatchEvent({ type: "pointerover", bubbles: true });
			expect(refSpan.classList.contains("gram-highlight-consumer")).toBe(true);
			result.dispatchEvent({ type: "pointerout", bubbles: true });
			result.dispatchEvent({ type: "click", bubbles: true });
			expect((refSpan as any)._scrolled).toEqual({
				behavior: "smooth",
				block: "center",
			});

			cleanup();
			container.remove();
		});

		it("shows where a reference of a list comes from on hover, but leaves the click to its checkbox", () => {
			const container = (document as any).createElement("div");

			const step1 = (document as any).createElement("li");
			step1.setAttribute("data-declares", "dough");
			container.appendChild(step1);

			const kitList = (document as any).createElement("ul");
			kitList.className = "kit-list";
			const kitLi = (document as any).createElement("li");
			kitLi.className = "kit-reference";
			const kitName = (document as any).createElement("span");
			kitName.className = "kit-name reference";
			kitName.setAttribute("data-ref-id", "dough");
			kitLi.appendChild(kitName);
			kitList.appendChild(kitLi);
			container.appendChild(kitList);

			document.body.appendChild(container);
			const cleanup = attachTooltips(container as any);

			kitName.dispatchEvent({ type: "pointerover", bubbles: true });
			expect(step1.classList.contains("gram-highlight-producer")).toBe(true);
			kitName.dispatchEvent({ type: "pointerout", bubbles: true });

			kitName.dispatchEvent({ type: "click", bubbles: true });
			expect((step1 as any)._scrolled).toBeUndefined();
			expect(step1.classList.contains("gram-pulse-producer")).toBe(false);

			cleanup();
			container.remove();
		});

		it("highlights an item's steps when hovering it in a list, never the other way round", () => {
			const container = (document as any).createElement("div");

			// Shopping list item
			const kitLi = (document as any).createElement("li");
			kitLi.className = "kit-ingredient";
			const kitName = (document as any).createElement("span");
			kitName.className = "kit-name ingredient";
			kitName.setAttribute("data-name", "flour");
			kitLi.appendChild(kitName);
			container.appendChild(kitLi);

			// Steps containing flour
			const stepsOl = (document as any).createElement("ol");
			stepsOl.className = "steps";
			const step1 = (document as any).createElement("li");
			const ingSpan = (document as any).createElement("span");
			ingSpan.className = "ingredient";
			ingSpan.setAttribute("data-name", "flour");
			step1.appendChild(ingSpan);
			stepsOl.appendChild(step1);
			container.appendChild(stepsOl);

			document.body.appendChild(container);

			const cleanup = attachTooltips(container as any);

			// Hover over the ingredient in the list: its step lights up
			kitName.dispatchEvent({ type: "pointerover", bubbles: true });
			expect(ingSpan.classList.contains("gram-ingredient-active")).toBe(true);
			expect(step1.classList.contains("gram-ingredient-step-active")).toBe(
				true,
			);

			// Pointer out: cleared
			kitName.dispatchEvent({ type: "pointerout", bubbles: true });
			expect(ingSpan.classList.contains("gram-ingredient-active")).toBe(false);
			expect(step1.classList.contains("gram-ingredient-step-active")).toBe(
				false,
			);

			// Hover over the ingredient in a step: nothing lights up
			ingSpan.dispatchEvent({ type: "pointerover", bubbles: true });
			expect(kitName.classList.contains("gram-ingredient-active")).toBe(false);
			expect(kitLi.classList.contains("gram-ingredient-active")).toBe(false);
			expect(ingSpan.classList.contains("gram-ingredient-active")).toBe(false);
			expect(step1.classList.contains("gram-ingredient-step-active")).toBe(
				false,
			);

			cleanup();
			container.remove();
		});

		it("scopes ingredient highlighting to the containing section when inside a section", () => {
			const container = (document as any).createElement("div");

			// Section 1
			const sec1 = (document as any).createElement("section");
			const kitLi1 = (document as any).createElement("li");
			kitLi1.className = "kit-ingredient";
			const kitName1 = (document as any).createElement("span");
			kitName1.className = "kit-name ingredient";
			kitName1.setAttribute("data-name", "salt");
			kitLi1.appendChild(kitName1);
			sec1.appendChild(kitLi1);

			const stepsOl1 = (document as any).createElement("ol");
			stepsOl1.className = "steps";
			const step1 = (document as any).createElement("li");
			const ingSpan1 = (document as any).createElement("span");
			ingSpan1.className = "ingredient";
			ingSpan1.setAttribute("data-name", "salt");
			step1.appendChild(ingSpan1);
			stepsOl1.appendChild(step1);
			sec1.appendChild(stepsOl1);
			container.appendChild(sec1);

			// Section 2
			const sec2 = (document as any).createElement("section");
			const kitLi2 = (document as any).createElement("li");
			kitLi2.className = "kit-ingredient";
			const kitName2 = (document as any).createElement("span");
			kitName2.className = "kit-name ingredient";
			kitName2.setAttribute("data-name", "salt");
			kitLi2.appendChild(kitName2);
			sec2.appendChild(kitLi2);

			const stepsOl2 = (document as any).createElement("ol");
			stepsOl2.className = "steps";
			const step2 = (document as any).createElement("li");
			const ingSpan2 = (document as any).createElement("span");
			ingSpan2.className = "ingredient";
			ingSpan2.setAttribute("data-name", "salt");
			step2.appendChild(ingSpan2);
			stepsOl2.appendChild(step2);
			sec2.appendChild(stepsOl2);
			container.appendChild(sec2);

			document.body.appendChild(container);

			const cleanup = attachTooltips(container as any);

			// Hover over salt in Section 1's ingredient list
			kitName1.dispatchEvent({ type: "pointerover", bubbles: true });
			expect(kitName1.classList.contains("gram-ingredient-active")).toBe(true);
			expect(step1.classList.contains("gram-ingredient-step-active")).toBe(
				true,
			);

			// Section 2's salt and step must NOT be highlighted
			expect(kitName2.classList.contains("gram-ingredient-active")).toBe(false);
			expect(step2.classList.contains("gram-ingredient-step-active")).toBe(
				false,
			);

			cleanup();
			container.remove();
		});

		it("toggles step completion when clicking step number circle", () => {
			const container = (document as any).createElement("div");
			const stepsOl = (document as any).createElement("ol");
			stepsOl.className = "steps";
			const step = (document as any).createElement("li");
			stepsOl.appendChild(step);
			container.appendChild(stepsOl);
			document.body.appendChild(container);

			const cleanup = attachTooltips(container as any);

			// Click within circle (clientX - rect.left <= 36): rect.left is 50, clientX = 60 => diff = 10
			step.dispatchEvent({ type: "click", clientX: 60, bubbles: true });
			expect(step.classList.contains("is-completed")).toBe(true);

			// Click again: toggles off
			step.dispatchEvent({ type: "click", clientX: 60, bubbles: true });
			expect(step.classList.contains("is-completed")).toBe(false);

			// Click outside circle (e.g. clientX = 120 => diff = 70): does not toggle
			step.dispatchEvent({ type: "click", clientX: 120, bubbles: true });
			expect(step.classList.contains("is-completed")).toBe(false);

			cleanup();
			container.remove();
		});

		it("copies shopping list text and provides visual feedback", async () => {
			let copiedText = "";
			(globalThis as any).navigator = {
				clipboard: {
					writeText: async (text: string) => {
						copiedText = text;
					},
				},
			};

			const container = (document as any).createElement("div");
			const accordion = (document as any).createElement("details");
			accordion.className = "prep-accordion shopping-list";

			const summary = (document as any).createElement("summary");
			summary.className = "prep-summary";
			const copyBtn = (document as any).createElement("button");
			copyBtn.className = "copy-shopping-btn";
			copyBtn.setAttribute("data-copied-text", "Copied!");
			const label = (document as any).createElement("span");
			label.className = "copy-label";
			label.textContent = "Copy list";
			const copyIcon = (document as any).createElement("span");
			copyIcon.className = "copy-icon";
			const checkIcon = (document as any).createElement("span");
			checkIcon.className = "check-icon";
			copyBtn.appendChild(copyIcon);
			copyBtn.appendChild(checkIcon);
			copyBtn.appendChild(label);
			summary.appendChild(copyBtn);
			accordion.appendChild(summary);

			const body = (document as any).createElement("div");
			body.className = "prep-body";
			const group = (document as any).createElement("div");
			group.className = "mep-group";
			const title = (document as any).createElement("h5");
			title.className = "mep-group-title";
			title.textContent = "Shopping List";
			group.appendChild(title);

			const item1 = (document as any).createElement("li");
			item1.className = "kit-ingredient";
			const name1 = (document as any).createElement("span");
			name1.className = "kit-name";
			name1.textContent = "flour";
			const qty1 = (document as any).createElement("span");
			qty1.className = "kit-qty";
			qty1.textContent = "200 g";
			item1.appendChild(name1);
			item1.appendChild(qty1);
			group.appendChild(item1);

			// A composite: copied as its parent line only, never its parts.
			const composite = (document as any).createElement("li");
			composite.className = "kit-ingredient kit-composite";
			const compName = (document as any).createElement("span");
			compName.className = "kit-name";
			compName.textContent = "lemon";
			const compQty = (document as any).createElement("span");
			compQty.className = "kit-qty";
			compQty.textContent = "3";
			composite.appendChild(compName);
			composite.appendChild(compQty);
			const usageList = (document as any).createElement("ul");
			usageList.className = "kit-usage-list";
			const usage = (document as any).createElement("li");
			usage.className = "kit-usage";
			const usageName = (document as any).createElement("span");
			usageName.className = "kit-usage-name";
			usageName.textContent = "lemon juice";
			usage.appendChild(usageName);
			usageList.appendChild(usage);
			composite.appendChild(usageList);
			group.appendChild(composite);

			body.appendChild(group);
			accordion.appendChild(body);
			container.appendChild(accordion);
			document.body.appendChild(container);

			const cleanup = attachTooltips(container as any);

			copyBtn.dispatchEvent({
				type: "click",
				bubbles: true,
				preventDefault: () => {},
				stopPropagation: () => {},
			});

			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(copiedText).toContain("- flour: 200 g");
			expect(copiedText).toContain("- lemon: 3");
			expect(copiedText).not.toContain("lemon juice");
			expect(copyBtn.classList.contains("copied")).toBe(true);
			expect(label.textContent).toBe("Copied!");

			cleanup();
			container.remove();
		});
	});
});
