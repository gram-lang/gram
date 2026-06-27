import { readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { spawn } from 'node:child_process'
import { getAST } from '@gram/parser'
import { compile } from '@gram/kitchen'
import type { CompilationResult } from '@gram/kitchen'
import { diffRecipes } from '@gram/analyzer'
import type { DiffResult } from '@gram/analyzer'
import { GramCLIError, ExitCode } from '../errors'

export type { DiffResult }

function run(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => (stdout += c.toString()))
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString()))
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') reject(new Error(`"${cmd}" is not available in PATH`))
      else reject(err)
    })
    child.on('close', code => {
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `${cmd} exited with code ${code}`))
    })
  })
}

async function gitRoot(fromPath: string): Promise<string> {
  try {
    const root = await run('git', ['rev-parse', '--show-toplevel'], fromPath)
    return root.trim()
  } catch {
    throw new GramCLIError(
      'Not inside a git repository. Use "gram diff file-a.gram file-b.gram" to compare two explicit files.',
      ExitCode.Error,
    )
  }
}

function compileContent(content: string): CompilationResult {
  return compile(getAST(content))
}

async function compileFile(filePath: string): Promise<CompilationResult> {
  const content = await readFile(filePath, 'utf-8')
  return compileContent(content)
}

async function compileAtRef(ref: string, absPath: string): Promise<CompilationResult> {
  const dir = resolve(absPath, '..')
  const root = await gitRoot(dir)
  const relToRoot = relative(root, absPath)

  let content: string
  try {
    content = await run('git', ['show', `${ref}:${relToRoot}`], root)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new GramCLIError(
      `Cannot read "${relToRoot}" at "${ref}".\n${msg}\n\nMake sure the file is tracked by git and the ref exists.`,
      ExitCode.Error,
    )
  }

  return compileContent(content)
}

export interface DiffOptions {
  fileA: string
  fileB?: string
  ref?: string
}

export async function computeDiff(opts: DiffOptions): Promise<{ result: DiffResult; label: string }> {
  const absA = resolve(opts.fileA)

  let compiled_a: CompilationResult
  let compiled_b: CompilationResult
  let label: string

  if (opts.fileB) {
    // Two explicit files
    const absB = resolve(opts.fileB)
    ;[compiled_a, compiled_b] = await Promise.all([compileFile(absA), compileFile(absB)])
    label = `${opts.fileA} → ${opts.fileB}`
  } else {
    // Git mode: working tree vs ref (default HEAD)
    const ref = opts.ref ?? 'HEAD'
    compiled_b = await compileFile(absA)
    compiled_a = await compileAtRef(ref, absA)
    label = `${opts.fileA} (${ref} → working tree)`
  }

  return { result: diffRecipes(compiled_a, compiled_b), label }
}
