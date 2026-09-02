import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const profileDirectory = fileURLToPath(
  new URL('../.wxt/chromium-profile/', import.meta.url),
)
const pidFile = fileURLToPath(
  new URL('../.wxt/chromium-profile/chrome.pid', import.meta.url),
)

/** Returns whether a recorded operating-system process is still running. */
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return false
    }

    if (error?.code === 'EPERM') {
      return true
    }

    throw error
  }
}

/**
 * Returns whether the recorded PID still belongs to a Chrome process.
 *
 * `chrome-launcher` writes `chrome.pid` when it spawns Chrome but never
 * removes it, even on a clean shutdown, so a stale file is the normal case
 * once a dev session ends. On Windows especially, PIDs get recycled quickly,
 * so a bare `process.kill(pid, 0)` check can find an unrelated process (a
 * new tab, an editor, anything) now sitting on that same number and report
 * a false "still running." Confirming the image name is `chrome.exe` before
 * trusting the file rules that out.
 */
function isChromeStillRunning(pid) {
  if (!isProcessRunning(pid)) {
    return false
  }

  if (process.platform !== 'win32') {
    return true
  }

  try {
    const output = execFileSync(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FI', 'IMAGENAME eq chrome.exe', '/NH'],
      { encoding: 'utf8' },
    )

    return output.toLowerCase().includes('chrome.exe')
  } catch {
    // If tasklist itself fails, fail safe toward "not running" rather than
    // permanently blocking npm start on a diagnostic tool's own failure.
    return false
  }
}

// Chrome Launcher needs the configured profile directory before it creates logs.
await mkdir(profileDirectory, { recursive: true })

try {
  const recordedPid = Number.parseInt(await readFile(pidFile, 'utf8'), 10)

  if (Number.isInteger(recordedPid) && isChromeStillRunning(recordedPid)) {
    console.error(
      'The Collections Launcher development browser is already running. ' +
        'Use the existing window, or close it and stop the previous npm command before starting again.',
    )
    process.exit(1)
  }

  await rm(pidFile, { force: true })
} catch (error) {
  if (error?.code !== 'ENOENT') {
    throw error
  }
}
