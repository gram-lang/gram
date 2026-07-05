import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import { shikiToMonaco } from '@shikijs/monaco'
// @ts-ignore
import gramGrammar from '@gram/parser/textmate'

export let isSetup = false

export async function setupMonaco(monaco: any) {
  if (isSetup) return
  isSetup = true

  // Ensure languages are registered in Monaco
  const langs = ['gram', 'json', 'scheme', 'markdown']
  for (const lang of langs) {
    if (!monaco.languages.getLanguages().some((l: any) => l.id === lang)) {
      monaco.languages.register({ id: lang })
    }
  }

  // Initialize Shiki core with explicit languages and themes
  const highlighter = await createHighlighterCore({
    themes: [
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs')
    ],
    langs: [
      { ...gramGrammar, name: 'gram' } as any,
      import('shiki/langs/json.mjs'),
      import('shiki/langs/scheme.mjs'),
      import('shiki/langs/markdown.mjs')
    ],
    engine: createOnigurumaEngine(import('shiki/wasm'))
  })

  // Bind Shiki to Monaco
  shikiToMonaco(highlighter, monaco)
}
