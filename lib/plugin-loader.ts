/**
 * Plugin Loader for Polish
 *
 * Resolves plugin configurations to SDK-compatible format.
 * Plugins are stored on the Polish side (not in target repos) to allow
 * Polish to run on any repository.
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import type { PluginConfig, SdkPluginConfig } from './types'

// Get the root directory of Polish installation
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const POLISH_ROOT = resolve(__dirname, '..')

// Plugin directories
const BUNDLED_PLUGINS_DIR = resolve(POLISH_ROOT, 'plugins')
const USER_PLUGINS_DIR = resolve(process.env.HOME || '~', '.polish', 'plugins')

/**
 * Resolve a plugin configuration to an absolute path
 */
export function resolvePluginPath(plugin: PluginConfig): string {
  switch (plugin.type) {
    case 'bundled':
      // Plugin bundled with Polish (in polish/plugins/)
      return resolve(BUNDLED_PLUGINS_DIR, plugin.name)

    case 'local':
      // Local plugin - absolute path or relative to Polish root
      if (plugin.path.startsWith('/')) {
        return plugin.path
      }
      if (plugin.path.startsWith('~')) {
        return plugin.path.replace('~', process.env.HOME || '')
      }
      // Relative path - resolve from Polish root (not target repo!)
      return resolve(POLISH_ROOT, plugin.path)

    case 'npm':
      // NPM plugin - resolve from Polish's node_modules
      // Future: could also check user's global npm modules
      return resolve(POLISH_ROOT, 'node_modules', plugin.package)

    case 'url':
      // Remote plugin - not yet supported
      // Future: download to ~/.polish/cache/ and return cached path
      throw new Error(`URL plugins not yet supported: ${plugin.url}`)
  }
}

/**
 * Check if a plugin path exists and is valid
 */
export function validatePluginPath(path: string): { valid: boolean; error?: string } {
  if (!existsSync(path)) {
    return { valid: false, error: `Plugin path does not exist: ${path}` }
  }

  // Check for .claude-plugin/plugin.json (standard plugin format)
  const pluginJsonPath = resolve(path, '.claude-plugin', 'plugin.json')
  if (!existsSync(pluginJsonPath)) {
    // Also accept SKILL.md directly (simpler skill format)
    const skillMdPath = resolve(path, 'SKILL.md')
    if (!existsSync(skillMdPath)) {
      return {
        valid: false,
        error: `Invalid plugin: missing .claude-plugin/plugin.json or SKILL.md at ${path}`
      }
    }
  }

  return { valid: true }
}

/**
 * Convert Polish plugin configs to SDK format
 * SDK only accepts { type: 'local', path: string }
 */
export function resolvePluginsToSdkFormat(
  plugins: PluginConfig[],
  options?: { validate?: boolean }
): SdkPluginConfig[] {
  const sdkPlugins: SdkPluginConfig[] = []

  for (const plugin of plugins) {
    const resolvedPath = resolvePluginPath(plugin)

    if (options?.validate) {
      const validation = validatePluginPath(resolvedPath)
      if (!validation.valid) {
        console.warn(`Skipping invalid plugin: ${validation.error}`)
        continue
      }
    }

    sdkPlugins.push({
      type: 'local',
      path: resolvedPath
    })
  }

  return sdkPlugins
}

/**
 * List all available bundled plugins
 */
export async function listBundledPlugins(): Promise<string[]> {
  const { readdir } = await import('fs/promises')

  try {
    if (!existsSync(BUNDLED_PLUGINS_DIR)) {
      return []
    }

    const entries = await readdir(BUNDLED_PLUGINS_DIR, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  } catch {
    return []
  }
}

/**
 * List all available user plugins
 */
export async function listUserPlugins(): Promise<string[]> {
  const { readdir } = await import('fs/promises')

  try {
    if (!existsSync(USER_PLUGINS_DIR)) {
      return []
    }

    const entries = await readdir(USER_PLUGINS_DIR, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  } catch {
    return []
  }
}

/**
 * Get the Polish root directory (useful for relative path resolution)
 */
export function getPolishRoot(): string {
  return POLISH_ROOT
}

/**
 * Get the bundled plugins directory
 */
export function getBundledPluginsDir(): string {
  return BUNDLED_PLUGINS_DIR
}

/**
 * Get the user plugins directory
 */
export function getUserPluginsDir(): string {
  return USER_PLUGINS_DIR
}
