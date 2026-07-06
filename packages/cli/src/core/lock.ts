import { open, unlink, rename, writeFile as _writeFile, copyFile } from 'node:fs/promises'

export async function withFileLock<T>(targetPath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${targetPath}.lock`
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

// Write to a .tmp file then rename — atomic on POSIX; fallback copy+delete on Windows EEXIST
export async function atomicWrite(targetPath: string, content: string): Promise<void> {
  const tmp = `${targetPath}.tmp`
  await _writeFile(tmp, content, 'utf-8')
  try {
    await rename(tmp, targetPath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      await copyFile(tmp, targetPath)
      await unlink(tmp).catch(() => {})
    } else {
      throw err
    }
  }
}
