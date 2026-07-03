import { createHighlighter } from 'shiki'
import { shikiToMonaco } from '@shikijs/monaco'
// @ts-ignore
import gramGrammar from '@gram/parser/textmate'

let isSetup = false

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

  // Initialize Shiki with the official Gram TextMate grammar
  const highlighter = await createHighlighter({
    langs: [
      { ...gramGrammar, name: 'gram' },
      'json',
      'scheme',
      'markdown'
    ],
    themes: ['github-light', 'github-dark']
  })

  // Bind Shiki to Monaco
  shikiToMonaco(highlighter, monaco)
}
