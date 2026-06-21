import { readFile } from 'node:fs/promises'
import { parse as parseIngredientLib } from 'recipe-ingredient-parser-v3'
import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import { GramCLIError, ExitCode } from '../errors'
import { matchInText } from '../core/fuzzy'
import type { ImportResult } from '../types'

// ── Unicode fraction normalization ────────────────────────────────────────────

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3,
  '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

function normalizeUnicodeFractions(s: string): string {
  return s.replace(
    /[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g,
    ch => String(UNICODE_FRACTIONS[ch] ?? ch),
  )
}

// ── ISO duration ─────────────────────────────────────────────────────────────

function parseIsoDuration(iso: string): number {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return 0
  return (parseInt(m[1] ?? '0') * 1440) + (parseInt(m[2] ?? '0') * 60) + parseInt(m[3] ?? '0')
}

// ── Slug ─────────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ── Ingredient parsing ────────────────────────────────────────────────────────

const QTY_UNITS = [
  'g', 'ml', 'kg', 'l', 'cl', 'dl',
  'tbsp', 'tsp', 'cup', 'cups', 'oz', 'lb',
  'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons',
  'ounce', 'ounces', 'pound', 'pounds',
]
const UNIT_PATTERN = QTY_UNITS.map(u => u.replace(/s$/, 's?')).join('|')
const ING_RE = new RegExp(
  `^(\\d+(?:[,./]\\d+)?(?:\\s*-\\s*\\d+(?:[,./]\\d+)?)?)\\s*(${UNIT_PATTERN})\\.?\\s+(.+)$`,
  'i',
)
const ING_RE_NOUNIT = /^(\d+(?:[,./]\d+)?)\s+(.+)$/

interface ParsedIngredient {
  slug: string
  name: string
  qty: string
  unit: string
  raw: string
  unparsable: boolean
}

function parseIngredient(raw: string): ParsedIngredient {
  const normalized = normalizeUnicodeFractions(raw.trim())
  const cleaned = normalized.trim()

  // Try recipe-ingredient-parser-v3 first (best for standard English formats)
  try {
    const result = parseIngredientLib(cleaned, 'eng')
    if (result.ingredient && result.quantity > 0) {
      const unit = result.symbol ?? result.unit ?? ''
      const qty = result.minQty !== result.maxQty
        ? `${result.minQty}-${result.maxQty}`
        : String(result.quantity)
      return {
        slug: toSlug(result.ingredient),
        name: result.ingredient,
        qty,
        unit: unit.toLowerCase(),
        raw: cleaned,
        unparsable: false,
      }
    }
  } catch {
    // parser crashed (e.g. French text quantities) — fall through to regex
  }

  // Regex fallback (handles French units, compact "285g farine", etc.)
  let m = cleaned.match(ING_RE)
  if (m) {
    const name = (m[3] ?? '').trim()
    return { slug: toSlug(name), name, qty: (m[1] ?? '').replace(',', '.'), unit: (m[2] ?? '').toLowerCase(), raw: cleaned, unparsable: false }
  }
  m = cleaned.match(ING_RE_NOUNIT)
  if (m) {
    const name = (m[2] ?? '').trim()
    return { slug: toSlug(name), name, qty: (m[1] ?? '').replace(',', '.'), unit: '', raw: cleaned, unparsable: false }
  }

  return { slug: toSlug(cleaned), name: cleaned, qty: '', unit: '', raw: cleaned, unparsable: true }
}

// ── JSON-LD extraction ────────────────────────────────────────────────────────

function extractRecipeJsonLd(html: string): object {
  const blocks: object[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1] ?? '')
      blocks.push(parsed)
    } catch {
      // skip malformed blocks
    }
  }

  for (const block of blocks) {
    const recipe = findRecipe(block)
    if (recipe) return recipe
  }

  throw new GramCLIError(
    'No schema.org/Recipe JSON-LD found on this page. Try downloading the page and passing the JSON-LD directly.',
    ExitCode.Error,
  )
}

function findRecipe(obj: any): object | null {
  if (!obj) return null
  if (obj['@type'] === 'Recipe') return obj
  if (Array.isArray(obj['@graph'])) {
    for (const node of obj['@graph']) {
      if (node['@type'] === 'Recipe') return node
    }
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = findRecipe(item)
      if (r) return r
    }
  }
  return null
}

function flattenInstructions(instructions: any[]): Array<{ text: string; name?: string }> {
  const steps: Array<{ text: string; name?: string }> = []
  for (const ins of instructions) {
    if (typeof ins === 'string') {
      steps.push({ text: ins })
    } else if (ins['@type'] === 'HowToStep') {
      steps.push({ text: ins.text ?? ins.name ?? '', name: ins.name })
    } else if (ins['@type'] === 'HowToSection' && Array.isArray(ins.itemListElement)) {
      steps.push(...flattenInstructions(ins.itemListElement))
    }
  }
  return steps
}

// ── Step annotation via fuzzy matching ───────────────────────────────────────

function annotateStep(text: string, ingredients: ParsedIngredient[]): string {
  // Sort longest name first to avoid partial overlaps
  const sorted = [...ingredients].sort((a, b) => b.name.length - a.name.length)
  let result = text
  let offset = 0

  for (const ing of sorted) {
    if (ing.unparsable || !ing.name) continue

    const match = matchInText(ing.name, result.slice(offset))
    if (!match) continue

    const absStart = offset + match.start
    const absEnd = offset + match.end
    const ref = `@${ing.slug}{${ing.qty}${ing.unit ? ' ' + ing.unit : ''}}`
    result = result.slice(0, absStart) + ref + result.slice(absEnd)
    // Advance offset past this replacement so we don't re-scan it
    offset = absStart + ref.length
  }

  return result
}

// ── Gram generation ───────────────────────────────────────────────────────────

function generateGram(recipe: any, ingredients: ParsedIngredient[]): string {
  const meta: string[] = ['---']
  meta.push(`title: '${String(recipe.name ?? 'Untitled').replace(/'/g, "\\'")}'`)

  const author = recipe.author?.name ?? (typeof recipe.author === 'string' ? recipe.author : null)
  if (author) meta.push(`author: '${String(author).replace(/'/g, "\\'")}'`)

  const yield_ = recipe.recipeYield
  if (yield_) {
    const n = typeof yield_ === 'string' ? parseInt(yield_) : (Array.isArray(yield_) ? parseInt(yield_[0]) : yield_)
    if (!isNaN(n)) meta.push(`servings: ${n}`)
  }

  const prepMins = recipe.prepTime ? parseIsoDuration(recipe.prepTime) : 0
  const cookMins = recipe.cookTime ? parseIsoDuration(recipe.cookTime) : 0
  const totalMins = recipe.totalTime ? parseIsoDuration(recipe.totalTime) : (prepMins + cookMins)
  if (prepMins || cookMins || totalMins) {
    meta.push('time:')
    if (prepMins) meta.push(`  prep: ${prepMins}`)
    if (cookMins) meta.push(`  active: ${cookMins}`)
    if (totalMins && totalMins !== prepMins + cookMins) meta.push(`  total: ${totalMins}`)
  }
  meta.push('---')

  const lines = [...meta, '', '## Instructions', '']

  const instructions = flattenInstructions(recipe.recipeInstructions ?? [])

  for (let i = 0; i < instructions.length; i++) {
    const step = instructions[i]!
    const stepNum = i + 1
    const action = step.name && step.name !== step.text
      ? `[${step.name.split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}]`
      : `[Step ${stepNum}]`

    lines.push(`${action} ${annotateStep(step.text, ingredients)}`)
    if (i < instructions.length - 1) lines.push('')
  }

  return lines.join('\n')
}

// ── Source fetching ───────────────────────────────────────────────────────────

async function fetchRecipe(source: string): Promise<{ jsonLd: any; rawHtml?: string }> {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source)
    if (!res.ok) throw new GramCLIError(`HTTP ${res.status} fetching ${source}`, ExitCode.Error)

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('json')) {
      return { jsonLd: await res.json() }
    }
    const html = await res.text()
    return { jsonLd: extractRecipeJsonLd(html), rawHtml: html }
  }

  const content = await readFile(source, 'utf-8')
  const parsed = JSON.parse(content)
  const recipe = findRecipe(parsed)
  if (!recipe) throw new GramCLIError('No schema.org/Recipe found in the provided JSON file.', ExitCode.Error)
  return { jsonLd: recipe }
}

// ── Heuristic import ──────────────────────────────────────────────────────────

export async function importJsonLd(source: string): Promise<ImportResult> {
  const { jsonLd } = await fetchRecipe(source)
  const recipe: any = findRecipe(jsonLd) ?? jsonLd

  const rawIngredients: string[] = recipe.recipeIngredient ?? []
  const parsedIngredients = rawIngredients.map(parseIngredient)
  const parseWarnings = parsedIngredients
    .filter(i => i.unparsable)
    .map(i => `"${i.raw}"  →  @${i.slug}{}  (quantity unknown)`)

  const instructions = flattenInstructions(recipe.recipeInstructions ?? [])
  const gramContent = generateGram(recipe, parsedIngredients)

  return {
    gramContent,
    title: recipe.name ?? 'Untitled',
    ingredientCount: parsedIngredients.length,
    stepCount: instructions.length,
    parseWarnings,
  }
}

// ── AI import ─────────────────────────────────────────────────────────────────

const GRAM_SPEC_PROMPT = `You are an expert at converting recipe data into the Gram recipe language.

## Gram format specification

A Gram file has two parts: a YAML frontmatter block and a body.

### Frontmatter (between --- delimiters)
\`\`\`
---
title: 'Recipe Title'
author: 'Author Name'
servings: 4
time:
  prep: 15
  active: 30
  total: 45
---
\`\`\`
All time values are in minutes.

### Body — Steps
Each step is on its own line with an action verb in square brackets:
\`[Sauté]\` or \`[Step 1]\` if no specific action name.

### Ingredient references in steps
Use \`@slug{quantity unit}\` where slug is the ingredient name in kebab-case:
- \`@flour{250 g}\`
- \`@olive-oil{2 tbsp}\`
- \`@eggs{3}\` (no unit for countable items)
- \`@salt\` (no quantity = to taste)

### Equipment
Use \`#equipment-name\` for tools and vessels: \`#dutch-oven\`, \`#baking-sheet\`

### Timers
Use \`~{duration}\` for timing cues: \`~{10 min}\`, \`~{1h30}\`

### Temperatures
Use \`°{value}\` for temperatures: \`°{180°C}\`, \`°{350°F}\`

### Step outputs (references)
Use \`->&name\` at the end of a step to name its output, then \`@&name\` to reference it later.

## Rules
- Output ONLY the raw Gram file content — no markdown fences, no explanation
- Every ingredient mentioned in a step MUST use the @slug{} syntax
- Steps must be separated by blank lines
- Preserve all sections (## Section Name) if the recipe has multiple phases
- Use sensible SI units (g, ml, kg, L) or common cooking units (tbsp, tsp, cup)
- Slugs: lowercase, kebab-case, no accents (farine, huile-dolive, oeuf)
`

export async function importWithAI(source: string, model: LanguageModel): Promise<ImportResult> {
  const { jsonLd } = await fetchRecipe(source)
  const recipe: any = findRecipe(jsonLd) ?? jsonLd

  const instructions = flattenInstructions(recipe.recipeInstructions ?? [])

  let gramContent: string
  try {
    const { text } = await generateText({
      model,
      system: GRAM_SPEC_PROMPT,
      prompt: `Convert this recipe JSON-LD to Gram format:\n\n${JSON.stringify(recipe, null, 2)}`,
    })
    gramContent = text.trim()
    // Strip accidental markdown fences if the model adds them
    gramContent = gramContent.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
  } catch (err) {
    // Fallback to heuristic if AI call fails
    process.stderr.write(`  ⚠ AI call failed, falling back to heuristic import.\n`)
    return importJsonLd(source)
  }

  // Count ingredients and steps from the parsed JSON-LD for reporting
  const rawIngredients: string[] = recipe.recipeIngredient ?? []

  return {
    gramContent,
    title: recipe.name ?? 'Untitled',
    ingredientCount: rawIngredients.length,
    stepCount: instructions.length,
    parseWarnings: [],
  }
}
