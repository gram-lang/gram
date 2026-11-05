<script setup lang="ts">
/*
 * The one dropdown of the playground: a native <select>, styled like the
 * site's language and theme selectors (`starlight-lang-select`,
 * `gram-theme-select` in global.css). Native, so it works with the keyboard,
 * screen readers and the phone's own picker with nothing to maintain. Only its
 * height changes with where it sits (`size`).
 */

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface SelectGroup {
	label: string;
	options: SelectOption[];
}

const props = withDefaults(
	defineProps<{
		modelValue: string;
		options?: SelectOption[];
		/** Options under headings (`<optgroup>`), after `options`. */
		groups?: SelectGroup[];
		/** Shown while `modelValue` matches no option; it cannot be chosen. */
		placeholder?: string;
		/** The name read by screen readers, when no visible label names it. */
		ariaLabel?: string;
		id?: string;
		disabled?: boolean;
		/** Its height: `sm` (28px) in the output header, `md` (34px) in a form, `lg` (40px) next to the main toolbar's buttons. */
		size?: "sm" | "md" | "lg";
		/** Takes the width of its container, as a form field. */
		block?: boolean;
		/** Shows only the icon slot: the value is read in the list, not on the button. */
		iconOnly?: boolean;
		title?: string;
		/** No frame: for a bar that is already drawn, where lines add up. */
		bare?: boolean;
	}>(),
	{ size: "md" },
);

const emit = defineEmits<{
	"update:modelValue": [value: string];
	change: [value: string];
}>();

// biome-ignore lint/correctness/noUnusedVariables: onChange is used in the template block below, which Biome's Vue support doesn't see.
function onChange(e: Event) {
	const select = e.target as HTMLSelectElement;
	const value = select.value;
	emit("update:modelValue", value);
	emit("change", value);
}

// biome-ignore lint/correctness/noUnusedVariables: matches is used in the template block below, which Biome's Vue support doesn't see.
const matches = () =>
	[
		...(props.options ?? []),
		...(props.groups ?? []).flatMap((g) => g.options),
	].some((option) => option.value === props.modelValue);
</script>

<template>
  <label
    class="gram-select"
    :class="[`is-${size}`, { 'is-bare': bare, 'is-block': block, 'is-icon-only': iconOnly, 'has-icon': !!$slots.icon, 'is-disabled': disabled }]"
    :title="title"
  >
    <span v-if="ariaLabel" class="sr-only">{{ ariaLabel }}</span>
    <span v-if="$slots.icon" class="gram-select-icon" aria-hidden="true"><slot name="icon" /></span>
    <select :id="id" :value="modelValue" :disabled="disabled" autocomplete="off" @change="onChange">
      <option v-if="placeholder !== undefined" value="" disabled :selected="!matches()">{{ placeholder }}</option>
      <option
        v-for="option in options ?? []"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >{{ option.label }}</option>
      <optgroup v-for="group in groups ?? []" :key="group.label" :label="group.label">
        <option
          v-for="option in group.options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >{{ option.label }}</option>
      </optgroup>
    </select>
    <svg v-if="!iconOnly" class="gram-select-caret" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 9.17a1 1 0 0 0-1.41 0L12 12.71 8.46 9.17a1 1 0 1 0-1.41 1.42l4.24 4.24a1.002 1.002 0 0 0 1.42 0L17 10.59a1.002 1.002 0 0 0 0-1.42Z" /></svg>
  </label>
</template>

<style scoped>
/* The same box as the site's language and theme selectors (global.css). */
.gram-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--sl-color-border);
  color: var(--sl-color-gray-3);
  background-color: transparent;
}

.gram-select.is-sm {
  height: 28px;
}

.gram-select.is-md {
  height: 34px;
}

.gram-select.is-lg {
  height: 40px;
}

.gram-select:hover {
  border-color: var(--sl-color-gray-4);
  color: var(--sl-color-white);
}

.gram-select:has(select:focus-visible) {
  outline: 2px solid var(--sl-color-accent);
  outline-offset: 1px;
}

.gram-select.is-bare {
  border-color: transparent;
}

.gram-select.is-bare:hover {
  border-color: transparent;
  background-color: var(--sl-color-gray-6);
}

.gram-select.is-block {
  display: flex;
  width: 100%;
}

.gram-select.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}

select {
  appearance: none;
  min-width: 0;
  width: 100%;
  margin: 0;
  border: 0;
  border-radius: 0;
  outline: none;
  background-color: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.85rem;
  line-height: 1.2;
  height: 100%;
  padding-block: 0;
  padding-inline: 0.5rem calc(1.25rem + 0.5rem);
  text-overflow: ellipsis;
  cursor: pointer;
}

.is-sm select {
  font-size: 0.8rem;
}

.has-icon select {
  padding-inline-start: calc(0.5rem + 14px + 0.4rem);
}

option,
optgroup {
  background-color: var(--sl-color-bg-nav);
  color: var(--sl-color-gray-1);
}

.gram-select-icon {
  position: absolute;
  inset-inline-start: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  pointer-events: none;
}

.gram-select-caret {
  position: absolute;
  inset-inline-end: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  pointer-events: none;
}

/* Only the icon on the button; the list still reads the options. */
.is-icon-only select {
  width: 28px;
  padding: 0;
  color: transparent;
}

.is-icon-only .gram-select-icon {
  inset-inline-start: 50%;
  transform: translate(-50%, -50%);
}

.is-icon-only option,
.is-icon-only optgroup {
  color: var(--sl-color-gray-1);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
