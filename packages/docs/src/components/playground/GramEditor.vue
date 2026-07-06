<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue'
import { useData } from 'vitepress'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: string]
}>()

const { isDark } = useData()

const _localCode = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const editorRef = shallowRef()

const shikiLoaded = ref(false)

import { setupMonaco, } from './monacoSetup'

const _handleMount = async (editor: any, monaco: any) => {
  editorRef.value = editor
  await setupMonaco(monaco)
  shikiLoaded.value = true
  
  // Force theme update: bypass Vue's hydration delay by reading the DOM class directly
  const isDarkMode = document.documentElement.classList.contains('dark') || isDark.value
  monaco.editor.setTheme(isDarkMode ? 'github-dark' : 'github-light')
}

// Ensure theme updates even if Shiki takes a very long time
import { watch } from 'vue'
watch(isDark, (dark) => {
  if (editorRef.value && (window as any).monaco) {
    (window as any).monaco.editor.setTheme(dark ? 'github-dark' : 'github-light')
  }
})

const _MONACO_OPTIONS = {
  automaticLayout: true,
  minimap: { enabled: false },
  wordWrap: 'on',
  fontSize: 14,
  fontFamily: 'var(--vp-font-family-mono), "Fira Code", monospace',
  scrollBeyondLastLine: false,
  lineNumbersMinChars: 3,
  renderLineHighlight: 'all',
  padding: { top: 16 }
}

defineExpose({
  jump(start: number, end: number) {
    if (editorRef.value) {
      const model = editorRef.value.getModel()
      if (model) {
        const startPos = model.getPositionAt(start)
        const endPos = model.getPositionAt(end)
        editorRef.value.setSelection({
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column
        })
        editorRef.value.revealRangeInCenter({
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column
        })
        editorRef.value.focus()
      }
    }
  }
})
</script>

<template>
  <div class="gram-editor">
    <div class="editor-header">
      <span class="editor-title">Input (.gram)</span>
    </div>
    <div class="editor-container">
      <ClientOnly>
        <VueMonacoEditor
          v-model:value="localCode"
          :theme="(shikiLoaded || isSetup) ? (isDark ? 'github-dark' : 'github-light') : (isDark ? 'vs-dark' : 'vs')"
          language="gram"
          :options="MONACO_OPTIONS"
          @mount="handleMount"
        />
        <template #fallback>
          <div class="loading-editor">Loading editor...</div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
.gram-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--vp-c-bg-soft);
  overflow: hidden;
}

.editor-header {
  padding: 8px 12px;
  background-color: var(--vp-c-bg-mute);
  border-bottom: 1px solid var(--vp-c-border);
}

.editor-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-2);
}

.editor-container {
  flex: 1;
  position: relative;
  min-height: 0;
}

.loading-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vp-c-text-3);
  font-size: 14px;
}
</style>
