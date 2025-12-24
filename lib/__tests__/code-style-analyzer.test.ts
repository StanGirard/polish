import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { analyzeCodeStyle, calculateCodeStyleScore } from '../code-style-analyzer'
import { writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

describe('analyzeCodeStyle', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-code-style-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should return 100 score for empty project', async () => {
    const report = await analyzeCodeStyle(testDir)
    expect(report.score).toBe(100)
    expect(report.totalFiles).toBe(0)
    expect(report.totalFunctions).toBe(0)
  })

  it('should detect short functions and files as good', async () => {
    const goodCode = `export function shortFunction() {
  return 'hello'
}

export function anotherShort() {
  const x = 1
  return x + 1
}
`
    await writeFile(join(testDir, 'good.ts'), goodCode)

    const report = await analyzeCodeStyle(testDir)
    expect(report.totalFiles).toBe(1)
    expect(report.totalFunctions).toBeGreaterThan(0)
    expect(report.longFiles).toHaveLength(0)
    expect(report.longFunctionsCount).toBe(0)
    expect(report.score).toBeGreaterThan(90)
  })

  it('should detect long functions', async () => {
    // Create a function with 60 lines (over the default 50 limit)
    const lines = []
    lines.push('export function veryLongFunction() {')
    for (let i = 0; i < 58; i++) {
      lines.push(`  const var${i} = ${i}`)
    }
    lines.push('}')

    const longCode = lines.join('\n')
    await writeFile(join(testDir, 'long.ts'), longCode)

    const report = await analyzeCodeStyle(testDir)
    expect(report.totalFunctions).toBeGreaterThan(0)
    expect(report.longFunctionsCount).toBeGreaterThan(0)
    expect(report.score).toBeLessThan(100)
  })

  it('should detect long files', async () => {
    // Create a file with 600 lines (over the default 500 limit)
    const lines = []
    for (let i = 0; i < 600; i++) {
      lines.push(`// Line ${i}`)
    }

    await writeFile(join(testDir, 'huge.ts'), lines.join('\n'))

    const report = await analyzeCodeStyle(testDir)
    expect(report.totalFiles).toBe(1)
    expect(report.longFiles).toHaveLength(1)
    expect(report.maxFileLength).toBeGreaterThan(500)
    expect(report.score).toBeLessThan(100)
  })

  it('should exclude node_modules and test files', async () => {
    await mkdir(join(testDir, 'node_modules'), { recursive: true })
    await mkdir(join(testDir, '__tests__'), { recursive: true })

    await writeFile(join(testDir, 'node_modules', 'bad.ts'), 'bad code here')
    await writeFile(join(testDir, '__tests__', 'test.ts'), 'test code')
    await writeFile(join(testDir, 'good.ts'), 'export function test() { return 1 }')

    const report = await analyzeCodeStyle(testDir)
    expect(report.totalFiles).toBe(1)
    expect(report.filesAnalyzed[0]).toContain('good.ts')
  })

  it('should respect custom config', async () => {
    const code = `export function mediumFunction() {
  const a = 1
  const b = 2
  const c = 3
  const d = 4
  const e = 5
  const f = 6
  const g = 7
  const h = 8
  const i = 9
  const j = 10
  return a + b + c + d + e + f + g + h + i + j
}
`
    await writeFile(join(testDir, 'medium.ts'), code)

    // With default config (50 lines), this should be fine
    const report1 = await analyzeCodeStyle(testDir)
    expect(report1.longFunctionsCount).toBe(0)

    // With custom config (5 lines), this should be too long
    const report2 = await analyzeCodeStyle(testDir, { maxFunctionLines: 5 })
    expect(report2.longFunctionsCount).toBeGreaterThan(0)
  })

  it('should calculate statistics correctly', async () => {
    await writeFile(join(testDir, 'file1.ts'), `
export function func1() {
  return 1
}

export function func2() {
  return 2
}
`)
    await writeFile(join(testDir, 'file2.ts'), `
export function func3() {
  return 3
}
`)

    const report = await analyzeCodeStyle(testDir)
    expect(report.totalFiles).toBe(2)
    expect(report.totalFunctions).toBeGreaterThan(0)
    expect(report.averageFileLength).toBeGreaterThan(0)
    expect(report.averageFunctionLength).toBeGreaterThan(0)
  })
})

describe('calculateCodeStyleScore', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-score-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should return score as number', async () => {
    await writeFile(join(testDir, 'test.ts'), 'export function test() { return 1 }')

    const score = await calculateCodeStyleScore(testDir)
    expect(typeof score).toBe('number')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('should return 100 for empty project', async () => {
    const score = await calculateCodeStyleScore(testDir)
    expect(score).toBe(100)
  })
})
