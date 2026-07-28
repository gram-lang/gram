<script setup lang="ts">
import {
	ref,
	computed,
	onMounted,
	watch,
	inject,
	type Ref,
	onBeforeUnmount,
} from "vue";
import { getDictionary } from "@gram-lang/i18n";
import {
	toGanttHTML,
	attachGanttInteractivity,
	type GanttInteractivityHandle,
} from "@gram-lang/renderer";

const lang = inject<Ref<"en" | "fr">>("lang")!;

const props = defineProps<{
	jsonData: any;
}>();

const container = ref<HTMLElement | null>(null);
let handle: GanttInteractivityHandle | null = null;

const html = computed(() => toGanttHTML(props.jsonData, { lang: lang.value }));

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
