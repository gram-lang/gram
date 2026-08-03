import { computed, inject, type Ref } from "vue";
import { getDictionary } from "@gram-lang/i18n";

export function useI18n() {
	const lang = inject<Ref<"en" | "fr">>("lang")!;
	const t = computed(() => getDictionary(lang.value));
	return { lang, t };
}
