import { describe, it, expect } from 'vitest'
import { exec, execWithOutput } from '../executor'

describe('exec', () => {
  it('should execute a simple command successfully', async () => {
    const result = await exec('echo "hello"', process.cwd())
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('hello')
    expect(result.stderr).toBe('')
  })

  it('should capture stderr on error', async () => {
    const result = await exec('echo "error" >&2', process.cwd())
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('error')
  })

  it('should return non-zero exit code on command failure', async () => {
    const result = await exec('exit 1', process.cwd())
    expect(result.exitCode).toBe(1)
  })

  it('should timeout long-running commands', async () => {
    const result = await exec('sleep 5', process.cwd(), 100)
    expect(result.exitCode).toBe(-1)
  }, 5000)

  it('should handle command not found', async () => {
    const result = await exec('nonexistentcommand123', process.cwd())
    expect(result.exitCode).not.toBe(0)
  })
})

describe('execWithOutput', () => {
  it('should return stdout on success', async () => {
    const output = await execWithOutput('echo "test"', process.cwd())
    expect(output).toBe('test')
  })

  it('should throw error on command failure', async () => {
    await expect(
      execWithOutput('exit 1', process.cwd())
    ).rejects.toThrow('Command failed')
  })

  it('should include stderr in error message', async () => {
    await expect(
      execWithOutput('echo "error message" >&2 && exit 1', process.cwd())
    ).rejects.toThrow('error message')
  })
})
