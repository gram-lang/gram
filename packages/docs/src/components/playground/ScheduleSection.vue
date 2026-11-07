<script setup lang="ts">
import { computed } from "vue";
import type { MiseEnPlaceMode, RestChoice } from "@gram-lang/kitchen";
import { VIEW_SETTINGS } from "@gram-lang/renderer";
import { WEEKDAYS, type Weekday } from "@gram-lang/scheduler";
// biome-ignore lint/correctness/noUnusedImports: OptionsSection is used as a component in the <template> block below
import OptionsSection from "./OptionsSection.vue";
// biome-ignore lint/correctness/noUnusedImports: PlaygroundTooltip is used in the <template> block below
import PlaygroundTooltip from "./PlaygroundTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the template block below
import GramSelect from "./GramSelect.vue";
import {
	type PlanSettings,
	// biome-ignore lint/correctness/noUnusedImports: used in the <template> block below, which Biome's Vue support doesn't see.
	dayEnabled,
	dayFrom,
	dayTo,
	timeZoneChoices,
	weekdayNames,
	withCustomWeekdays,
	withDayTime,
	withDayToggled,
	withPlanField,
} from "./planSettings";
import {
	type ServeSuggestions,
	// biome-ignore lint/correctness/noUnusedImports: used in the <template> block below, which Biome's Vue support doesn't see.
	earliestLabel,
	earliestTooltip,
	isScheduleModified,
	otherCandidates,
	rejectedTooltip,
	scheduleBadgeTitle,
} from "./scheduleSection";
import { settingChoices } from "./settingLabels";
import { useI18n } from "./useI18n";

/** "Schedule & Service": the mise en place, the rests, and the plan on the calendar. */
const props = defineProps<{
	open: boolean;
	plan?: PlanSettings;
	schedule?: MiseEnPlaceMode;
	rests?: RestChoice;
	planError?: string;
	serveSuggestions?: ServeSuggestions | null;
}>();

const emit = defineEmits<{
	toggle: [];
	"update:schedule": [schedule: MiseEnPlaceMode];
	"update:rests": [rests: RestChoice];
	"update:plan": [plan: PlanSettings];
	"clear-plan": [];
	/** Show the run sheet: where most of these settings show. */
	"show-run-sheet": [];
}>();

const { lang, t } = useI18n();

// biome-ignore lint/correctness/noUnusedVariables: scheduleOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const scheduleOptions = computed(() => settingChoices("miseEnPlace", t.value));
// biome-ignore lint/correctness/noUnusedVariables: restsOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const restsOptions = computed(() => settingChoices("rests", t.value));
// biome-ignore lint/correctness/noUnusedVariables: timeZoneOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const timeZoneOptions = computed(() => timeZoneChoices(props.plan?.timeZone));
// biome-ignore lint/correctness/noUnusedVariables: days is used in the <template> block below, which Biome's Vue support doesn't see.
const days: readonly Weekday[] = WEEKDAYS;
// biome-ignore lint/correctness/noUnusedVariables: weekdays is used in the <template> block below, which Biome's Vue support doesn't see.
const weekdays = computed(() => weekdayNames(lang.value));

const state = computed(() => ({
	plan: props.plan,
	schedule: props.schedule,
	rests: props.rests,
}));
// biome-ignore lint/correctness/noUnusedVariables: modified is used in the <template> block below, which Biome's Vue support doesn't see.
const modified = computed(() => isScheduleModified(state.value));
// biome-ignore lint/correctness/noUnusedVariables: badgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const badgeTitle = computed(() =>
	scheduleBadgeTitle(state.value, t.value, lang.value),
);

const DEFAULT_SCHEDULE = VIEW_SETTINGS.miseEnPlace.default;
const DEFAULT_RESTS = VIEW_SETTINGS.rests.default;

// biome-ignore lint/correctness/noUnusedVariables: used in the <template> block below, which Biome's Vue support doesn't see.
function updatePlanField(field: keyof PlanSettings, value: string) {
	if (!props.plan) return;
	emit("update:plan", withPlanField(props.plan, field, value));
}

// biome-ignore lint/correctness/noUnusedVariables: used in the <template> block below, which Biome's Vue support doesn't see.
function toggleCustomWeekdays(e: Event) {
	if (!props.plan) return;
	emit(
		"update:plan",
		withCustomWeekdays(props.plan, (e.target as HTMLInputElement).checked),
	);
}

// biome-ignore lint/correctness/noUnusedVariables: used in the <template> block below, which Biome's Vue support doesn't see.
function toggleDayEnabled(day: Weekday) {
	if (!props.plan) return;
	emit("update:plan", withDayToggled(props.plan, day));
}

// biome-ignore lint/correctness/noUnusedVariables: used in the <template> block below, which Biome's Vue support doesn't see.
function updateDayTime(day: Weekday, field: "from" | "to", value: string) {
	if (!props.plan) return;
	emit("update:plan", withDayTime(props.plan, day, field, value));
}

// biome-ignore lint/correctness/noUnusedVariables: resetSection is used in the <template> block below, which Biome's Vue support doesn't see.
function resetSection() {
	emit("update:schedule", DEFAULT_SCHEDULE);
	emit("update:rests", DEFAULT_RESTS);
	emit("clear-plan");
}
</script>

<template>
  <OptionsSection
    :title="t.playground.sections.schedule"
    :open="open"
    :modified="modified"
    :badge-title="badgeTitle"
    @toggle="emit('toggle')"
    @reset="resetSection"
  >
    <p class="studio-section-note">
      <svg class="note-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span>
        {{ t.playground.help.scheduleNote }}
        <button type="button" class="studio-note-link" @click="emit('show-run-sheet')">{{ t.playground.help.scheduleNoteLink }}</button>
      </span>
    </p>

    <div class="studio-field">
      <div class="studio-label-row">
        <label class="studio-label">{{ t.renderer.scheduleLabel }}</label>
        <PlaygroundTooltip :text="t.playground.help.schedule" />
      </div>
      <GramSelect
        block
        :model-value="props.schedule || 'perSection'"
        :options="scheduleOptions"
        :aria-label="t.renderer.scheduleLabel"
        @update:model-value="(value: string) => emit('update:schedule', value as MiseEnPlaceMode)"
      />
    </div>

    <div class="studio-field">
      <div class="studio-label-row">
        <label class="studio-label">{{ t.renderer.restsLabel }}</label>
        <PlaygroundTooltip :text="t.playground.help.rests" />
      </div>
      <GramSelect
        block
        :model-value="props.rests || 'shortest'"
        :options="restsOptions"
        :aria-label="t.renderer.restsLabel"
        @update:model-value="(value: string) => emit('update:rests', value as RestChoice)"
      />
    </div>

    <!-- Heure de service -->
    <div class="studio-field serve-field-group">
      <div class="studio-label-row">
        <label class="studio-label">{{ t.playground.views.planServeAt }}</label>
        <PlaygroundTooltip :text="t.playground.help.serveAt" />
        <button
          v-if="props.plan?.serveAt"
          type="button"
          class="clear-serve-btn"
          @click="updatePlanField('serveAt', '')"
          :title="lang === 'fr' ? 'Effacer la date de service' : 'Clear serve time'"
        >
          {{ lang === 'fr' ? 'Effacer' : 'Clear' }}
        </button>
      </div>

      <!-- Raccourcis de service (Au plus tôt + Suggestions + Info créneaux rejetés) -->
      <div v-if="props.serveSuggestions" class="serve-shortcuts-container">
        <div
          v-if="props.serveSuggestions.candidates.length > 0 || props.serveSuggestions.earliest"
          class="serve-shortcuts-row"
        >
          <!-- Au plus tôt -->
          <button
            v-if="props.serveSuggestions.earliest"
            type="button"
            class="serve-pill earliest-pill"
            :class="{ 'is-selected': props.plan?.serveAt === props.serveSuggestions.earliest.serveAt }"
            :title="earliestTooltip(props.serveSuggestions)"
            @click="updatePlanField('serveAt', props.serveSuggestions.earliest.serveAt)"
          >
            <svg
              class="pill-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span class="pill-text">{{ earliestLabel(t, props.serveSuggestions.earliest.label) }}</span>
          </button>

          <!-- Suggestions candidates -->
          <button
            v-for="c in otherCandidates(props.serveSuggestions)"
            :key="c.serveAt"
            type="button"
            class="serve-pill"
            :class="{ 'is-selected': props.plan?.serveAt === c.serveAt }"
            :title="c.title"
            @click="updatePlanField('serveAt', c.serveAt)"
          >
            {{ c.label }}
          </button>

          <!-- Pourquoi pas les autres créneaux ? -->
          <div
            v-if="props.serveSuggestions.rejected.length > 0"
            class="rejected-info-wrapper"
          >
            <PlaygroundTooltip
              :text="rejectedTooltip(props.serveSuggestions, t)"
              :aria-label="lang === 'fr' ? 'Pourquoi pas les autres créneaux ?' : 'Why not other slots?'"
            >
              <span class="rejected-chip">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="rejected-chip-icon"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>{{ lang === 'fr' ? 'Autres créneaux' : 'Other slots' }}</span>
              </span>
            </PlaygroundTooltip>
          </div>
        </div>
        <p v-else class="serve-none">{{ t.playground.views.serveWhenNone }}</p>
      </div>

      <input
        class="studio-input"
        type="datetime-local"
        :value="props.plan?.serveAt || ''"
        @input="updatePlanField('serveAt', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="studio-field">
      <div class="studio-label-row">
        <label class="studio-label">{{ t.playground.views.planTimeZone }}</label>
        <PlaygroundTooltip :text="t.playground.help.timeZone" />
      </div>
      <GramSelect
        block
        :model-value="props.plan?.timeZone || 'UTC'"
        :options="timeZoneOptions.map((zone) => ({ value: zone, label: zone }))"
        :aria-label="t.playground.views.planTimeZone"
        @update:model-value="(value: string) => updatePlanField('timeZone', value)"
      />
    </div>

    <!-- Disponibilités -->
    <div class="studio-field">
      <div class="studio-label-row">
        <label class="studio-label">{{ lang === 'fr' ? 'Disponibilité quotidienne' : (t.playground.views.planAvailableFrom + ' / ' + t.playground.views.planAvailableTo) }}</label>
        <PlaygroundTooltip :text="t.playground.help.availability" />
      </div>
      <div class="studio-time-range">
        <input
          class="studio-input"
          type="time"
          :value="props.plan?.from || '08:00'"
          @input="updatePlanField('from', ($event.target as HTMLInputElement).value)"
        />
        <span class="range-separator">→</span>
        <input
          class="studio-input"
          type="time"
          :value="props.plan?.to || '22:00'"
          @input="updatePlanField('to', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Option horaires spécifiques par jour -->
      <label class="custom-weekdays-toggle">
        <input
          type="checkbox"
          :checked="Boolean(props.plan?.customWeekdays)"
          @change="toggleCustomWeekdays"
        />
        <span>{{ lang === 'fr' ? 'Horaires spécifiques par jour' : 'Specific hours by day of the week' }}</span>
      </label>

      <!-- Grille des 7 jours si activée -->
      <div v-if="props.plan?.customWeekdays" class="weekdays-grid">
        <div
          v-for="day in days"
          :key="day"
          class="weekday-row"
          :class="{ 'is-disabled': !dayEnabled(props.plan, day) }"
        >
          <div class="weekday-row-top">
            <label class="weekday-name-label">
              <input
                type="checkbox"
                :checked="dayEnabled(props.plan, day)"
                @change="toggleDayEnabled(day)"
              />
              <span class="weekday-name">{{ weekdays[day] }}</span>
            </label>
            <span v-if="!dayEnabled(props.plan, day)" class="weekday-status-closed">
              {{ lang === 'fr' ? 'Indisponible' : 'Unavailable' }}
            </span>
          </div>

          <div v-if="dayEnabled(props.plan, day)" class="weekday-time-inputs">
            <input
              class="studio-input studio-input-compact"
              type="time"
              :value="dayFrom(props.plan, day)"
              @input="updateDayTime(day, 'from', ($event.target as HTMLInputElement).value)"
            />
            <span class="range-separator">→</span>
            <input
              class="studio-input studio-input-compact"
              type="time"
              :value="dayTo(props.plan, day)"
              @input="updateDayTime(day, 'to', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>
    </div>

    <p v-if="props.planError" class="plan-error" role="alert">
      {{ t.playground.views.planInvalid.replace('{message}', props.planError) }}
    </p>
  </OptionsSection>
</template>

<style scoped src="./optionsFields.css"></style>

<style scoped>
.studio-note-link {
  display: inline;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: var(--sl-color-text-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.studio-note-link:hover {
  color: var(--sl-color-white);
}

.studio-note-link:focus-visible {
  outline: 2px solid var(--sl-color-accent);
  outline-offset: 2px;
}

.studio-time-range {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.studio-time-range .studio-input {
  flex: 1;
  min-width: 0;
}

.range-separator {
  color: var(--sl-color-gray-3);
  font-size: 12px;
}

.clear-serve-btn {
  background: transparent;
  border: none;
  color: var(--sl-color-gray-3);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  margin-left: auto;
  border-radius: 2px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.clear-serve-btn:hover {
  color: var(--sl-color-accent-high);
}

.serve-field-group {
  gap: 8px;
}

.serve-shortcuts-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.serve-shortcuts-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.serve-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.serve-pill {
  border: 1px solid var(--sl-color-gray-5);
  background: var(--sl-color-bg-nav);
  color: var(--sl-color-text);
  padding: 3px 6px;
  font-size: 12px;
  cursor: pointer;
}

.serve-pill:hover {
  border-color: var(--sl-color-gray-3);
}

.serve-pill.is-selected {
  border-color: var(--sl-color-accent);
  color: #1a1613;
  background-color: var(--sl-color-accent);
  font-weight: 600; 
}

.earliest-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background-color: var(--sl-color-bg-nav);
  border: 1px solid var(--sl-color-gray-5);
  color: var(--sl-color-text);
  font-weight: 500;
}

.earliest-pill .pill-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--sl-color-accent);
}

.earliest-pill.is-selected .pill-icon {
  color: currentColor;
}

.earliest-pill:hover {
  border-color: var(--sl-color-gray-3);
  color: var(--sl-color-text);
}

.earliest-pill.is-selected {
  border-color: var(--sl-color-accent);
  color: #1a1613;
  background-color: var(--sl-color-accent);
  font-weight: 600; 
}

.rejected-info-wrapper {
  display: inline-flex;
  align-items: center;
}

.rejected-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px dashed var(--sl-color-gray-5);
  background-color: var(--sl-color-bg-nav);
  color: var(--sl-color-gray-3);
  padding: 3px 6px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.rejected-chip-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.rejected-chip:hover,
.playground-tooltip-trigger:focus-visible .rejected-chip,
.playground-tooltip-trigger.is-active .rejected-chip {
  border-color: var(--sl-color-gray-3);
  color: var(--sl-color-text);
  background-color: var(--sl-color-gray-7);
}

.serve-none {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--sl-color-gray-2);
}

.custom-weekdays-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--sl-color-gray-2);
  cursor: pointer;
  margin-top: 4px;
  user-select: none;
}

.weekdays-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.weekday-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background-color: var(--sl-color-gray-7);
  border: 1px solid var(--sl-color-gray-6);
  border-radius: 4px;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.weekday-row.is-disabled {
  opacity: 0.55;
  background-color: transparent;
  border-color: var(--sl-color-border);
}

.weekday-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.weekday-name-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--sl-color-text);
}

.weekday-name {
  color: var(--sl-color-text);
}

.weekday-status-closed {
  font-size: 11.5px;
  color: var(--sl-color-gray-3);
  font-style: italic;
}

.weekday-time-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.weekday-time-inputs .studio-input-compact {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 4px 6px;
  font-size: 12px;
  text-align: center;
}

.plan-error {
  margin: 0;
  font-size: 12px;
  color: var(--sl-color-red-high);
  line-height: 1.4;
}
</style>
