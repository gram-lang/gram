<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  data: any
  name?: string
  isLast?: boolean
  initialExpanded?: boolean
}>()

const isExpanded = ref(props.initialExpanded !== false)

function toggle() {
  isExpanded.value = !isExpanded.value
}

const type = computed(() => {
  if (props.data === null) return 'null'
  if (Array.isArray(props.data)) return 'array'
  return typeof props.data
})

const isObjectOrArray = computed(() => type.value === 'object' || type.value === 'array')
const isEmpty = computed(() => {
  if (type.value === 'array') return props.data.length === 0
  if (type.value === 'object') return Object.keys(props.data).length === 0
  return false
})

const keys = computed(() => {
  if (type.value === 'array') return props.data.map((_: any, i: number) => i)
  if (type.value === 'object') return Object.keys(props.data)
  return []
})

const count = computed(() => keys.value.length)
</script>

<template>
  <div class="json-node">
    <!-- Primitives and Empty Objects/Arrays -->
    <template v-if="!isObjectOrArray || isEmpty">
      <div class="json-line">
        <span v-if="name" class="json-key">"{{ name }}"</span>
        <span v-if="name" class="json-colon">: </span>
        <span v-if="type === 'string'" class="json-string">"{{ data }}"</span>
        <span v-else-if="type === 'number'" class="json-number">{{ data }}</span>
        <span v-else-if="type === 'boolean'" class="json-boolean">{{ data }}</span>
        <span v-else-if="type === 'null'" class="json-null">null</span>
        <span v-else-if="isEmpty && type === 'array'" class="json-bracket">[]</span>
        <span v-else-if="isEmpty && type === 'object'" class="json-brace">{}</span>
        <span v-if="!isLast" class="json-comma">,</span>
      </div>
    </template>

    <!-- Objects and Arrays -->
    <template v-else>
      <div class="json-line json-header" @click.stop="toggle">
        <span class="json-toggle">{{ isExpanded ? '▼' : '▶' }}</span>
        <span v-if="name" class="json-key">"{{ name }}"</span>
        <span v-if="name" class="json-colon">: </span>
        <span :class="type === 'array' ? 'json-bracket' : 'json-brace'">
          {{ type === 'array' ? '[' : '{' }}
        </span>
        <span v-if="!isExpanded" class="json-count">{{ count }} items</span>
        <span v-if="!isExpanded" :class="type === 'array' ? 'json-bracket' : 'json-brace'">
          {{ type === 'array' ? ']' : '}' }}
        </span>
        <span v-if="!isExpanded && !isLast" class="json-comma">,</span>
      </div>
      
      <div v-show="isExpanded" class="json-children">
        <JsonNode
          v-for="(k, index) in keys"
          :key="k"
          :name="type === 'array' ? undefined : k.toString()"
          :data="data[k]"
          :is-last="index === keys.length - 1"
          :initial-expanded="initialExpanded"
        />
      </div>
      
      <div v-show="isExpanded" class="json-line json-footer">
        <span :class="type === 'array' ? 'json-bracket' : 'json-brace'">
          {{ type === 'array' ? ']' : '}' }}
        </span>
        <span v-if="!isLast" class="json-comma">,</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.json-node {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.5;
}

.json-line {
  white-space: pre;
}

.json-header {
  cursor: pointer;
  user-select: none;
}

.json-header:hover {
  background-color: var(--vp-c-bg-mute);
}

.json-children {
  padding-left: 20px;
  border-left: 1px dotted var(--vp-c-divider);
  margin-left: 5px;
}

.json-toggle {
  display: inline-block;
  width: 14px;
  text-align: center;
  font-size: 10px;
  color: var(--vp-c-text-3);
  margin-right: 4px;
}

.json-key { color: var(--vp-c-brand-1); }
.json-string { color: var(--vp-c-green-1); }
.json-number { color: var(--vp-c-yellow-1); }
.json-boolean { color: var(--vp-c-red-1); }
.json-null { color: var(--vp-c-text-3); }
.json-colon, .json-comma, .json-bracket, .json-brace { color: var(--vp-c-text-1); }
.json-count { color: var(--vp-c-text-3); font-style: italic; margin: 0 4px; }
</style>
