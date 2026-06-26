const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French',
  en: 'English',
  de: 'German',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ja: 'Japanese',
  zh: 'Chinese',
}

export function getAiLanguageInstruction(lang = 'en'): string {
  const name = LANGUAGE_NAMES[lang] ?? lang
  return `Respond exclusively in ${name}. All generated text — including category names, tags, ingredient names, and recipe content — must be in ${name}.`
}
