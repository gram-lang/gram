/**
 * Universal Floating Tooltip Engine for Gram HTML Views.
 *
 * Provides:
 * - Dynamic, viewport-aware floating tooltips positioned with getBoundingClientRect()
 *   and edge clamping (preventing truncation on screen or overflow:hidden container edges).
 * - Bidirectional intermediate ingredient highlighting and click-to-scroll navigation.
 * - Ingredient & cookware cross-highlighting between shopping list, kits and steps.
 * - Step completion toggling by clicking on step numbers.
 * - Shopping list one-click copy with clipboard integration and visual feedback.
 */

export function attachTooltips(container?: HTMLElement | Document): () => void {
	if (typeof document === "undefined" || typeof window === "undefined") {
		return () => {};
	}

	const targetContainer = container ?? document;

	// What triggers the link to where an intermediate is used: the "↳ dough"
	// under a step and the "→ dough" badge of a section only. A step and a
	// section header carry `data-declares` too, but as the place to highlight
	// or to scroll to: hovering or clicking anywhere in them does nothing.
	const DECL_TRIGGER =
		".step-result-item[data-declares], .section-declaration-badge[data-declares]";
	let tooltipEl: HTMLDivElement | null = document.getElementById(
		"gram-global-tooltip",
	) as HTMLDivElement | null;

	if (!tooltipEl) {
		tooltipEl = document.createElement("div");
		tooltipEl.id = "gram-global-tooltip";
		tooltipEl.className = "gram-tooltip-fixed";
		document.body.appendChild(tooltipEl);
	}

	// Signal to CSS that JS tooltips are active, which disables CSS pseudo-tooltips
	document.body.classList.add("gram-has-js-tooltips");

	let activeTarget: HTMLElement | null = null;
	let activeProducers: HTMLElement[] = [];
	let activeConsumers: HTMLElement[] = [];
	let activeRefEl: HTMLElement | null = null;
	let activeDeclEl: HTMLElement | null = null;

	let activeHighlightedItems: HTMLElement[] = [];
	let activeHighlightedSteps: HTMLElement[] = [];
	let activeItemAttr: string | null = null;
	let activeItemVal: string | null = null;
	let activeItemScope: HTMLElement | Document | null = null;

	function clearIntermediateHighlights() {
		for (const el of activeProducers) {
			el.classList.remove("gram-highlight-producer");
		}
		activeProducers = [];
		for (const el of activeConsumers) {
			el.classList.remove("gram-highlight-consumer");
		}
		activeConsumers = [];
		if (activeRefEl) {
			activeRefEl.classList.remove("gram-highlight-active");
			activeRefEl = null;
		}
		if (activeDeclEl) {
			activeDeclEl.classList.remove("gram-highlight-active");
			activeDeclEl = null;
		}
	}

	function clearItemHighlights() {
		for (const el of activeHighlightedItems) {
			el.classList.remove("gram-ingredient-active");
		}
		activeHighlightedItems = [];
		for (const el of activeHighlightedSteps) {
			el.classList.remove("gram-ingredient-step-active");
		}
		activeHighlightedSteps = [];
		activeItemAttr = null;
		activeItemVal = null;
		activeItemScope = null;
	}

	function handleIntermediateOver(target: HTMLElement) {
		if (
			typeof target.closest !== "function" ||
			typeof targetContainer.querySelectorAll !== "function"
		) {
			return;
		}

		const refEl = target.closest<HTMLElement>("[data-ref-id]");
		if (refEl) {
			const refId = refEl.getAttribute("data-ref-id");
			if (refId) {
				clearIntermediateHighlights();
				activeRefEl = refEl;
				refEl.classList.add("gram-highlight-active");
				const safeId =
					typeof CSS !== "undefined" && CSS.escape ? CSS.escape(refId) : refId;
				const producers = targetContainer.querySelectorAll<HTMLElement>(
					`[data-declares~="${safeId}"]`,
				);
				// A section that makes the intermediate (`## Dough ->&dough`) is
				// highlighted whole, not only its title: the reader sees all it
				// takes to make it.
				const highlighted = new Set<HTMLElement>();
				producers.forEach((p) => {
					const inHeader =
						p.classList.contains("section-header") ||
						p.classList.contains("section-declaration-badge");
					highlighted.add(
						inHeader ? (p.closest<HTMLElement>("section") ?? p) : p,
					);
				});
				highlighted.forEach((p) => {
					p.classList.add("gram-highlight-producer");
					activeProducers.push(p);
				});
				return;
			}
		}

		const declEl = target.closest<HTMLElement>(DECL_TRIGGER);
		if (declEl) {
			const declAttr = declEl.getAttribute("data-declares");
			if (declAttr) {
				clearIntermediateHighlights();
				activeDeclEl = declEl;
				declEl.classList.add("gram-highlight-active");
				const declIds = declAttr.trim().split(/\s+/);
				for (const id of declIds) {
					const safeId =
						typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id;
					const consumers = targetContainer.querySelectorAll<HTMLElement>(
						`[data-ref-id="${safeId}"]`,
					);
					consumers.forEach((c) => {
						c.classList.add("gram-highlight-consumer");
						activeConsumers.push(c);
					});
				}
				return;
			}
		}

		clearIntermediateHighlights();
	}

	function handleItemCrossHighlight(target: HTMLElement) {
		if (
			typeof target.closest !== "function" ||
			typeof targetContainer.querySelectorAll !== "function"
		) {
			return;
		}

		// One way only: hovering an item of a list (shopping list or section kit)
		// shows where it is used in the steps. Hovering it in a step highlights
		// nothing — the reader already knows which item it is, and its
		// quantity is in the step (or in its tooltip).
		const itemEl = target.closest<HTMLElement>(
			"li.kit-ingredient, li.kit-cookware",
		);
		if (!itemEl) {
			clearItemHighlights();
			return;
		}

		// In an alternative (`butter or oil`), the option under the pointer.
		const hoveredName = target.closest<HTMLElement>("[data-name]");
		const nameEl =
			hoveredName && itemEl.contains(hoveredName)
				? hoveredName
				: itemEl.querySelector<HTMLElement>("[data-name]");
		if (!nameEl) {
			clearItemHighlights();
			return;
		}

		const name = nameEl.getAttribute("data-name");
		if (!name) {
			clearItemHighlights();
			return;
		}

		const isCookware =
			itemEl.classList.contains("cookware") ||
			itemEl.classList.contains("kit-cookware");
		const typeKey = isCookware ? "cookware" : "ingredient";

		const sectionEl = itemEl.closest<HTMLElement>("section");
		const scope = sectionEl ?? targetContainer;

		if (
			activeItemAttr === typeKey &&
			activeItemVal === name &&
			activeItemScope === scope
		) {
			return;
		}

		clearItemHighlights();
		activeItemAttr = typeKey;
		activeItemVal = name;
		activeItemScope = scope;

		const safeName =
			typeof CSS !== "undefined" && CSS.escape ? CSS.escape(name) : name;
		const selector = isCookware
			? `.cookware[data-name="${safeName}"], li.kit-cookware`
			: `.ingredient[data-name="${safeName}"], li.kit-ingredient`;

		const matches = scope.querySelectorAll<HTMLElement>(selector);
		matches.forEach((el) => {
			if (el.tagName === "LI") {
				const innerName = el.querySelector<HTMLElement>("[data-name]");
				if (innerName?.getAttribute("data-name") !== name) return;
			}
			el.classList.add("gram-ingredient-active");
			activeHighlightedItems.push(el);

			const stepLi = el.closest<HTMLElement>(".steps li:not(.step-comment)");
			if (stepLi && !activeHighlightedSteps.includes(stepLi)) {
				stepLi.classList.add("gram-ingredient-step-active");
				activeHighlightedSteps.push(stepLi);
			}
		});
	}

	function handleClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (!target || typeof target.closest !== "function") return;

		// 1. Shopping list copy button
		const copyBtn = target.closest<HTMLElement>(".copy-shopping-btn");
		if (copyBtn) {
			e.preventDefault();
			e.stopPropagation();
			const mepGroup = copyBtn.closest<HTMLElement>(".mep-group");
			const root = mepGroup ?? copyBtn.closest<HTMLElement>(".prep-accordion");
			if (!root) return;

			const lines: string[] = [];
			const items = root.querySelectorAll<HTMLElement>("li.kit-ingredient");
			items.forEach((item) => {
				if (item.classList.contains("list-item-group")) return;
				const nameEl = item.querySelector<HTMLElement>(".kit-name");
				const prepEl = item.querySelector<HTMLElement>(".kit-prep");
				const qtyEl = item.querySelector<HTMLElement>(".kit-qty");
				const name = nameEl?.textContent?.trim() || "";
				const prep = prepEl?.textContent?.trim() || "";
				const qty = qtyEl?.textContent?.trim().replace(/\s+/g, " ") || "";
				if (!name) return;
				let line = "- " + name;
				if (prep) line += ` (${prep})`;
				if (qty) line += `: ${qty}`;
				lines.push(line);
			});

			const text = lines.join("\n").trim();
			if (text) {
				const doCopy = (str: string) => {
					if (
						typeof navigator !== "undefined" &&
						navigator.clipboard &&
						navigator.clipboard.writeText
					) {
						return navigator.clipboard.writeText(str);
					}
					return new Promise<void>((resolve, reject) => {
						try {
							const ta = document.createElement("textarea");
							ta.value = str;
							ta.style.position = "fixed";
							ta.style.opacity = "0";
							document.body.appendChild(ta);
							ta.select();
							document.execCommand("copy");
							document.body.removeChild(ta);
							resolve();
						} catch (err) {
							reject(err);
						}
					});
				};

				doCopy(text)
					.then(() => {
						const labelEl = copyBtn.querySelector<HTMLElement>(".copy-label");
						const copyIcon = copyBtn.querySelector<HTMLElement>(".copy-icon");
						const checkIcon = copyBtn.querySelector<HTMLElement>(".check-icon");
						const origLabel = labelEl?.textContent || "";
						const copiedText =
							copyBtn.getAttribute("data-copied-text") || "Copied!";

						copyBtn.classList.add("copied");
						if (labelEl) labelEl.textContent = copiedText;
						if (copyIcon) copyIcon.style.display = "none";
						if (checkIcon) checkIcon.style.display = "inline";

						setTimeout(() => {
							copyBtn.classList.remove("copied");
							if (labelEl) labelEl.textContent = origLabel;
							if (copyIcon) copyIcon.style.display = "inline";
							if (checkIcon) checkIcon.style.display = "none";
						}, 1500);
					})
					.catch(() => {});
			}
			return;
		}

		// 2. Step completion toggle (click on step number circle, first 36px)
		const stepLi = target.closest<HTMLElement>(".steps li:not(.step-comment)");
		if (stepLi) {
			const rect = stepLi.getBoundingClientRect();
			if (e.clientX - rect.left <= 36) {
				stepLi.classList.toggle("is-completed");
				return;
			}
		}

		// 3. Intermediate reference navigation (click-to-scroll)
		if (typeof targetContainer.querySelector !== "function") return;
		// In a list, a click checks the line: the reference only shows where it
		// comes from on hover.
		const refEl = target.closest<HTMLElement>("[data-ref-id]");
		if (refEl && !refEl.closest(".kit-list")) {
			const refId = refEl.getAttribute("data-ref-id");
			if (refId) {
				const safeId =
					typeof CSS !== "undefined" && CSS.escape ? CSS.escape(refId) : refId;
				const producer = targetContainer.querySelector<HTMLElement>(
					`[data-declares~="${safeId}"]`,
				);
				if (producer) {
					if (typeof producer.scrollIntoView === "function") {
						producer.scrollIntoView({ behavior: "smooth", block: "center" });
					}
					producer.classList.remove("gram-pulse-producer");
					void producer.offsetWidth;
					producer.classList.add("gram-pulse-producer");
					setTimeout(() => {
						producer.classList.remove("gram-pulse-producer");
					}, 1400);
					return;
				}
			}
		}

		const declEl = target.closest<HTMLElement>(DECL_TRIGGER);
		if (declEl) {
			const declAttr = declEl.getAttribute("data-declares");
			if (declAttr) {
				const firstId = declAttr.trim().split(/\s+/)[0];
				if (firstId) {
					const safeId =
						typeof CSS !== "undefined" && CSS.escape
							? CSS.escape(firstId)
							: firstId;
					const consumer = targetContainer.querySelector<HTMLElement>(
						`[data-ref-id="${safeId}"]`,
					);
					if (consumer) {
						if (typeof consumer.scrollIntoView === "function") {
							consumer.scrollIntoView({ behavior: "smooth", block: "center" });
						}
						consumer.classList.remove("gram-pulse-producer");
						void consumer.offsetWidth;
						consumer.classList.add("gram-pulse-producer");
						setTimeout(() => {
							consumer.classList.remove("gram-pulse-producer");
						}, 1400);
					}
				}
			}
		}
	}

	function getTarget(el: HTMLElement | null): {
		element: HTMLElement;
		text?: string;
		richHtml?: string;
	} | null {
		if (!el || el === document.body) return null;

		// 1. A rich tooltip (a `.timing-tooltip` inside its host): a timing pill,
		// a mass (`.has-rich-tooltip`).
		const timingPill = el.closest<HTMLElement>(
			".has-rich-tooltip, .timing-pill, .timing-card",
		);
		if (timingPill) {
			const rich = timingPill.querySelector<HTMLElement>(".timing-tooltip");
			if (rich && rich.innerHTML.trim()) {
				return { element: timingPill, richHtml: rich.innerHTML };
			}
			const dataTip = timingPill.getAttribute("data-tooltip");
			if (dataTip) return { element: timingPill, text: dataTip };
		}

		// 2. The closest element with a tooltip: a card (`data-tooltip-html`,
		// an element of a step), else its plain text.
		const tipEl = el.closest<HTMLElement>("[data-tooltip]");
		if (tipEl) {
			const card = tipEl.getAttribute("data-tooltip-html");
			if (card) return { element: tipEl, richHtml: card };
			const text = tipEl.getAttribute("data-tooltip");
			if (text) return { element: tipEl, text };
		}

		return null;
	}

	function updatePosition(target: HTMLElement) {
		if (!tooltipEl || !tooltipEl.classList.contains("visible")) return;

		const rect = target.getBoundingClientRect();
		const tipRect = tooltipEl.getBoundingClientRect();

		let left = rect.left + rect.width / 2 - tipRect.width / 2;
		let top = rect.top - tipRect.height - 8;

		// Flip below if colliding with top of viewport
		if (top < 8) {
			top = rect.bottom + 8;
		}

		// Clamp horizontally within viewport
		if (left < 8) left = 8;
		if (left + tipRect.width > window.innerWidth - 8) {
			left = window.innerWidth - tipRect.width - 8;
		}

		// Clamp vertically if bottom overflows viewport
		if (top + tipRect.height > window.innerHeight - 8) {
			top = window.innerHeight - tipRect.height - 8;
		}

		tooltipEl.style.left = `${Math.round(left)}px`;
		tooltipEl.style.top = `${Math.round(top)}px`;
	}

	function onPointerOver(e: Event) {
		const target = e.target as HTMLElement | null;
		if (!target) return;

		handleIntermediateOver(target);
		handleItemCrossHighlight(target);

		const match = getTarget(target);
		if (!match) return;

		activeTarget = match.element;
		if (match.richHtml) {
			tooltipEl!.innerHTML = match.richHtml;
		} else if (match.text) {
			tooltipEl!.textContent = match.text;
		} else {
			return;
		}

		tooltipEl!.classList.add("visible");
		updatePosition(activeTarget);
	}

	function onPointerOut(e: PointerEvent) {
		if (
			!e.relatedTarget ||
			((!activeRefEl || !activeRefEl.contains(e.relatedTarget as Node)) &&
				(!activeDeclEl || !activeDeclEl.contains(e.relatedTarget as Node)))
		) {
			clearIntermediateHighlights();
		}

		if (
			!e.relatedTarget ||
			(!activeHighlightedItems.some((el) =>
				el.contains(e.relatedTarget as Node),
			) &&
				!activeHighlightedSteps.some((el) =>
					el.contains(e.relatedTarget as Node),
				))
		) {
			clearItemHighlights();
		}

		if (!activeTarget) return;
		if (e.relatedTarget && activeTarget.contains(e.relatedTarget as Node)) {
			return;
		}
		if (tooltipEl) {
			tooltipEl.classList.remove("visible");
		}
		activeTarget = null;
	}

	function onScroll() {
		if (activeTarget) {
			updatePosition(activeTarget);
		}
	}

	targetContainer.addEventListener(
		"pointerover",
		onPointerOver as EventListener,
		true,
	);
	targetContainer.addEventListener(
		"pointerout",
		onPointerOut as EventListener,
		true,
	);
	targetContainer.addEventListener("click", handleClick as EventListener, true);
	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onScroll, { passive: true });

	return () => {
		targetContainer.removeEventListener(
			"pointerover",
			onPointerOver as EventListener,
			true,
		);
		targetContainer.removeEventListener(
			"pointerout",
			onPointerOut as EventListener,
			true,
		);
		targetContainer.removeEventListener(
			"click",
			handleClick as EventListener,
			true,
		);
		window.removeEventListener("scroll", onScroll);
		window.removeEventListener("resize", onScroll);
		clearIntermediateHighlights();
		clearItemHighlights();
		document.body.classList.remove("gram-has-js-tooltips");
		if (tooltipEl && tooltipEl.parentNode) {
			tooltipEl.parentNode.removeChild(tooltipEl);
		}
	};
}

export const TOOLTIP_SCRIPT = `(function() {
  if (typeof document === 'undefined') return;
  var tooltip = document.getElementById('gram-global-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'gram-global-tooltip';
    tooltip.className = 'gram-tooltip-fixed';
    document.body.appendChild(tooltip);
  }
  document.body.classList.add('gram-has-js-tooltips');
  var active = null;
  function update(t) {
    if (!tooltip || !tooltip.classList.contains('visible')) return;
    var r = t.getBoundingClientRect(), tr = tooltip.getBoundingClientRect();
    var left = r.left + r.width/2 - tr.width/2;
    var top = r.top - tr.height - 8;
    if (top < 8) top = r.bottom + 8;
    if (left < 8) left = 8;
    if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - tr.width - 8;
    if (top + tr.height > window.innerHeight - 8) top = window.innerHeight - tr.height - 8;
    tooltip.style.left = Math.round(left) + 'px';
    tooltip.style.top = Math.round(top) + 'px';
  }
  var DECL_TRIGGER = '.step-result-item[data-declares], .section-declaration-badge[data-declares]';
  var activeProds = [], activeCons = [], activeRef = null, activeDecl = null;
  function clearHighlights() {
    for (var i = 0; i < activeProds.length; i++) activeProds[i].classList.remove('gram-highlight-producer');
    activeProds = [];
    for (var j = 0; j < activeCons.length; j++) activeCons[j].classList.remove('gram-highlight-consumer');
    activeCons = [];
    if (activeRef) { activeRef.classList.remove('gram-highlight-active'); activeRef = null; }
    if (activeDecl) { activeDecl.classList.remove('gram-highlight-active'); activeDecl = null; }
  }
  var activeHlItems = [], activeHlSteps = [], activeHlAttr = null, activeHlVal = null, activeHlScope = null;
  function clearItemHighlights() {
    for (var i = 0; i < activeHlItems.length; i++) activeHlItems[i].classList.remove('gram-ingredient-active');
    activeHlItems = [];
    for (var j = 0; j < activeHlSteps.length; j++) activeHlSteps[j].classList.remove('gram-ingredient-step-active');
    activeHlSteps = [];
    activeHlAttr = null;
    activeHlVal = null;
    activeHlScope = null;
  }
  function handleIntermediates(el) {
    if (!el || !el.closest) return;
    var ref = el.closest('[data-ref-id]');
    if (ref) {
      var rId = ref.getAttribute('data-ref-id');
      if (rId) {
        clearHighlights();
        activeRef = ref;
        ref.classList.add('gram-highlight-active');
        var s = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(rId) : rId;
        var prods = document.querySelectorAll('[data-declares~="' + s + '"]');
        for (var k = 0; k < prods.length; k++) {
          var box = prods[k];
          if (box.classList.contains('section-header') || box.classList.contains('section-declaration-badge')) box = box.closest('section') || box;
          if (activeProds.indexOf(box) !== -1) continue;
          box.classList.add('gram-highlight-producer');
          activeProds.push(box);
        }
        return;
      }
    }
    var decl = el.closest(DECL_TRIGGER);
    if (decl) {
      var dAttr = decl.getAttribute('data-declares');
      if (dAttr) {
        clearHighlights();
        activeDecl = decl;
        decl.classList.add('gram-highlight-active');
        var ids = dAttr.trim().split(/\\s+/);
        for (var m = 0; m < ids.length; m++) {
          var sId = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(ids[m]) : ids[m];
          var cons = document.querySelectorAll('[data-ref-id="' + sId + '"]');
          for (var n = 0; n < cons.length; n++) {
            cons[n].classList.add('gram-highlight-consumer');
            activeCons.push(cons[n]);
          }
        }
        return;
      }
    }
    clearHighlights();
  }
  function handleItemCrossHighlight(el) {
    if (!el || !el.closest) return;
    var itemEl = el.closest('li.kit-ingredient, li.kit-cookware');
    if (!itemEl) { clearItemHighlights(); return; }
    var hovName = el.closest('[data-name]');
    var nameEl = (hovName && itemEl.contains(hovName)) ? hovName : itemEl.querySelector('[data-name]');
    if (!nameEl) { clearItemHighlights(); return; }
    var name = nameEl.getAttribute('data-name');
    if (!name) { clearItemHighlights(); return; }
    var isCw = itemEl.classList.contains('cookware') || itemEl.classList.contains('kit-cookware');
    var typeKey = isCw ? 'cookware' : 'ingredient';
    var sectionEl = itemEl.closest ? itemEl.closest('section') : null;
    var scope = sectionEl || document;
    if (activeHlAttr === typeKey && activeHlVal === name && activeHlScope === scope) return;
    clearItemHighlights();
    activeHlAttr = typeKey;
    activeHlVal = name;
    activeHlScope = scope;
    var sName = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(name) : name;
    var sel = isCw ? ('.cookware[data-name="' + sName + '"], li.kit-cookware') : ('.ingredient[data-name="' + sName + '"], li.kit-ingredient');
    var matches = scope.querySelectorAll(sel);
    for (var p = 0; p < matches.length; p++) {
      if (matches[p].tagName === 'LI') {
        var inName = matches[p].querySelector('[data-name]');
        if (!inName || inName.getAttribute('data-name') !== name) continue;
      }
      matches[p].classList.add('gram-ingredient-active');
      activeHlItems.push(matches[p]);
      var step = matches[p].closest('.steps li:not(.step-comment)');
      if (step && activeHlSteps.indexOf(step) === -1) {
        step.classList.add('gram-ingredient-step-active');
        activeHlSteps.push(step);
      }
    }
  }
  document.addEventListener('pointerover', function(e) {
    var el = e.target;
    if (!el || el === document.body) return;
    handleIntermediates(el);
    handleItemCrossHighlight(el);
    var pill = el.closest && el.closest('.has-rich-tooltip, .timing-pill, .timing-card');
    if (pill) {
      var rich = pill.querySelector('.timing-tooltip');
      if (rich && rich.innerHTML.trim()) {
        active = pill;
        tooltip.innerHTML = rich.innerHTML;
        tooltip.classList.add('visible');
        update(active);
        return;
      }
    }
    var tip = el.closest && el.closest('[data-tooltip]');
    if (tip) {
      var card = tip.getAttribute('data-tooltip-html');
      if (card) {
        active = tip;
        tooltip.innerHTML = card;
        tooltip.classList.add('visible');
        update(active);
        return;
      }
      var txt = tip.getAttribute('data-tooltip');
      if (txt) {
        active = tip;
        tooltip.textContent = txt;
        tooltip.classList.add('visible');
        update(active);
      }
    }
  }, true);
  document.addEventListener('pointerout', function(e) {
    if (!e.relatedTarget || ((!activeRef || !activeRef.contains(e.relatedTarget)) && (!activeDecl || !activeDecl.contains(e.relatedTarget)))) {
      clearHighlights();
    }
    if (!e.relatedTarget) {
      clearItemHighlights();
    } else {
      var insideItem = false;
      for (var a = 0; a < activeHlItems.length; a++) { if (activeHlItems[a].contains(e.relatedTarget)) { insideItem = true; break; } }
      if (!insideItem) {
        for (var b = 0; b < activeHlSteps.length; b++) { if (activeHlSteps[b].contains(e.relatedTarget)) { insideItem = true; break; } }
      }
      if (!insideItem) clearItemHighlights();
    }
    if (!active) return;
    if (e.relatedTarget && active.contains(e.relatedTarget)) return;
    tooltip.classList.remove('visible');
    active = null;
  }, true);
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var copyBtn = el.closest('.copy-shopping-btn');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      var mepGroup = copyBtn.closest('.mep-group');
      var root = mepGroup || copyBtn.closest('.prep-accordion');
      if (!root) return;
      var lines = [];
      var items = root.querySelectorAll('li.kit-ingredient');
      for (var it = 0; it < items.length; it++) {
        if (items[it].classList.contains('list-item-group')) continue;
        var nameEl = items[it].querySelector('.kit-name');
        var prepEl = items[it].querySelector('.kit-prep');
        var qtyEl = items[it].querySelector('.kit-qty');
        var name = nameEl && nameEl.textContent ? nameEl.textContent.trim() : '';
        var prep = prepEl && prepEl.textContent ? prepEl.textContent.trim() : '';
        var qty = qtyEl && qtyEl.textContent ? qtyEl.textContent.trim().replace(/\\s+/g, ' ') : '';
        if (!name) continue;
        var line = '- ' + name;
        if (prep) line += ' (' + prep + ')';
        if (qty) line += ': ' + qty;
        lines.push(line);
      }
      var text = lines.join('\\n').trim();
      if (text) {
        var onDone = function() {
          var labelEl = copyBtn.querySelector('.copy-label');
          var copyIcon = copyBtn.querySelector('.copy-icon');
          var checkIcon = copyBtn.querySelector('.check-icon');
          var origLabel = labelEl ? labelEl.textContent : '';
          var copiedText = copyBtn.getAttribute('data-copied-text') || 'Copied!';
          copyBtn.classList.add('copied');
          if (labelEl) labelEl.textContent = copiedText;
          if (copyIcon) copyIcon.style.display = 'none';
          if (checkIcon) checkIcon.style.display = 'inline';
          setTimeout(function() {
            copyBtn.classList.remove('copied');
            if (labelEl) labelEl.textContent = origLabel;
            if (copyIcon) copyIcon.style.display = 'inline';
            if (checkIcon) checkIcon.style.display = 'none';
          }, 1500);
        };
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(onDone).catch(function() {});
        } else {
          try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            onDone();
          } catch (_) {}
        }
      }
      return;
    }
    var stepLi = el.closest('.steps li:not(.step-comment)');
    if (stepLi) {
      var rect = stepLi.getBoundingClientRect();
      if (e.clientX - rect.left <= 36) {
        stepLi.classList.toggle('is-completed');
        return;
      }
    }
    var ref = el.closest('[data-ref-id]');
    if (ref && !ref.closest('.kit-list')) {
      var rId = ref.getAttribute('data-ref-id');
      if (rId) {
        var s = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(rId) : rId;
        var prod = document.querySelector('[data-declares~="' + s + '"]');
        if (prod) {
          if (prod.scrollIntoView) prod.scrollIntoView({ behavior: 'smooth', block: 'center' });
          prod.classList.remove('gram-pulse-producer');
          void prod.offsetWidth;
          prod.classList.add('gram-pulse-producer');
          setTimeout(function() { prod.classList.remove('gram-pulse-producer'); }, 1400);
          return;
        }
      }
    }
    var decl = el.closest(DECL_TRIGGER);
    if (decl) {
      var dAttr = decl.getAttribute('data-declares');
      if (dAttr) {
        var first = dAttr.trim().split(/\\s+/)[0];
        if (first) {
          var sId = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(first) : first;
          var con = document.querySelector('[data-ref-id="' + sId + '"]');
          if (con) {
            if (con.scrollIntoView) con.scrollIntoView({ behavior: 'smooth', block: 'center' });
            con.classList.remove('gram-pulse-producer');
            void con.offsetWidth;
            con.classList.add('gram-pulse-producer');
            setTimeout(function() { con.classList.remove('gram-pulse-producer'); }, 1400);
          }
        }
      }
    }
  }, true);
  window.addEventListener('scroll', function() { if (active) update(active); }, { passive: true });
  window.addEventListener('resize', function() { if (active) update(active); }, { passive: true });
})();`;
