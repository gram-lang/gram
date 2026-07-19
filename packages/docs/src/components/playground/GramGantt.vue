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

	for (const section of props.jsonData.sections) {
		for (const step of section.steps) {
			if (step.type === "step" && step.timings) {
				if (step.timings.activeDuration > 0) {
					activePeriods.push({
						start: step.timings.start + prepTime,
						end: step.timings.end + prepTime,
					});
					overallMaxRealTime = Math.max(overallMaxRealTime, step.timings.end + prepTime);
				}
				if (step.backgroundTasks) {
					for (const task of step.backgroundTasks) {
						overallMaxRealTime = Math.max(overallMaxRealTime, step.timings.start + prepTime + task.startOffset + task.duration);
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

	const merged: { start: number; end: number }[] = [];
	for (const period of activePeriods) {
		if (merged.length === 0) {
			merged.push({ ...period });
		} else {
			const last = merged[merged.length - 1];
			if (period.start <= last.end) {
				last.end = Math.max(last.end, period.end);
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
	if (!props.jsonData?.sections) return { tracks: [], totalVirtualTime: 0, maxRealTime: 0 };

	const prepTime = props.jsonData.metrics?.preparationTime || 0;
	const cookTrack: Track = { id: "cook", title: t.value.playground.views.gantt_cook || "Cook", blocks: [], type: "active" };
	const passiveTracksMap = new Map<string, Track>();

	let maxRealTime = 0;
	let activeStepIndex = 0;

	if (prepTime > 0) {
		const label = t.value.renderer?.prepTime || "Prep";
		const fitsInside = (prepTime * 12) >= (label.length * 7 + 36);
		
		cookTrack.blocks.push({
			id: "cook_prep",
			start: 0,
			end: prepTime,
			duration: prepTime,
			label: label,
			tooltip: t.value.renderer?.prepTimeTooltip || "Mise en place",
			verticalIndex: activeStepIndex++,
			fitsInside
		});
		maxRealTime = prepTime;
	}

	// Helper to stringify step content for the tooltip
	const serializeContent = (content: any[]) => {
		if (!content || !Array.isArray(content)) return "";
		
		const renderContext = {
			registry: props.jsonData.registry,
			lang: lang.value
		};

		const joined = joinStepTokens(
			content,
			(c: any) => {
				if (typeof c === 'string') return c;
				if (c && typeof c === 'object') {
					const md = formatElement(c, "md", renderContext);
					// Strip basic markdown formatting from tooltip text (safe unicode replace)
					return md.replace(/[*_👉]/gu, '');
				}
				return '';
			},
			(c: any) => typeof c !== "string" && c.type !== "comment"
		);

		return joined.replace(/\s+/g, ' ').trim();
	};

	let sectionIndex = 0;
	const isSingleUnnamedSection = props.jsonData.sections.length === 1 && !props.jsonData.sections[0].title;

	for (const section of props.jsonData.sections) {
		const computedSectionIndex = isSingleUnnamedSection ? 'default' : (sectionIndex % 5);

		for (const step of section.steps) {
			if (step.type === "step" && step.timings) {
				let temperature: string | undefined = undefined;
				let isAssembly = false;
				for (const c of step.content) {
					if (c && typeof c === "object") {
						if (c.type === "temperature") {
							temperature = c.text || (c.quantity ? `${typeof c.quantity === 'object' ? c.quantity.value : c.quantity}${c.unit || 'C'}` : undefined);
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
					const label = step.action || "Cook";
					const fitsInside = (step.timings.activeDuration * 12) >= (label.length * 7 + 36);

					cookTrack.blocks.push({
						id: `cook_${blockStart}`,
						start: blockStart,
						end: blockEnd,
						duration: step.timings.activeDuration,
						label: label,
						tooltip: fullText.length > 100 ? fullText.substring(0, 100) + "..." : fullText,
						sectionIndex: computedSectionIndex,
						isAssembly,
						verticalIndex: activeStepIndex++,
						fitsInside,
						temperature
					});
					maxRealTime = Math.max(maxRealTime, blockEnd);
				}

				// Passive blocks
				if (step.backgroundTasks) {
					for (const task of step.backgroundTasks) {
						const trackName = task.name || (t.value.playground.views.gantt_timer || "Timer");
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

// Format time (minutes to HH:MM)
function formatTime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.floor(minutes % 60);
	if (h > 0) {
		return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
	}
	return `${m}m`;
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
			label: formatTime(t),
		});
	}
	
	// Add final tick if it doesn't align
	if (maxT % interval !== 0 && maxT > 0) {
		let inGap = false;
		for (const gap of gaps.value) {
			if (maxT > gap.start && maxT < gap.end) {
				inGap = true;
				break;
			}
		}
		if (!inGap) {
			ticks.push({
				realTime: maxT,
				virtualPercent: 100,
				label: formatTime(maxT),
			});
		}
	}

	return ticks;
});

// Calculate visual gaps to draw zig-zags
const visualGaps = computed(() => {
	return gaps.value.map(g => {
		const vStart = getVirtualTime(g.start);
		const vEnd = getVirtualTime(g.end);
		const skipped = g.end - g.start;
		return {
			leftPercent: (vStart / totalVirtualTime.value) * 100,
			widthPercent: ((vEnd - vStart) / totalVirtualTime.value) * 100,
			label: `+ ${formatTime(skipped)}`,
		};
	});
});

</script>

<template>
  <div class="gram-gantt-container" v-if="tracks.length > 0 && tracksData.maxRealTime > 0">
    <div class="gantt-header">
      <div class="gantt-legend">
        <span class="legend-item active"><span class="color-box"></span> {{ t.playground.views.gantt_active || 'Active Task' }}</span>
        <span class="legend-item passive"><span class="color-box"></span> {{ t.playground.views.gantt_passive || 'Background Task' }}</span>
      </div>
      <div class="gantt-controls">
        <label class="compact-toggle">
          <input type="checkbox" v-model="isCompactMode">
          {{ t.playground.views.gantt_compact || 'Vue Compacte' }}
        </label>
      </div>
    </div>

    <div class="gantt-wrapper" :class="{ 'is-compact': isCompactMode }" :style="{ minWidth: `max(600px, ${totalVirtualTime * 12}px)` }">
      <!-- Axis -->
      <div class="gantt-axis">
        <div class="track-label axis-label">{{ t.playground.views.gantt_time || 'Time' }}</div>
        <div class="track-content">
          <div 
            v-for="tick in timeTicks" 
            :key="tick.realTime"
            class="axis-tick"
            :style="{ left: `${tick.virtualPercent}%` }"
          >
            <div class="tick-mark"></div>
            <div class="tick-label">{{ tick.label }}</div>
          </div>
        </div>
      </div>

      <div class="gantt-tracks">
        <!-- Visual Gap Overlays -->
        <div class="gantt-tracks-overlay">
          <div 
            v-for="(gap, i) in visualGaps" 
            :key="'gap_'+i" 
            class="visual-gap"
            :style="{ left: `${gap.leftPercent}%`, width: `${gap.widthPercent}%` }"
            title="Time compressed (idle period)"
          >
            <div class="gap-pattern"></div>
            <div class="gap-label">🕒 {{ gap.label }}</div>
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
                <span v-if="block.isAssembly" class="assembly-icon" title="Assembly / Dependencies">↳</span>
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
          <span class="time-badge">{{ formatTime(tooltipData.start) }}</span>
          <span class="time-arrow">→</span>
          <span class="time-badge">{{ formatTime(tooltipData.end) }}</span>
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
  justify-content: flex-start;
  gap: 24px;
  align-items: center;
  padding: 0 16px;
  background-color: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
  justify-content: space-between;
}

.gantt-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.gantt-controls {
  display: flex;
  align-items: center;
}

.compact-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  cursor: pointer;
  user-select: none;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-box {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

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

.axis-tick:first-child .tick-label {
  transform: translateX(12px);
}

.axis-tick:last-child .tick-label {
  transform: translateX(-12px);
}

.gantt-tracks {
  position: relative;
  display: flex;
  flex-direction: column;
}

.gantt-tracks-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 120px;
  right: 0;
  pointer-events: none;
  z-index: 1;
}

.visual-gap {
  position: absolute;
  top: 0;
  bottom: 0;
  background-color: var(--vp-c-bg-alt);
  border-left: 1px dashed var(--vp-c-border);
  border-right: 1px dashed var(--vp-c-border);
  opacity: 0.5;
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
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  transition: transform 0.1s, box-shadow 0.1s, top 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  z-index: 2;
  border:1px solid  var(--vp-c-bg);
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
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--vp-c-bg);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border);
  box-shadow: var(--vp-shadow-1);
  white-space: nowrap;
  z-index: 10;
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
.time-block.section-color-0 { background-color: #a8c8f9; color: #0a2558; }
.time-block.section-color-1 { background-color: #f9cca8; color: #582a0a; }
.time-block.section-color-2 { background-color: #a8f9c8; color: #0a5825; }
.time-block.section-color-3 { background-color: #f9a8c8; color: #580a25; }
.time-block.section-color-4 { background-color: #c8a8f9; color: #250a58; }
.time-block.section-color-default { background-color: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }

html.dark .time-block.section-color-0 { background-color: #254b8a; color: #d6e4fc; }
html.dark .time-block.section-color-1 { background-color: #8a5325; color: #fce6d6; }
html.dark .time-block.section-color-2 { background-color: #258a4b; color: #d6fce4; }
html.dark .time-block.section-color-3 { background-color: #8a254b; color: #fcd6e4; }
html.dark .time-block.section-color-4 { background-color: #4b258a; color: #e4d6fc; }

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
</style>
