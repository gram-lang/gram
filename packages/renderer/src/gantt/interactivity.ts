import { formatAxisTime, formatTime } from "./layout";
import type {
	GanttInteractivityHandle,
	GanttInteractivityOptions,
	GanttTimeMode,
} from "./types";

const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 80;

// `element.dataset.*` returns HTML-entity-decoded text (the browser decodes
// entities while parsing attribute values) — re-inserting that decoded text
// into `innerHTML` without re-escaping would undo the escaping `toGanttHTML`
// already applied and reopen an XSS hole for recipe content that reaches a
// block's label/tooltip. A local helper avoids pulling in `../utils` (and
// its parser/kitchen deps) just for this one leaf function — this module is
// bundled standalone into the vscode-extension webview.
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function computeDefaultTargetTime(maxRealTime: number): string {
	const now = new Date();
	now.setMinutes(now.getMinutes() + maxRealTime);
	// Round to nearest 15 minutes.
	const m = (Math.round(now.getMinutes() / 15) * 15) % 60;
	const h = now.getHours() + (m === 0 && now.getMinutes() > 30 ? 1 : 0);
	return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function getMaxRealTime(container: HTMLElement): number {
	const wrapper = container.querySelector<HTMLElement>(".gantt-wrapper");
	return Number(wrapper?.dataset.maxRealTime ?? 0);
}

/**
 * Wires up the interactive parts of a `toGanttHTML` fragment: hover
 * tooltips, the time-mode/target-time/compact-mode controls, and the
 * section-legend overflow popover keyboard focus. Everything runs off
 * event delegation on `container`, so it survives `container.innerHTML`
 * being replaced by a fresh server/render push — call `setOptions` again
 * afterwards to reassert the user's last choices onto the new DOM.
 */
export function attachGanttInteractivity(
	container: HTMLElement,
	initial: GanttInteractivityOptions,
): GanttInteractivityHandle {
	const state: GanttInteractivityOptions = { ...initial };
	if (!state.targetTime) {
		state.targetTime = computeDefaultTargetTime(getMaxRealTime(container));
	}

	let tooltipEl: HTMLDivElement | null = null;
	let tooltipBlock: HTMLElement | null = null;

	function buildTooltipHTML(block: HTMLElement): string {
		const label = block.dataset.label ?? "";
		const tooltipText = block.dataset.tooltip ?? "";
		const temperature = block.dataset.temperature;
		const start = Number(block.dataset.start ?? 0);
		const end = Number(block.dataset.end ?? 0);
		const duration = block.dataset.duration ?? "";
		const maxRealTime = getMaxRealTime(container);
		const axisOpts = {
			timeMode: state.timeMode,
			targetTime: state.targetTime,
			maxRealTime,
		};

		const header = label
			? `<div class="tooltip-header"><strong>${escapeHtml(label)}</strong>${
					temperature
						? `<span class="temp-badge-tooltip">🌡️ ${escapeHtml(temperature)}</span>`
						: ""
				}</div>`
			: "";
		const body =
			tooltipText && tooltipText !== label
				? `<div class="tooltip-text">${escapeHtml(tooltipText)}</div>`
				: "";

		return `${header}
      <div class="tooltip-time">
        <span class="time-badge">${formatAxisTime(start, axisOpts)}</span>
        <span class="time-arrow">→</span>
        <span class="time-badge">${formatAxisTime(end, axisOpts)}</span>
        <span class="time-duration">(${duration}m)</span>
      </div>
      ${body}`;
	}

	function showTooltip(block: HTMLElement, x: number, y: number) {
		if (!tooltipEl) {
			tooltipEl = document.createElement("div");
			tooltipEl.className = "gantt-tooltip-fixed";
			document.body.appendChild(tooltipEl);
		}
		tooltipBlock = block;
		tooltipEl.innerHTML = buildTooltipHTML(block);
		positionTooltip(x, y);
	}

	function positionTooltip(x: number, y: number) {
		if (!tooltipEl) return;
		let left = x + 15;
		let top = y + 15;
		if (left + TOOLTIP_WIDTH > window.innerWidth) left = x - TOOLTIP_WIDTH - 15;
		if (top + TOOLTIP_HEIGHT > window.innerHeight)
			top = y - TOOLTIP_HEIGHT - 15;
		tooltipEl.style.left = `${left}px`;
		tooltipEl.style.top = `${top}px`;
	}

	function hideTooltip() {
		tooltipBlock = null;
		if (tooltipEl) {
			tooltipEl.remove();
			tooltipEl = null;
		}
	}

	function onMouseMove(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const block = target.closest<HTMLElement>(".time-block");
		if (block && container.contains(block)) {
			showTooltip(block, e.clientX, e.clientY);
		} else if (tooltipEl) {
			hideTooltip();
		}
	}

	function onMouseLeave() {
		hideTooltip();
	}

	function applyOptions() {
		const maxRealTime = getMaxRealTime(container);
		const axisOpts = {
			timeMode: state.timeMode,
			targetTime: state.targetTime,
			maxRealTime,
		};

		container.querySelectorAll<HTMLElement>(".axis-tick").forEach((tick) => {
			const label = tick.querySelector<HTMLElement>(".tick-label");
			const realTime = Number(tick.dataset.realTime ?? 0);
			if (label) label.textContent = formatAxisTime(realTime, axisOpts);
		});

		const select = container.querySelector<HTMLSelectElement>(".time-select");
		if (select && select.value !== state.timeMode)
			select.value = state.timeMode;

		const targetInput =
			container.querySelector<HTMLInputElement>(".target-time-input");
		if (targetInput && targetInput.value !== state.targetTime) {
			targetInput.value = state.targetTime;
		}

		const targetWrapper = container.querySelector<HTMLElement>(
			".target-time-wrapper",
		);
		if (targetWrapper) {
			targetWrapper.hidden = state.timeMode !== "target";
		}

		const compactInput = container.querySelector<HTMLInputElement>(
			".compact-toggle-input",
		);
		if (compactInput) compactInput.checked = state.isCompactMode;

		const wrapper = container.querySelector<HTMLElement>(".gantt-wrapper");
		if (wrapper) wrapper.classList.toggle("is-compact", state.isCompactMode);

		if (tooltipEl && tooltipBlock) {
			tooltipEl.innerHTML = buildTooltipHTML(tooltipBlock);
		}
	}

	function onChange(e: Event) {
		const target = e.target as HTMLElement;
		if (target.matches(".time-select")) {
			state.timeMode = (target as HTMLSelectElement).value as GanttTimeMode;
			applyOptions();
		} else if (target.matches(".target-time-input")) {
			state.targetTime = (target as HTMLInputElement).value;
			applyOptions();
		} else if (target.matches(".compact-toggle-input")) {
			state.isCompactMode = (target as HTMLInputElement).checked;
			applyOptions();
		}
	}

	container.addEventListener("mousemove", onMouseMove);
	container.addEventListener("mouseleave", onMouseLeave);
	container.addEventListener("change", onChange);

	applyOptions();

	return {
		getOptions() {
			return { ...state };
		},
		setOptions(opts: Partial<GanttInteractivityOptions>) {
			Object.assign(state, opts);
			applyOptions();
		},
		dispose() {
			container.removeEventListener("mousemove", onMouseMove);
			container.removeEventListener("mouseleave", onMouseLeave);
			container.removeEventListener("change", onChange);
			hideTooltip();
		},
	};
}

export { formatTime, formatAxisTime };
