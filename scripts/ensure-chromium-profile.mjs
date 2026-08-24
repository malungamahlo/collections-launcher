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

// Chrome Launcher needs the configured profile directory before it creates logs.
await mkdir(profileDirectory, { recursive: true })

try {
  const recordedPid = Number.parseInt(await readFile(pidFile, 'utf8'), 10)

  if (Number.isInteger(recordedPid) && isProcessRunning(recordedPid)) {
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
