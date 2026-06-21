import { open, unlink, rename, writeFile as _writeFile } from 'node:fs/promises'

export async function withFileLock<T>(targetPath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = targetPath + '.lock'
  let fd
  try {
    fd = await open(lockPath, 'wx') // O_EXCL: atomic, fails if lock already exists
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(
        `Another gram process is writing ${targetPath}. Retry in a moment.`,
      )
    }
    throw err
  }
  try {
    return await fn()
  } finally {
    await fd.close()
    await unlink(lockPath).catch(() => {})
  }
}

// Write to a .tmp file then rename — rename is atomic on POSIX and NTFS
export async function atomicWrite(targetPath: string, content: string): Promise<void> {
  const tmp = targetPath + '.tmp'
  await _writeFile(tmp, content, 'utf-8')
  await rename(tmp, targetPath)
}
