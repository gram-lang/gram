const CATEGORIES: Record<string, string[]> = {
  fr: [
    'Légumes',
    'Fruits',
    'Viandes',
    'Poissons & Fruits de mer',
    'Crémerie',
    'Céréales',
    'Légumineuses',
    'Noix & Graines',
    'Huiles',
    'Herbes',
    'Épices',
    'Condiments',
    'Sucres',
    'Boissons',
    'Autres',
  ],
  en: [
    'Vegetables',
    'Fruits',
    'Meat',
    'Seafood',
    'Dairy',
    'Grains',
    'Legumes',
    'Nuts',
    'Oils',
    'Herbs',
    'Spices',
    'Condiments',
    'Sugars',
    'Beverages',
    'Other',
  ],
}

export function getDefaultCategories(lang = 'en'): string[] {
  return CATEGORIES[lang] ?? CATEGORIES.en!
}
