import { readFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { parse, stringify } from 'yaml'
import { withFileLock, atomicWrite } from '../core/lock'

const SENSITIVE_KEYS = new Set(['ai.apiKey'])

const PROVIDER_ENV_MAP: Record<string, string> = {
  google: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
}

export function getLocalConfigPath(projectRoot: string): string {
  return join(projectRoot, '.gram', 'config.yaml')
}

export function getGlobalConfigPath(): string {
  return join(homedir(), '.config', 'gram', 'config.yaml')
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key)
}

export function getEnvVarName(provider?: string): string {
  return (provider && PROVIDER_ENV_MAP[provider]) ?? 'GRAM_API_KEY'
}

// ── Dot-notation helpers ──────────────────────────────────────────────────────

const FORBIDDEN_KEY_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

function guardKey(key: string): void {
  for (const part of key.split('.')) {
    if (FORBIDDEN_KEY_SEGMENTS.has(part)) {
      throw new Error(`Forbidden config key segment: "${part}"`)
    }
  }
}

function setNestedKey(obj: Record<string, any>, key: string, value: any): void {
  guardKey(key)
  const parts = key.split('.')
  let curr = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!
    if (!curr[part] || typeof curr[part] !== 'object') curr[part] = {}
    curr = curr[part]
  }
  curr[parts[parts.length - 1]!] = value
}

export function getNestedKey(obj: Record<string, any>, key: string): any {
  guardKey(key)
  return key.split('.').reduce((acc: any, part) => acc?.[part], obj)
}

function deleteNestedKey(obj: Record<string, any>, key: string): boolean {
  guardKey(key)
  const parts = key.split('.')
  let curr = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!
    if (!curr[part] || typeof curr[part] !== 'object') return false
    curr = curr[part]
  }
  const last = parts[parts.length - 1]!
  if (!(last in curr)) return false
  delete curr[last]
  return true
}

export function flattenConfig(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenConfig(v, fullKey))
    } else {
      result[fullKey] = v
    }
  }
  return result
}

export function coerceValue(raw: string): any {
  if (raw === 'true') return true
  if (raw === 'false') return false
  const n = Number(raw)
  if (!Number.isNaN(n) && raw.trim() !== '') return n
  return raw
}

// ── YAML file helpers ─────────────────────────────────────────────────────────

async function readConfigFile(path: string): Promise<Record<string, any>> {
  try {
    const content = await readFile(path, 'utf-8')
    return parse(content) ?? {}
  } catch {
    return {}
  }
}

async function writeConfigFile(path: string, data: Record<string, any>): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await withFileLock(path, () => atomicWrite(path, stringify(data, { lineWidth: 0 })))
}

// ── .env helpers ──────────────────────────────────────────────────────────────

export async function readDotEnv(envPath: string): Promise<Record<string, string>> {
  try {
    const content = await readFile(envPath, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      result[key] = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    }
    return result
  } catch {
    return {}
  }
}

async function writeDotEnv(envPath: string, vars: Record<string, string>): Promise<void> {
  const lines = `${Object.entries(vars)
    .map(([k, v]) => `${k}="${v.replace(/[\r\n"]/g, '')}"`)
    .join('\n')}\n`
  await withFileLock(envPath, () => atomicWrite(envPath, lines))
}

export async function upsertEnvVar(envPath: string, key: string, value: string): Promise<void> {
  const vars = await readDotEnv(envPath)
  vars[key] = value
  await writeDotEnv(envPath, vars)
}

function getApiEnvVarFromConfig(config: Record<string, any>): string {
  return getEnvVarName(getNestedKey(config, 'ai.provider'))
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ConfigSetResult {
  envVar?: string
  envFile?: string
}

export async function setConfigValue(
  key: string,
  value: string,
  configPath: string,
  projectRoot: string,
): Promise<ConfigSetResult> {
  if (isSensitiveKey(key)) {
    const config = await readConfigFile(configPath)
    const envVar = getApiEnvVarFromConfig(config)
    const envPath = join(projectRoot, '.env')
    const vars = await readDotEnv(envPath)
    vars[envVar] = value
    await writeDotEnv(envPath, vars)
    return { envVar, envFile: envPath }
  }
  const config = await readConfigFile(configPath)
  setNestedKey(config, key, coerceValue(value))
  await writeConfigFile(configPath, config)
  return {}
}

export async function unsetConfigValue(
  key: string,
  configPath: string,
  projectRoot: string,
): Promise<boolean> {
  if (isSensitiveKey(key)) {
    const config = await readConfigFile(configPath)
    const envVar = getApiEnvVarFromConfig(config)
    const envPath = join(projectRoot, '.env')
    const vars = await readDotEnv(envPath)
    if (!(envVar in vars)) return false
    delete vars[envVar]
    await writeDotEnv(envPath, vars)
    return true
  }
  const config = await readConfigFile(configPath)
  const deleted = deleteNestedKey(config, key)
  if (deleted) await writeConfigFile(configPath, config)
  return deleted
}

export async function getConfigValue(
  key: string,
  configPath: string,
  projectRoot: string,
): Promise<string | undefined> {
  if (isSensitiveKey(key)) {
    const config = await readConfigFile(configPath)
    const envVar = getApiEnvVarFromConfig(config)
    const envPath = join(projectRoot, '.env')
    const vars = await readDotEnv(envPath)
    return vars[envVar]
  }
  const config = await readConfigFile(configPath)
  const value = getNestedKey(config, key)
  return value !== undefined ? String(value) : undefined
}

export interface ConfigSnapshot {
  local: Record<string, any>
  global: Record<string, any>
  envVars: Record<string, string>
}

export async function snapshotConfig(
  localConfigPath: string,
  globalConfigPath: string,
  projectRoot: string,
): Promise<ConfigSnapshot> {
  const [local, global] = await Promise.all([
    readConfigFile(localConfigPath),
    readConfigFile(globalConfigPath),
  ])
  const envPath = join(projectRoot, '.env')
  const allEnvVars = await readDotEnv(envPath)
  const knownEnvKeys = new Set([...Object.values(PROVIDER_ENV_MAP), 'GRAM_API_KEY'])
  const envVars = Object.fromEntries(Object.entries(allEnvVars).filter(([k]) => knownEnvKeys.has(k)))
  return { local, global, envVars }
}
