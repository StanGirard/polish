import { readFile } from 'fs/promises'
import { join } from 'path'
import type { Config } from './types'

type StackType = 'nextjs' | 'python' | 'rust' | 'unknown'

export async function detectStack(projectPath: string): Promise<StackType> {
  // Check for Next.js / Node.js project
  try {
    const packageJsonPath = join(projectPath, 'package.json')
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

    // Check if it's a Next.js project
    if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
      return 'nextjs'
    }

    // Generic Node.js project could be treated as nextjs for now
    if (packageJson.dependencies || packageJson.devDependencies) {
      return 'nextjs'
    }
  } catch {
    // Not a Node.js project
  }

  // Check for Python project
  try {
    await readFile(join(projectPath, 'pyproject.toml'), 'utf-8')
    return 'python'
  } catch {
    // Not a Python project with pyproject.toml
  }

  try {
    await readFile(join(projectPath, 'requirements.txt'), 'utf-8')
    return 'python'
  } catch {
    // Not a Python project with requirements.txt
  }

  // Check for Rust project
  try {
    await readFile(join(projectPath, 'Cargo.toml'), 'utf-8')
    return 'rust'
  } catch {
    // Not a Rust project
  }

  return 'unknown'
}

interface BasePreset {
  rules: string[]
  thresholds: Config['thresholds']
}

interface StackPreset extends Partial<BasePreset> {
  extends?: string
  metrics: Config['metrics']
  strategies: Config['strategies']
}

export async function loadPreset(stack: StackType): Promise<Config> {
  // Load base preset
  const basePresetPath = join(process.cwd(), 'presets', 'base.json')
  const basePreset: BasePreset = JSON.parse(await readFile(basePresetPath, 'utf-8'))

  if (stack === 'unknown') {
    // Return a minimal config with no metrics
    return {
      metrics: [],
      strategies: [],
      rules: basePreset.rules,
      thresholds: basePreset.thresholds,
    }
  }

  // Load stack-specific preset
  const stackPresetPath = join(process.cwd(), 'presets', `${stack}.json`)
  let stackPreset: StackPreset

  try {
    stackPreset = JSON.parse(await readFile(stackPresetPath, 'utf-8'))
  } catch {
    // Fallback to empty preset if stack-specific one doesn't exist
    return {
      metrics: [],
      strategies: [],
      rules: basePreset.rules,
      thresholds: basePreset.thresholds,
    }
  }

  // Merge presets (stack preset inherits from base)
  return {
    metrics: stackPreset.metrics || [],
    strategies: stackPreset.strategies || [],
    rules: stackPreset.rules || basePreset.rules,
    thresholds: {
      ...basePreset.thresholds,
      ...stackPreset.thresholds,
    },
  }
}

export function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    metrics: override.metrics || base.metrics,
    strategies: override.strategies || base.strategies,
    rules: override.rules || base.rules,
    thresholds: {
      ...base.thresholds,
      ...override.thresholds,
    },
  }
}
