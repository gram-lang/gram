import { readFile } from 'node:fs/promises'
import { GramCLIError, ExitCode } from '../errors'
import type { ImportResult } from '../types'

function parseIsoDuration(iso: string): number {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return 0
  return (parseInt(m[1] ?? '0') * 1440) + (parseInt(m[2] ?? '0') * 60) + parseInt(m[3] ?? '0')
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
  qty: string
  unit: string
  raw: string
  unparsable: boolean
}

function parseIngredient(raw: string): ParsedIngredient {
  const cleaned = raw.trim()
  let m = cleaned.match(ING_RE)
  if (m) {
    return { slug: toSlug(m[3] ?? ''), qty: (m[1] ?? '').replace(',', '.'), unit: (m[2] ?? '').toLowerCase(), raw: cleaned, unparsable: false }
  }
  m = cleaned.match(ING_RE_NOUNIT)
  if (m) {
    return { slug: toSlug(m[2] ?? ''), qty: (m[1] ?? '').replace(',', '.'), unit: '', raw: cleaned, unparsable: false }
  }
  return { slug: toSlug(cleaned), qty: '', unit: '', raw: cleaned, unparsable: true }
}

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
  let stepIdx = 0

  for (const step of instructions) {
    stepIdx++
    const action = step.name && step.name !== step.text
      ? `[${step.name.split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}]`
      : `[Step ${stepIdx}]`

    // Replace raw ingredient names with @slug{qty unit} references where possible
    let text = step.text
    for (const ing of ingredients) {
      if (!ing.unparsable) {
        const nameRegex = new RegExp(`\\b${ing.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
        text = text.replace(nameRegex, `@${ing.slug}{${ing.qty}${ing.unit ? ' ' + ing.unit : ''}}`)
      }
    }

    lines.push(`${action} ${text}`)
  }

  return lines.join('\n')
}

export async function importJsonLd(source: string): Promise<ImportResult> {
  let jsonData: any

  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source)
    if (!res.ok) {
      throw new GramCLIError(`HTTP ${res.status} fetching ${source}`, ExitCode.Error)
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('json')) {
      jsonData = await res.json()
    } else {
      const html = await res.text()
      jsonData = extractRecipeJsonLd(html)
    }
  } else {
    const content = await readFile(source, 'utf-8')
    const parsed = JSON.parse(content)
    const recipe = findRecipe(parsed)
    if (!recipe) {
      throw new GramCLIError(
        'No schema.org/Recipe found in the provided JSON file.',
        ExitCode.Error,
      )
    }
    jsonData = recipe
  }

  const recipe: any = findRecipe(jsonData) ?? jsonData

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
