<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from "vue";
import { useI18n } from "./useI18n";
import {
	toGanttHTML,
	attachGanttInteractivity,
	type GanttInteractivityHandle,
} from "@gram-lang/renderer";
import type { MiseEnPlaceMode, RestChoice } from "@gram-lang/kitchen";
import type { ProjectedPlan } from "@gram-lang/scheduler";

const { lang } = useI18n();

const props = defineProps<{
	jsonData: any;
	schedule?: MiseEnPlaceMode;
	rests?: RestChoice;
	projection?: ProjectedPlan;
}>();

const container = ref<HTMLElement | null>(null);
let handle: GanttInteractivityHandle | null = null;

const html = computed(() =>
	toGanttHTML(props.jsonData, {
		lang: lang.value,
		miseEnPlace: props.schedule,
		rests: props.rests,
		projection: props.projection,
	}),
);

function render() {
	if (!container.value) return;
	const preserved = handle?.getOptions();
	container.value.innerHTML = html.value;
	if (!handle) {
		handle = attachGanttInteractivity(
			container.value,
			preserved ?? {
				timeMode: "forward",
				targetTime: "",
				isCompactMode: false,
			},
		);
	} else {
		handle.setOptions(preserved!);
	}
}

onMounted(render);
watch(html, render);
onBeforeUnmount(() => handle?.dispose());
</script>

<template>
  <div ref="container" class="gram-gantt-mount"></div>
</template>

<style scoped>
.gram-gantt-mount {
  position: absolute;
  inset: 0;
  overflow: auto;
}
</style>
