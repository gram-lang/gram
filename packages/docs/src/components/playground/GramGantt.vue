<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useData } from "vitepress";
import { getDictionary } from "@gram-lang/i18n";
import { formatElement, joinStepTokens } from "@gram-lang/renderer";

const props = defineProps<{
	jsonData: any;
}>();

const { lang } = useData();
const t = computed(() => getDictionary(lang.value));

const isCompactMode = ref(false);

// Tooltip State
const tooltipData = ref<any>(null);
const tooltipPos = ref({ x: 0, y: 0 });

const showOverflowPopover = ref(false);

const sectionLegendItems = computed(() => {
	if (!props.jsonData?.sections) return [];
	const isSingleUnnamed =
		props.jsonData.sections.length === 1 && !props.jsonData.sections[0].title;

	if (isSingleUnnamed) {
		return [
			{
				id: "default",
				title: t.value.playground?.views?.gantt_active || "Actions",
				colorClass: "section-color-default",
			},
		];
	}

	return props.jsonData.sections.map((sec: any, idx: number) => {
		return {
			id: sec.id || `section_${idx}`,
			title:
				sec.title ||
				`${t.value.playground?.views?.gantt_section || "Section"} ${idx + 1}`,
			colorClass: `section-color-${idx % 9}`,
		};
	});
});

const VISIBLE_SECTIONS_LIMIT = 3;

const visibleSectionItems = computed(() => {
	return sectionLegendItems.value.slice(0, VISIBLE_SECTIONS_LIMIT);
});

const overflowSectionItems = computed(() => {
	return sectionLegendItems.value.slice(VISIBLE_SECTIONS_LIMIT);
});

const handleMouseMove = (e: MouseEvent, block: any) => {
	tooltipData.value = block;

	const tooltipWidth = 220;
	const tooltipHeight = 80;

	let x = e.clientX + 15;
	let y = e.clientY + 15;

	if (x + tooltipWidth > window.innerWidth) {
		x = e.clientX - tooltipWidth - 15;
	}

	if (y + tooltipHeight > window.innerHeight) {
		y = e.clientY - tooltipHeight - 15;
	}

	tooltipPos.value = { x, y };
};

const handleMouseLeave = () => {
	tooltipData.value = null;
};

// Settings
const GAP_THRESHOLD = 60; // minutes. Gaps larger than this are compressed.
const COMPRESSED_GAP_SIZE = 20; // virtual minutes to represent a compressed gap.

interface TimeBlock {
	id: string;
	start: number;
	end: number;
	duration: number;
	label: string;
	tooltip: string;
	isGap?: boolean;
	originalDuration?: number;
	sectionIndex?: number | string;
	temperature?: string;
	isAssembly?: boolean;
	verticalIndex?: number;
}

interface Track {
	id: string;
	title: string;
	blocks: TimeBlock[];
	type: "active" | "passive";
	dynamicHeight?: number;
}

// 1. Extract and merge active periods to find gaps
const gaps = computed(() => {
	if (!props.jsonData?.sections) return [];

	const prepTime = props.jsonData.metrics?.preparationTime || 0;
	const activePeriods: { start: number; end: number }[] = [];
	let overallMaxRealTime = prepTime;

	if (prepTime > 0) {
		activePeriods.push({ start: 0, end: prepTime });
	}

	for (let i = 0; i < props.jsonData.sections.length; i++) {
		const section = props.jsonData.sections[i];
		for (const step of section.steps) {
			if (step.type === "step" && step.timings) {
				if (step.timings.activeDuration > 0) {
					activePeriods.push({
						start: step.timings.start + prepTime,
						end: step.timings.end + prepTime,
						sectionIndex: i,
					});
					overallMaxRealTime = Math.max(
						overallMaxRealTime,
						step.timings.end + prepTime,
					);
				}
				if (step.backgroundTasks) {
					for (const task of step.backgroundTasks) {
						overallMaxRealTime = Math.max(
							overallMaxRealTime,
							step.timings.start + prepTime + task.startOffset + task.duration,
						);
					}
				}
			}
		}
	}

	// Add zero-duration periods at the start and end to compress leading/trailing passive blocks
	activePeriods.push({ start: 0, end: 0 });
	if (overallMaxRealTime > 0) {
		activePeriods.push({ start: overallMaxRealTime, end: overallMaxRealTime });
	}

	activePeriods.sort((a, b) => a.start - b.start);

	const merged: { start: number; end: number; sectionIndex?: number }[] = [];
	for (const period of activePeriods) {
		if (merged.length === 0) {
			merged.push({ ...period });
		} else {
			const last = merged[merged.length - 1];
			if (period.start <= last.end) {
				last.end = Math.max(last.end, period.end);
				if (period.sectionIndex !== undefined) last.sectionIndex = period.sectionIndex;
			} else {
				merged.push({ ...period });
			}
		}
	}

	const foundGaps: { start: number; end: number }[] = [];
	for (let i = 0; i < merged.length - 1; i++) {
		const current = merged[i];
		const next = merged[i + 1];
		const gapDuration = next.start - current.end;

		if (gapDuration >= GAP_THRESHOLD) {
			foundGaps.push({ start: current.end, end: next.start });
		}
	}

	return foundGaps;
});

// 2. Mapping function: real minutes -> virtual minutes
function getVirtualTime(realTime: number): number {
	let virtualTime = realTime;
	let subtracted = 0;

	for (const gap of gaps.value) {
		if (realTime <= gap.start) break;

		if (realTime >= gap.end) {
			// Passed the whole gap
			const gapDuration = gap.end - gap.start;
			subtracted += gapDuration - COMPRESSED_GAP_SIZE;
		} else {
			// Inside the gap
			const timeInGap = realTime - gap.start;
			// Calculate a proportion of the compressed size
			const gapDuration = gap.end - gap.start;
			const proportion = timeInGap / gapDuration;
			const virtualTimeInGap = proportion * COMPRESSED_GAP_SIZE;
			subtracted += timeInGap - virtualTimeInGap;
		}
	}

	return virtualTime - subtracted;
}

// 3. Build tracks
const tracksData = computed(() => {
	if (!props.jsonData?.sections)
		return { tracks: [], totalVirtualTime: 0, maxRealTime: 0 };

	const prepTime = props.jsonData.metrics?.preparationTime || 0;
	const cookTrack: Track = {
		id: "cook",
		title: t.value.playground.views.gantt_cook || "Actions",
		blocks: [],
		type: "active",
	};
	const passiveTracksMap = new Map<string, Track>();

	let maxRealTime = 0;
	let activeStepIndex = 0;

	if (prepTime > 0) {
		const label = t.value.renderer?.prepTime || "Prep";
		const fitsInside = prepTime * 12 >= label.length * 7 + 36;

		cookTrack.blocks.push({
			id: "cook_prep",
			start: 0,
			end: prepTime,
			duration: prepTime,
			label: label,
			tooltip: t.value.renderer?.prepTimeTooltip || "Mise en place",
			verticalIndex: activeStepIndex++,
			fitsInside,
		});
		maxRealTime = prepTime;
	}

	// Helper to stringify step content for the tooltip
	const serializeContent = (content: any[]) => {
		if (!content || !Array.isArray(content)) return "";

		const renderContext = {
			registry: props.jsonData.registry,
			lang: lang.value,
		};

		const joined = joinStepTokens(
			content,
			(c: any) => {
				if (typeof c === "string") return c;
				if (c && typeof c === "object") {
					const md = formatElement(c, "md", renderContext);
					// Strip basic markdown formatting from tooltip text (safe unicode replace)
					return md.replace(/[*_👉]/gu, "");
				}
				return "";
			},
			(c: any) => typeof c !== "string" && c.type !== "comment",
		);

		return joined.replace(/\s+/g, " ").trim();
	};

	let sectionIndex = 0;
	const isSingleUnnamedSection =
		props.jsonData.sections.length === 1 && !props.jsonData.sections[0].title;

	for (const section of props.jsonData.sections) {
		const computedSectionIndex = isSingleUnnamedSection
			? "default"
			: sectionIndex % 9;

		for (const step of section.steps) {
			if (step.type === "step" && step.timings) {
				let temperature: string | undefined;
				let isAssembly = false;
				for (const c of step.content) {
					if (c && typeof c === "object") {
						if (c.type === "temperature") {
							temperature =
								c.text ||
								(c.quantity
									? `${typeof c.quantity === "object" ? c.quantity.value : c.quantity}${c.unit || "C"}`
									: undefined);
						}
						if (c.type === "reference") {
							isAssembly = true;
						}
					}
				}

				// Active block
				if (step.timings.activeDuration > 0) {
					const blockStart = step.timings.start + prepTime;
					const blockEnd = step.timings.end + prepTime;
					const fullText = serializeContent(step.content);
					const label = step.action || t.value.playground.views.gantt_cook || "Actions";
					const fitsInside =
						step.timings.activeDuration * 12 >= label.length * 7 + 36;

					cookTrack.blocks.push({
						id: `cook_${blockStart}`,
						start: blockStart,
						end: blockEnd,
						duration: step.timings.activeDuration,
						label: label,
						tooltip:
							fullText.length > 100
								? fullText.substring(0, 100) + "..."
								: fullText,
						sectionIndex: computedSectionIndex,
						isAssembly,
						verticalIndex: activeStepIndex++,
						fitsInside,
						temperature,
					});
					maxRealTime = Math.max(maxRealTime, blockEnd);
				}

				// Passive blocks
				if (step.backgroundTasks) {
					for (const task of step.backgroundTasks) {
						const trackName =
							task.name || t.value.playground.views.gantt_timer || "Timer";
						if (!passiveTracksMap.has(trackName)) {
							passiveTracksMap.set(trackName, {
								id: `track_${trackName}`,
								title: trackName.charAt(0).toUpperCase() + trackName.slice(1),
								blocks: [],
								type: "passive",
							});
						}

						const taskStart = step.timings.start + prepTime + task.startOffset;
						const taskEnd = taskStart + task.duration;

						passiveTracksMap.get(trackName)!.blocks.push({
							id: `task_${taskStart}_${task.name}`,
							start: taskStart,
							end: taskEnd,
							duration: task.duration,
							label: formatTime(task.duration),
							tooltip: trackName,
							temperature,
						});

						maxRealTime = Math.max(maxRealTime, taskEnd);
					}
				}
			}
		}

		sectionIndex++;
	}

	// Dynamic height calculation
	cookTrack.dynamicHeight = Math.max(48, activeStepIndex * 40 + 16);

	const tracks = [cookTrack, ...Array.from(passiveTracksMap.values())];
	const totalVirtualTime = getVirtualTime(maxRealTime);

	return { tracks, totalVirtualTime, maxRealTime };
});

const tracks = computed(() => tracksData.value.tracks);
const totalVirtualTime = computed(() => tracksData.value.totalVirtualTime);
const maxRealTime = computed(() => tracksData.value.maxRealTime);

const timeMode = ref<'forward' | 'reverse' | 'target'>('forward');

const defaultTargetTime = computed(() => {
	const now = new Date();
	now.setMinutes(now.getMinutes() + maxRealTime.value);
	// Round to nearest 15 minutes
	const m = (Math.round(now.getMinutes() / 15) * 15) % 60;
	const h = now.getHours() + (m === 0 && now.getMinutes() > 30 ? 1 : 0);
	return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
});

const targetTime = ref(defaultTargetTime.value);

// Format time (minutes to HH:MM)
function formatTime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.floor(minutes % 60);
	if (h > 0) {
		return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
	}
	return `${m}m`;
}

function formatAxisTime(realTime: number): string {
	if (timeMode.value === 'reverse') {
		const diff = maxRealTime.value - realTime;
		if (diff === 0) return "T-0";
		return `T-${formatTime(diff)}`;
	}
	if (timeMode.value === 'target' && targetTime.value) {
		const [th, tm] = targetTime.value.split(':').map(Number);
		if (!isNaN(th) && !isNaN(tm)) {
			const diff = maxRealTime.value - realTime;
			const totalTargetMins = th * 60 + tm;
			const timeAtTick = totalTargetMins - diff;
			
			// Handle negative times (previous day) or > 24h
			const normalizedTime = ((timeAtTick % 1440) + 1440) % 1440;
			const rh = Math.floor(normalizedTime / 60);
			const rm = normalizedTime % 60;
			
			const d = new Date();
			d.setHours(rh, rm, 0, 0);
			return new Intl.DateTimeFormat(undefined, {
				hour: 'numeric',
				minute: '2-digit'
			}).format(d);
		}
	}
	return formatTime(realTime);
}

// Axis ticks calculation
const timeTicks = computed(() => {
	const ticks = [];
	const maxT = tracksData.value.maxRealTime;
	const virtualT = totalVirtualTime.value;
	// Choose an interval that produces ~5-10 ticks relative to the visible area
	let interval = 10;
	if (virtualT > 120) interval = 30;
	if (virtualT > 300) interval = 60;
	if (virtualT > 1200) interval = 240;

	for (let t = 0; t <= maxT; t += interval) {
		let inGap = false;
		for (const gap of gaps.value) {
			if (t > gap.start && t < gap.end) {
				inGap = true;
				break;
			}
		}
		if (inGap) continue;

		ticks.push({
			realTime: t,
			virtualPercent: (getVirtualTime(t) / totalVirtualTime.value) * 100,
			label: formatAxisTime(t),
		});
	}

	// Add final tick if it doesn't align, avoiding text collisions with the last regular tick
	if (maxT % interval !== 0 && maxT > 0) {
		let inGap = false;
		for (const gap of gaps.value) {
			if (maxT > gap.start && maxT < gap.end) {
				inGap = true;
				break;
			}
		}
		if (!inGap) {
			const finalVirtualPercent = 100;
			// If the previous tick is too close to the end (less than 5% distance),
			// remove it so its label doesn't collide with the final time label.
			if (ticks.length > 0) {
				const lastTick = ticks[ticks.length - 1];
				if (finalVirtualPercent - lastTick.virtualPercent < 5) {
					ticks.pop();
				}
			}
			ticks.push({
				realTime: maxT,
				virtualPercent: finalVirtualPercent,
				label: formatAxisTime(maxT),
			});
		}
	}

	return ticks;
});

// Calculate visual gaps to draw zig-zags
const visualGaps = computed(() => {
	return gaps.value.map((g) => {
		const vStart = getVirtualTime(g.start);
		const vEnd = getVirtualTime(g.end);
		const skipped = g.end - g.start;
		return {
			leftPercent: (vStart / totalVirtualTime.value) * 100,
			widthPercent: ((vEnd - vStart) / totalVirtualTime.value) * 100,
			label: `⏳ ${formatTime(skipped)}`,
		};
	});
});
</script>

<template>
  <div class="gram-gantt-container" v-if="tracks.length > 0 && tracksData.maxRealTime > 0">
    <div class="gantt-header">
      <div class="gantt-legend">
        <span 
          v-for="sec in visibleSectionItems" 
          :key="sec.id" 
          class="legend-item"
        >
          <span class="color-box" :class="sec.colorClass"></span> 
          <span class="legend-text" :title="sec.title">{{ sec.title }}</span>
        </span>

        <div 
          v-if="overflowSectionItems.length > 0" 
          class="legend-item overflow-item"
          @mouseenter="showOverflowPopover = true"
          @mouseleave="showOverflowPopover = false"
        >
          <span class="color-box overflow-box">+{{ overflowSectionItems.length }}</span>
          <span class="legend-text">{{ t.playground?.views?.gantt_more_sections?.replace('{count}', String(overflowSectionItems.length)) || `+${overflowSectionItems.length} autres` }}</span>

          <div v-if="showOverflowPopover" class="sections-popover">
            <div v-for="sec in overflowSectionItems" :key="sec.id" class="popover-item">
              <span class="color-box" :class="sec.colorClass"></span>
              <span class="popover-text">{{ sec.title }}</span>
            </div>
          </div>
        </div>

        <span class="legend-item passive">
          <span class="color-box"></span> 
          {{ t.playground?.views?.gantt_passive || 'Tâche de fond' }}
        </span>
      </div>
      <div class="gantt-controls">
        <details class="options-dropdown">
          <summary class="options-summary" title="Options">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 11.9998C2 11.1353 2.1097 10.2964 2.31595 9.49631C3.40622 9.55283 4.48848 9.01015 5.0718 7.99982C5.65467 6.99025 5.58406 5.78271 4.99121 4.86701C6.18354 3.69529 7.66832 2.82022 9.32603 2.36133C9.8222 3.33385 10.8333 3.99982 12 3.99982C13.1667 3.99982 14.1778 3.33385 14.674 2.36133C16.3317 2.82022 17.8165 3.69529 19.0088 4.86701C18.4159 5.78271 18.3453 6.99025 18.9282 7.99982C19.5115 9.01015 20.5938 9.55283 21.6841 9.49631C21.8903 10.2964 22 11.1353 22 11.9998C22 12.8643 21.8903 13.7032 21.6841 14.5033C20.5938 14.4468 19.5115 14.9895 18.9282 15.9998C18.3453 17.0094 18.4159 18.2169 19.0088 19.1326C17.8165 20.3043 16.3317 21.1794 14.674 21.6383C14.1778 20.6658 13.1667 19.9998 12 19.9998C10.8333 19.9998 9.8222 20.6658 9.32603 21.6383C7.66832 21.1794 6.18354 20.3043 4.99121 19.1326C5.58406 18.2169 5.65467 17.0094 5.0718 15.9998C4.48848 14.9895 3.40622 14.4468 2.31595 14.5033C2.1097 13.7032 2 12.8643 2 11.9998ZM6.80385 14.9998C7.43395 16.0912 7.61458 17.3459 7.36818 18.5236C7.77597 18.8138 8.21005 19.0652 8.66489 19.2741C9.56176 18.4712 10.7392 17.9998 12 17.9998C13.2608 17.9998 14.4382 18.4712 15.3351 19.2741C15.7899 19.0652 16.224 18.8138 16.6318 18.5236C16.3854 17.3459 16.566 16.0912 17.1962 14.9998C17.8262 13.9085 18.8225 13.1248 19.9655 12.7493C19.9884 12.5015 20 12.2516 20 11.9998C20 11.7481 19.9884 11.4981 19.9655 11.2504C18.8225 10.8749 17.8262 10.0912 17.1962 8.99982C16.566 7.90845 16.3854 6.65378 16.6318 5.47605C16.224 5.18588 15.7899 4.93447 15.3351 4.72552C14.4382 5.52844 13.2608 5.99982 12 5.99982C10.7392 5.99982 9.56176 5.52844 8.66489 4.72552C8.21005 4.93447 7.77597 5.18588 7.36818 5.47605C7.61458 6.65378 7.43395 7.90845 6.80385 8.99982C6.17376 10.0912 5.17754 10.8749 4.03451 11.2504C4.01157 11.4981 4 11.7481 4 11.9998C4 12.2516 4.01157 12.5015 4.03451 12.7493C5.17754 13.1248 6.17376 13.9085 6.80385 14.9998ZM12 14.9998C10.3431 14.9998 9 13.6567 9 11.9998C9 10.343 10.3431 8.99982 12 8.99982C13.6569 8.99982 15 10.343 15 11.9998C15 13.6567 13.6569 14.9998 12 14.9998ZM12 12.9998C12.5523 12.9998 13 12.5521 13 11.9998C13 11.4475 12.5523 10.9998 12 10.9998C11.4477 10.9998 11 11.4475 11 11.9998C11 12.5521 11.4477 12.9998 12 12.9998Z"></path></svg>
          </summary>
          <div class="options-dropdown-content gantt-options-content">
            <div class="time-mode-selector">
              <div class="time-select-wrapper">
                <select v-model="timeMode" class="time-select">
                  <option value="forward">{{ t.playground?.views?.gantt_mode_forward || 'Stopwatch (T+)' }}</option>
                  <option value="reverse">{{ t.playground?.views?.gantt_mode_reverse || 'Countdown (T-)' }}</option>
                  <option value="target">{{ t.playground?.views?.gantt_mode_target || 'Target Time' }}</option>
                </select>
                <svg class="select-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <div v-if="timeMode === 'target'" class="target-time-wrapper">
                 <span>{{ t.playground?.views?.gantt_target_time_label || 'Serve at:' }}</span>
                 <input type="time" v-model="targetTime" class="target-time-input">
              </div>
            </div>
            <label class="compact-toggle">
              <input type="checkbox" v-model="isCompactMode">
              {{ t.playground?.views?.gantt_compact || 'Vue Compacte' }}
            </label>
          </div>
        </details>
      </div>
    </div>

    <div class="gantt-wrapper" :class="{ 'is-compact': isCompactMode }" :style="{ minWidth: `max(600px, ${totalVirtualTime * 12}px)` }">
      <!-- Axis -->
      <div class="gantt-axis">
        <div class="track-label axis-label">{{ t.playground.views.gantt_time || 'Time' }}</div>
        <div class="track-content">
          <!-- Visual Gap Overlay inside Axis -->
          <div class="gantt-axis-gaps">
            <div 
              v-for="(gap, i) in visualGaps" 
              :key="'axis_gap_'+i" 
              class="visual-gap"
              :style="{ left: `${gap.leftPercent}%`, width: `${gap.widthPercent}%` }"
              :title="t.playground?.views?.gantt_compressed || 'Time compressed (idle period)'"
            >
              <div class="gap-pattern"></div>
              <div class="gap-label">{{ gap.label }}</div>
            </div>
          </div>

          <div 
            v-for="(tick, index) in timeTicks" 
            :key="tick.realTime"
            class="axis-tick"
            :class="{ 'is-first-tick': index === 0, 'is-last-tick': index === timeTicks.length - 1 }"
            :style="{ left: `${tick.virtualPercent}%` }"
          >
            <div class="tick-mark"></div>
            <div class="tick-label">{{ tick.label }}</div>
          </div>
        </div>
      </div>

      <div class="gantt-tracks">
        <!-- Visual Gap Overlays for Tracks -->
        <div class="gantt-tracks-overlay">
          <!-- Start / End Markers -->
          <div class="gantt-marker start-marker" style="left: 0%">
            <div class="marker-line"></div>
          </div>
          <div class="gantt-marker end-marker" style="left: 100%">
            <div class="marker-line"></div>
          </div>

          <div 
            v-for="(gap, i) in visualGaps" 
            :key="'track_gap_'+i" 
            class="visual-gap"
            :style="{ left: `${gap.leftPercent}%`, width: `${gap.widthPercent}%` }"
            :title="t.playground?.views?.gantt_compressed || 'Time compressed (idle period)'"
          >
            <div class="gap-pattern"></div>
          </div>
        </div>

        <div 
          v-for="track in tracks" 
          :key="track.id" 
          class="gantt-track"
          :class="track.type"
          :style="track.type === 'active' ? { height: isCompactMode ? '48px' : `${track.dynamicHeight}px` } : {}"
        >
          <div class="track-label" :title="track.title">{{ track.title }}</div>
          <div class="track-content">
            <div 
              v-for="block in track.blocks" 
              :key="block.id"
              class="time-block"
              :class="[track.type, track.type === 'active' ? `section-color-${block.sectionIndex ?? 'default'}` : '']"
              :style="{ 
                left: `${(getVirtualTime(block.start) / totalVirtualTime) * 100}%`, 
                width: `${((getVirtualTime(block.end) - getVirtualTime(block.start)) / totalVirtualTime) * 100}%`,
                top: track.type === 'active' ? (isCompactMode ? '8px' : `${(block.verticalIndex ?? 0) * 40 + 8}px`) : undefined
              }"
              @mousemove="handleMouseMove($event, block)"
              @mouseleave="handleMouseLeave"
            >
              <div class="block-label" :class="{ 'label-inside': block.fitsInside }" :style="track.type === 'active' ? { opacity: isCompactMode && !block.fitsInside ? 0 : 1, transition: 'opacity 0.2s' } : {}">
                <span v-if="block.isAssembly" class="assembly-icon" :title="t.playground.views.gantt_assembly || 'Assembly / Dependencies'">↳</span>
                {{ block.label }}
                <span v-if="block.temperature" class="temp-badge">🌡️ {{ block.temperature }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty-state">
    {{ t.playground.views.gantt_empty || 'No timing data available. Write a recipe with steps and durations to see the chart.' }}
  </div>

  <ClientOnly>
    <Teleport to="body">
      <div v-if="tooltipData" class="gantt-tooltip-fixed" :style="{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }">
        <div class="tooltip-header" v-if="tooltipData.label" style="display: flex; justify-content: space-between; align-items: center;">
           <strong style="color: var(--vp-c-text-1);">{{ tooltipData.label }}</strong>
           <span v-if="tooltipData.temperature" style="font-size: 11px; font-weight: bold; background: var(--vp-c-bg-mute); padding: 2px 6px; border-radius: 4px; color: var(--vp-c-text-2);">🌡️ {{ tooltipData.temperature }}</span>
        </div>
        <div class="tooltip-time">
          <span class="time-badge">{{ formatAxisTime(tooltipData.start) }}</span>
          <span class="time-arrow">→</span>
          <span class="time-badge">{{ formatAxisTime(tooltipData.end) }}</span>
          <span class="time-duration">({{ tooltipData.duration }}m)</span>
        </div>
        <div class="tooltip-text" v-if="tooltipData.tooltip && tooltipData.tooltip !== tooltipData.label">{{ tooltipData.tooltip }}</div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.gram-gantt-container {
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: auto;
  font-family: var(--vp-font-family-base);
  background-color: var(--vp-c-bg);
}

.empty-state {
  color: var(--vp-c-text-3);
  text-align: center;
  padding: 40px;
  font-style: italic;
}

.gantt-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  min-height: 48px;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
  justify-content: space-between;
}

.gantt-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.gantt-controls {
  display: flex;
  align-items: center;
}

/* Options Dropdown */
.options-dropdown {
  position: relative;
}

.options-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background-color: var(--vp-c-bg);
  cursor: pointer;
  list-style: none;
  color: var(--vp-c-text-2);
  transition: border-color 0.2s, background-color 0.2s;
  padding: 6px;
}

.options-summary::-webkit-details-marker {
  display: none;
}

.options-summary:hover {
  border-color: var(--vp-c-brand);
  background-color: var(--vp-c-bg-soft);
}

.options-dropdown-content {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 50;
  width: max-content;
  box-shadow: var(--vp-shadow-3);
  border-radius: 8px;
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
}

.gantt-options-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.compact-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  cursor: pointer;
  user-select: none;
  line-height: 1;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
}

.legend-text {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overflow-item {
  position: relative;
  cursor: pointer;
}

.color-box {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.color-box.overflow-box {
  background-color: var(--vp-c-bg-mute);
  border: 1px solid var(--vp-c-border);
  color: var(--vp-c-text-2);
  font-size: 9px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-width: 16px;
  padding: 0 3px;
  height: 12px;
  box-sizing: border-box;
}

.sections-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  box-shadow: var(--vp-shadow-3);
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 100;
  min-width: 140px;
  white-space: nowrap;
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vp-c-text-1);
}

.color-box.section-color-0 { background-color: #b8cae6; border: 1px solid #98aed4; }
.color-box.section-color-1 { background-color: #e6c4b8; border: 1px solid #d4a698; }
.color-box.section-color-2 { background-color: #b8e6ca; border: 1px solid #98d4ae; }
.color-box.section-color-3 { background-color: #e6b8cc; border: 1px solid #d498b0; }
.color-box.section-color-4 { background-color: #cbd0f0; border: 1px solid #a8b0e0; }
.color-box.section-color-5 { background-color: #ebd8b0; border: 1px solid #dac090; }
.color-box.section-color-6 { background-color: #b0e4e0; border: 1px solid #90d0cc; }
.color-box.section-color-7 { background-color: #dcb8e6; border: 1px solid #c698d4; }
.color-box.section-color-8 { background-color: #d8e0b0; border: 1px solid #c0cb90; }
.color-box.section-color-default { background-color: var(--vp-c-brand-1); }

html.dark .color-box.section-color-0 { background-color: #2b3a52; border: 1px solid #3d506e; }
html.dark .color-box.section-color-1 { background-color: #52362b; border: 1px solid #6e4b3d; }
html.dark .color-box.section-color-2 { background-color: #2b5239; border: 1px solid #3d6e4f; }
html.dark .color-box.section-color-3 { background-color: #522b3b; border: 1px solid #6e3d51; }
html.dark .color-box.section-color-4 { background-color: #34385a; border: 1px solid #484d7a; }
html.dark .color-box.section-color-5 { background-color: #4e3f28; border: 1px solid #6a573a; }
html.dark .color-box.section-color-6 { background-color: #264d4a; border: 1px solid #386864; }
html.dark .color-box.section-color-7 { background-color: #462b52; border: 1px solid #603d6e; }
html.dark .color-box.section-color-8 { background-color: #424927; border: 1px solid #5b6539; }

.legend-item.active .color-box {
  background-color: var(--vp-c-brand-1);
}

.legend-item.passive .color-box {
  background-color: var(--vp-c-brand-soft);
  border: 1px solid var(--vp-c-brand-1);
}

.gantt-wrapper {
  display: flex;
  flex-direction: column;
  position: relative;
}

.gantt-axis {
  position: sticky;
  top: 48px;
  z-index: 20;
  background-color: var(--vp-c-bg);
  display: flex;
  height: 30px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--vp-c-border);
}

.track-label {
  position: sticky;
  left: 0;
  z-index: 10;
  width: 120px;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 13px;
  color: var(--vp-c-text-1);
  display: flex;
  align-items: center;
  padding-right: 12px;
  padding-left:12px;
  box-sizing: border-box;
  border-right: 1px solid var(--vp-c-border);
  background-color: var(--vp-c-bg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gantt-axis .track-label {
  z-index: 25;
}

.axis-label {
  color: var(--vp-c-text-3);
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
}

.track-content {
  flex-grow: 1;
  position: relative;
  height: 100%;
}

.axis-tick {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  transform: translateX(-50%);
  z-index: 2;
}

.tick-mark {
  height: 8px;
  width: 1px;
  background-color: var(--vp-c-text-3);
  margin: 0 auto;
}

.tick-label {
  font-size: 11px;
  color: var(--vp-c-text-2);
  margin-top: 4px;
  white-space: nowrap;
}

.axis-tick.is-first-tick .tick-label {
  transform: translateX(14px);
}

.axis-tick.is-last-tick .tick-label {
  transform: translateX(-14px);
}

.gantt-tracks {
  position: relative;
  display: flex;
  flex-direction: column;
}

.gantt-axis-gaps,
.gantt-tracks-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 1;
}

.gantt-tracks-overlay {
  left: 120px;
}

.visual-gap {
  position: absolute;
  top: 0;
  bottom: 0;
  background-color: var(--vp-c-bg-alt);
  border-left: 1px dashed var(--vp-c-border);
  border-right: 1px dashed var(--vp-c-border);
  opacity: 0.6;
}

.gap-pattern {
  width: 100%;
  height: 100%;
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    var(--vp-c-divider) 10px,
    var(--vp-c-divider) 11px
  );
}

.gantt-track {
  display: flex;
  position: relative;
  z-index: 2;
  height: 48px;
  min-height: 48px;
  border-bottom: 1px solid var(--vp-c-border);
  transition: height 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.gantt-track:hover {
  background-color: var(--vp-c-bg-soft);
}

.time-block {
  position: absolute;
  top: 8px;
  height: 32px;
  min-width: 22px;
  box-sizing: border-box;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  transition: transform 0.1s, box-shadow 0.1s, top 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  z-index: 2;
  border: 1px solid var(--vp-c-bg);
}

.time-block:hover {
  transform: translateY(-2px);
  box-shadow: var(--vp-shadow-1);
  z-index: 3;
}

.time-block.active {
  background-color: var(--vp-c-brand-1);
  color: white;
}

.time-block.passive {
  background-color: var(--vp-c-brand-soft);
  border: 1px solid var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  overflow: hidden;
}

.block-label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  padding: 0 8px;
}

.is-compact .block-label {
  pointer-events: none;
}

.time-block.active .block-label {
  position: absolute;
  left: 100%;
  color: var(--vp-c-text-1);
}

.time-block.active .block-label.label-inside {
  position: static;
  left: auto;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
}

.time-block.passive .block-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Gap Label */
.gap-label {
  position: absolute;
  top: 3px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  z-index: 26;
}

/* Assembly Icon */
.assembly-icon {
  margin-right: 4px;
  opacity: 0.8;
}

/* Temp Badge */
.temp-badge {
  display: inline-block;
  padding: 0px 4px;
  border-radius: 4px;
  margin-left: 4px;
  font-size: 10px;
  color: var(--item-temp-text);
  font-weight: bold;
  background: rgba(255, 255, 255, 0.6);
}
html.dark .temp-badge {
  background: rgba(0, 0, 0, 0.2);
}

/* Section Colors (overrides .active) */
.time-block.section-color-0 { background-color: #b8cae6; color: #1e2f4d; }
.time-block.section-color-1 { background-color: #e6c4b8; color: #4d261e; }
.time-block.section-color-2 { background-color: #b8e6ca; color: #1e4d2d; }
.time-block.section-color-3 { background-color: #e6b8cc; color: #4d1e31; }
.time-block.section-color-4 { background-color: #cbd0f0; color: #252a50; }
.time-block.section-color-5 { background-color: #ebd8b0; color: #4a3818; }
.time-block.section-color-6 { background-color: #b0e4e0; color: #184845; }
.time-block.section-color-7 { background-color: #dcb8e6; color: #3f1e4d; }
.time-block.section-color-8 { background-color: #d8e0b0; color: #3a4418; }
.time-block.section-color-default { background-color: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }

html.dark .time-block.section-color-0 { background-color: #2b3a52; color: #dce6f5; }
html.dark .time-block.section-color-1 { background-color: #52362b; color: #f5e4dc; }
html.dark .time-block.section-color-2 { background-color: #2b5239; color: #dcf5e6; }
html.dark .time-block.section-color-3 { background-color: #522b3b; color: #f5dce5; }
html.dark .time-block.section-color-4 { background-color: #34385a; color: #e1e3f8; }
html.dark .time-block.section-color-5 { background-color: #4e3f28; color: #f6ebd6; }
html.dark .time-block.section-color-6 { background-color: #264d4a; color: #d4f5f2; }
html.dark .time-block.section-color-7 { background-color: #462b52; color: #ebdcf5; }
html.dark .time-block.section-color-8 { background-color: #424927; color: #edf2d5; }

/* Fixed Custom Tooltip */
.gantt-tooltip-fixed {
  position: fixed;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  box-shadow: var(--vp-shadow-3);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--vp-c-text-1);
  width: max-content;
  max-width: 220px;
  pointer-events: none;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  animation: tooltipFadeIn 0.15s ease-out;
}

@keyframes tooltipFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tooltip-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-border);
  padding-bottom: 6px;
}

.time-badge {
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

.time-arrow {
  color: var(--vp-c-text-3);
}

.time-duration {
  margin-left: auto;
  font-weight: 600;
}

.tooltip-text {
  line-height: 1.4;
  white-space: pre-wrap;
}

/* Time Mode Selector */
.time-mode-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.time-select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.time-select {
  appearance: none;
  -webkit-appearance: none;
  background-color: var(--vp-c-bg-mute);
  border: 1px solid var(--vp-c-border);
  color: var(--vp-c-text-1);
  padding: 6px 32px 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  width: 100%;
}

.select-chevron {
  position: absolute;
  right: 8px;
  pointer-events: none;
  color: var(--vp-c-text-2);
}

.target-time-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.target-time-input {
  background-color: var(--vp-c-bg-mute);
  border: 1px solid var(--vp-c-border);
  color: var(--vp-c-text-1);
  padding: 4px 6px;
  border-radius: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  width: 110px;
}

/* Visual Gap styles */
.gantt-marker {
  position: absolute;
  top: 0;
  height: 100%;
  width: 2px;
  z-index: 15;
}

.start-marker {
  transform: translateX(-1px);
}

.start-marker .marker-line {
  width: 2px;
  height: 100%;
  background-color: var(--vp-c-green-1);
  opacity: 0.5;
}

.end-marker {
  transform: translateX(-1px);
}

.end-marker .marker-line {
  width: 2px;
  height: 100%;
  background-color: var(--vp-c-red-1);
  opacity: 0.5;
}

</style>
