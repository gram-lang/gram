import { getDictionary } from "@gram-lang/i18n";
import type { RenderableCompilationResult } from "../types";
import { escapeHtml } from "../utils";
import {
	buildTracks,
	computeGaps,
	computeSectionLegendItems,
	computeTimeTicks,
	computeVisualGaps,
	getVirtualTime,
} from "./layout";
import type { GanttRenderOptions } from "./types";

const VISIBLE_SECTIONS_LIMIT = 3;

/**
 * Renders a compiled/analyzed recipe as a self-contained Gantt chart HTML
 * fragment. No time-mode/target-time/compact-mode state is baked in — the
 * output always reflects the "forward" mode with no compaction; callers
 * apply the user's chosen options client-side via `attachGanttInteractivity`
 * (see ./interactivity.ts), which reads back the `data-*` attributes this
 * function embeds on ticks and blocks.
 */
export function toGanttHTML(
	data: RenderableCompilationResult,
	options: GanttRenderOptions = {},
): string {
	const t = getDictionary(options.lang);
	const gaps = computeGaps(data, options.gapThresholdMinutes);
	const { tracks, totalVirtualTime, maxRealTime } = buildTracks(data, {
		lang: options.lang,
	});

	if (tracks.length === 0 || maxRealTime <= 0) {
		const emptyText =
			t.playground?.views?.gantt_empty ||
			"No timing data available. Write a recipe with steps and durations to see the chart.";
		return `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
	}

	const visualGaps = computeVisualGaps(gaps, totalVirtualTime);
	const ticks = computeTimeTicks(
		maxRealTime,
		totalVirtualTime,
		gaps,
		"forward",
		"",
	);
	const legendItems = computeSectionLegendItems(data, options.lang);
	const visibleLegend = legendItems.slice(0, VISIBLE_SECTIONS_LIMIT);
	const overflowLegend = legendItems.slice(VISIBLE_SECTIONS_LIMIT);

	const compressedTooltip = escapeHtml(
		t.playground?.views?.gantt_compressed || "Time compressed (idle period)",
	);

	const legendHtml = `<div class="gantt-legend">
${visibleLegend
	.map(
		(sec) => `      <span class="legend-item">
        <span class="color-box ${escapeHtml(sec.colorClass)}"></span>
        <span class="legend-text" title="${escapeHtml(sec.title)}">${escapeHtml(sec.title)}</span>
      </span>`,
	)
	.join("\n")}
${
	overflowLegend.length > 0
		? `      <div class="legend-item overflow-item" tabindex="0">
        <span class="color-box overflow-box">+${overflowLegend.length}</span>
        <span class="legend-text">${escapeHtml(
					(
						t.playground?.views?.gantt_more_sections || "+{count} more..."
					).replace("{count}", String(overflowLegend.length)),
				)}</span>
        <div class="sections-popover">
${overflowLegend
	.map(
		(sec) => `          <div class="popover-item">
            <span class="color-box ${escapeHtml(sec.colorClass)}"></span>
            <span class="popover-text">${escapeHtml(sec.title)}</span>
          </div>`,
	)
	.join("\n")}
        </div>
      </div>`
		: ""
}
      <span class="legend-item passive">
        <span class="color-box"></span>
        ${escapeHtml(t.playground?.views?.gantt_passive || "Tâche de fond")}
      </span>
    </div>`;

	const controlsHtml = `<div class="gantt-controls">
      <details class="options-dropdown">
        <summary class="options-summary" title="Options">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 11.9998C2 11.1353 2.1097 10.2964 2.31595 9.49631C3.40622 9.55283 4.48848 9.01015 5.0718 7.99982C5.65467 6.99025 5.58406 5.78271 4.99121 4.86701C6.18354 3.69529 7.66832 2.82022 9.32603 2.36133C9.8222 3.33385 10.8333 3.99982 12 3.99982C13.1667 3.99982 14.1778 3.33385 14.674 2.36133C16.3317 2.82022 17.8165 3.69529 19.0088 4.86701C18.4159 5.78271 18.3453 6.99025 18.9282 7.99982C19.5115 9.01015 20.5938 9.55283 21.6841 9.49631C21.8903 10.2964 22 11.1353 22 11.9998C22 12.8643 21.8903 13.7032 21.6841 14.5033C20.5938 14.4468 19.5115 14.9895 18.9282 15.9998C18.3453 17.0094 18.4159 18.2169 19.0088 19.1326C17.8165 20.3043 16.3317 21.1794 14.674 21.6383C14.1778 20.6658 13.1667 19.9998 12 19.9998C10.8333 19.9998 9.8222 20.6658 9.32603 21.6383C7.66832 21.1794 6.18354 20.3043 4.99121 19.1326C5.58406 18.2169 5.65467 17.0094 5.0718 15.9998C4.48848 14.9895 3.40622 14.4468 2.31595 14.5033C2.1097 13.7032 2 12.8643 2 11.9998ZM6.80385 14.9998C7.43395 16.0912 7.61458 17.3459 7.36818 18.5236C7.77597 18.8138 8.21005 19.0652 8.66489 19.2741C9.56176 18.4712 10.7392 17.9998 12 17.9998C13.2608 17.9998 14.4382 18.4712 15.3351 19.2741C15.7899 19.0652 16.224 18.8138 16.6318 18.5236C16.3854 17.3459 16.566 16.0912 17.1962 14.9998C17.8262 13.9085 18.8225 13.1248 19.9655 12.7493C19.9884 12.5015 20 12.2516 20 11.9998C20 11.7481 19.9884 11.4981 19.9655 11.2504C18.8225 10.8749 17.8262 10.0912 17.1962 8.99982C16.566 7.90845 16.3854 6.65378 16.6318 5.47605C16.224 5.18588 15.7899 4.93447 15.3351 4.72552C14.4382 5.52844 13.2608 5.99982 12 5.99982C10.7392 5.99982 9.56176 5.52844 8.66489 4.72552C8.21005 4.93447 7.77597 5.18588 7.36818 5.47605C7.61458 6.65378 7.43395 7.90845 6.80385 8.99982C6.17376 10.0912 5.17754 10.8749 4.03451 11.2504C4.01157 11.4981 4 11.7481 4 11.9998C4 12.2516 4.01157 12.5015 4.03451 12.7493C5.17754 13.1248 6.17376 13.9085 6.80385 14.9998ZM12 14.9998C10.3431 14.9998 9 13.6567 9 11.9998C9 10.343 10.3431 8.99982 12 8.99982C13.6569 8.99982 15 10.343 15 11.9998C15 13.6567 13.6569 14.9998 12 14.9998ZM12 12.9998C12.5523 12.9998 13 12.5521 13 11.9998C13 11.4475 12.5523 10.9998 12 10.9998C11.4477 10.9998 11 11.4475 11 11.9998C11 12.5521 11.4477 12.9998 12 12.9998Z"></path></svg>
        </summary>
        <div class="options-dropdown-content gantt-options-content">
          <div class="time-mode-selector">
            <div class="time-select-wrapper">
              <select class="time-select">
                <option value="forward">${escapeHtml(t.playground?.views?.gantt_mode_forward || "Stopwatch (T+)")}</option>
                <option value="reverse">${escapeHtml(t.playground?.views?.gantt_mode_reverse || "Countdown (T-)")}</option>
                <option value="target">${escapeHtml(t.playground?.views?.gantt_mode_target || "Target Time")}</option>
              </select>
              <svg class="select-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="target-time-wrapper" hidden>
              <span>${escapeHtml(t.playground?.views?.gantt_target_time_label || "Serve at:")}</span>
              <input type="time" class="target-time-input">
            </div>
          </div>
          <label class="compact-toggle">
            <input type="checkbox" class="compact-toggle-input">
            ${escapeHtml(t.playground?.views?.gantt_compact || "Vue Compacte")}
          </label>
        </div>
      </details>
    </div>`;

	const axisGapsHtml = visualGaps
		.map(
			(
				gap,
			) => `          <div class="visual-gap" style="left:${gap.leftPercent}%;width:${gap.widthPercent}%" title="${compressedTooltip}">
            <div class="gap-pattern"></div>
            <div class="gap-label">${escapeHtml(gap.label)}</div>
          </div>`,
		)
		.join("\n");

	const ticksHtml = ticks
		.map(
			(
				tick,
				index,
			) => `          <div class="axis-tick${index === 0 ? " is-first-tick" : ""}${index === ticks.length - 1 ? " is-last-tick" : ""}" data-real-time="${tick.realTime}" style="left:${tick.virtualPercent}%">
            <div class="tick-mark"></div>
            <div class="tick-label">${escapeHtml(tick.label)}</div>
          </div>`,
		)
		.join("\n");

	const trackOverlayGapsHtml = visualGaps
		.map(
			(
				gap,
			) => `          <div class="visual-gap" style="left:${gap.leftPercent}%;width:${gap.widthPercent}%" title="${compressedTooltip}">
            <div class="gap-pattern"></div>
          </div>`,
		)
		.join("\n");

	const renderBlock = (
		block: (typeof tracks)[number]["blocks"][number],
		trackType: "active" | "passive",
	) => {
		const classes = [
			"time-block",
			trackType,
			trackType === "active"
				? `section-color-${block.sectionIndex ?? "default"}`
				: "",
		]
			.filter(Boolean)
			.join(" ");
		const styleParts = [
			`left:${(getVirtualTime(block.start, gaps) / totalVirtualTime) * 100}%`,
			`width:${((getVirtualTime(block.end, gaps) - getVirtualTime(block.start, gaps)) / totalVirtualTime) * 100}%`,
		];
		if (trackType === "active") {
			const top = (block.verticalIndex ?? 0) * 40 + 8;
			styleParts.push(`top:${top}px`);
			styleParts.push(`--full-top:${top}px`);
		}
		const dataAttrs = [
			`data-start="${block.start}"`,
			`data-end="${block.end}"`,
			`data-duration="${block.duration}"`,
			`data-label="${escapeHtml(block.label)}"`,
			`data-tooltip="${escapeHtml(block.tooltip)}"`,
			block.temperature
				? `data-temperature="${escapeHtml(block.temperature)}"`
				: "",
		]
			.filter(Boolean)
			.join(" ");

		return `            <div class="${classes}" style="${styleParts.join(";")}" ${dataAttrs}>
              <div class="block-label${block.fitsInside ? " label-inside" : ""}">
                ${block.isAssembly ? `<span class="assembly-icon" title="${escapeHtml(t.playground?.views?.gantt_assembly || "Assembly / Dependencies")}">↳</span>` : ""}
                ${escapeHtml(block.label)}
                ${block.temperature ? `<span class="temp-badge">🌡️ ${escapeHtml(block.temperature)}</span>` : ""}
              </div>
            </div>`;
	};

	const tracksHtml = tracks
		.map((track) => {
			const heightStyle =
				track.type === "active"
					? ` style="height:${track.dynamicHeight}px;--full-height:${track.dynamicHeight}px"`
					: "";
			const blocksHtml = track.blocks
				.map((block) => renderBlock(block, track.type))
				.join("\n");
			return `        <div class="gantt-track ${track.type}"${heightStyle}>
          <div class="track-label" title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</div>
          <div class="track-content">
${blocksHtml}
          </div>
        </div>`;
		})
		.join("\n");

	return `<div class="gram-gantt-container">
    <div class="gantt-header">
      ${legendHtml}
      ${controlsHtml}
    </div>
    <div class="gantt-wrapper" data-max-real-time="${maxRealTime}" style="min-width:max(600px, ${totalVirtualTime * 12}px)">
      <div class="gantt-axis">
        <div class="track-label axis-label">${escapeHtml(t.playground?.views?.gantt_time || "Time")}</div>
        <div class="track-content">
          <div class="gantt-axis-gaps">
${axisGapsHtml}
          </div>
${ticksHtml}
        </div>
      </div>
      <div class="gantt-tracks">
        <div class="gantt-tracks-overlay">
          <div class="gantt-marker start-marker" style="left:0%"><div class="marker-line"></div></div>
          <div class="gantt-marker end-marker" style="left:100%"><div class="marker-line"></div></div>
${trackOverlayGapsHtml}
        </div>
${tracksHtml}
      </div>
    </div>
  </div>`;
}
