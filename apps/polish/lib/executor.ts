import { spawn } from 'child_process'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function exec(
  command: string,
  cwd: string,
  timeout: number = 60000
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], {
      cwd,
      env: { ...process.env },
      detached: true,
    })

    let stdout = ''
    let stderr = ''
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      try {
        process.kill(-child.pid!, 'SIGKILL')
      } catch {
        child.kill('SIGKILL')
      }
    }, timeout)

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: killed ? -1 : (code ?? 0),
      })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: -1,
      })
    })
  })
}

export async function execWithOutput(
  command: string,
  cwd: string,
  timeout: number = 60000
): Promise<string> {
  const result = await exec(command, cwd, timeout)
  if (result.exitCode !== 0) {
    throw new Error(`Command failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`)
  }
  return result.stdout
}
