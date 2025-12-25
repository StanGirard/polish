import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import {
  resolvePluginPath,
  validatePluginPath,
  resolvePluginsToSdkFormat,
  getPolishRoot,
  getBundledPluginsDir,
  getUserPluginsDir,
  listBundledPlugins,
  listUserPlugins
} from '../plugin-loader'
import type { PluginConfig } from '../types'

describe('plugin-loader', () => {
  const testDir = resolve(process.cwd(), 'test-plugins')

  beforeEach(() => {
    // Create test directory
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up
    rmSync(testDir, { recursive: true, force: true })
  })

  describe('resolvePluginPath', () => {
    it('should resolve bundled plugin path', () => {
      const plugin: PluginConfig = { type: 'bundled', name: 'core-skills' }
      const path = resolvePluginPath(plugin)
      expect(path).toContain('plugins/core-skills')
    })

    it('should resolve absolute local plugin path', () => {
      const plugin: PluginConfig = { type: 'local', path: '/absolute/path' }
      const path = resolvePluginPath(plugin)
      expect(path).toBe('/absolute/path')
    })

    it('should resolve home directory path', () => {
      const plugin: PluginConfig = { type: 'local', path: '~/my-plugin' }
      const path = resolvePluginPath(plugin)
      expect(path).toContain('my-plugin')
      expect(path).not.toContain('~')
    })

    it('should resolve relative plugin path from Polish root', () => {
      const plugin: PluginConfig = { type: 'local', path: 'custom/plugin' }
      const path = resolvePluginPath(plugin)
      expect(path).toContain('custom/plugin')
    })

    it('should resolve npm plugin path', () => {
      const plugin: PluginConfig = { type: 'npm', package: '@claude/test-plugin' }
      const path = resolvePluginPath(plugin)
      expect(path).toContain('node_modules/@claude/test-plugin')
    })

    it('should throw error for URL plugins', () => {
      const plugin: PluginConfig = { type: 'url', url: 'https://example.com/plugin' }
      expect(() => resolvePluginPath(plugin)).toThrow('URL plugins not yet supported')
    })
  })

  describe('validatePluginPath', () => {
    it('should return invalid for non-existent path', () => {
      const result = validatePluginPath('/non/existent/path')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('does not exist')
    })

    it('should return valid for path with plugin.json', () => {
      const pluginDir = resolve(testDir, 'valid-plugin')
      const claudePluginDir = resolve(pluginDir, '.claude-plugin')
      mkdirSync(claudePluginDir, { recursive: true })
      writeFileSync(resolve(claudePluginDir, 'plugin.json'), '{}')

      const result = validatePluginPath(pluginDir)
      expect(result.valid).toBe(true)
    })

    it('should return valid for path with SKILL.md', () => {
      const pluginDir = resolve(testDir, 'skill-plugin')
      mkdirSync(pluginDir, { recursive: true })
      writeFileSync(resolve(pluginDir, 'SKILL.md'), '# Skill')

      const result = validatePluginPath(pluginDir)
      expect(result.valid).toBe(true)
    })

    it('should return invalid for path without plugin markers', () => {
      const pluginDir = resolve(testDir, 'invalid-plugin')
      mkdirSync(pluginDir, { recursive: true })

      const result = validatePluginPath(pluginDir)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('missing .claude-plugin/plugin.json or SKILL.md')
    })
  })

  describe('resolvePluginsToSdkFormat', () => {
    it('should convert bundled plugin to SDK format', () => {
      const plugins: PluginConfig[] = [
        { type: 'bundled', name: 'test-plugin' }
      ]

      const result = resolvePluginsToSdkFormat(plugins)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('local')
      expect(result[0].path).toContain('plugins/test-plugin')
    })

    it('should convert multiple plugins', () => {
      const plugins: PluginConfig[] = [
        { type: 'bundled', name: 'plugin1' },
        { type: 'local', path: '/absolute/path' }
      ]

      const result = resolvePluginsToSdkFormat(plugins)
      expect(result).toHaveLength(2)
    })

    it('should skip invalid plugins when validation enabled', () => {
      const plugins: PluginConfig[] = [
        { type: 'local', path: '/non/existent' }
      ]

      const result = resolvePluginsToSdkFormat(plugins, { validate: true })
      expect(result).toHaveLength(0)
    })

    it('should include invalid plugins when validation disabled', () => {
      const plugins: PluginConfig[] = [
        { type: 'local', path: '/non/existent' }
      ]

      const result = resolvePluginsToSdkFormat(plugins, { validate: false })
      expect(result).toHaveLength(1)
    })
  })

  describe('directory getters', () => {
    it('should return Polish root directory', () => {
      const root = getPolishRoot()
      expect(root).toBeTruthy()
      expect(typeof root).toBe('string')
    })

    it('should return bundled plugins directory', () => {
      const dir = getBundledPluginsDir()
      expect(dir).toContain('plugins')
    })

    it('should return user plugins directory', () => {
      const dir = getUserPluginsDir()
      expect(dir).toContain('.polish')
    })
  })

  describe('listBundledPlugins', () => {
    it('should return empty array if bundled plugins directory does not exist', async () => {
      // The bundled plugins directory might not exist
      const plugins = await listBundledPlugins()
      expect(Array.isArray(plugins)).toBe(true)
    })

    it('should list directories in bundled plugins directory', async () => {
      // We can test this returns an array even if the directory doesn't exist
      const plugins = await listBundledPlugins()
      expect(plugins).toBeInstanceOf(Array)
      // All items should be strings (directory names)
      plugins.forEach(plugin => {
        expect(typeof plugin).toBe('string')
      })
    })
  })

  describe('listUserPlugins', () => {
    it('should return empty array if user plugins directory does not exist', async () => {
      // The user plugins directory might not exist
      const plugins = await listUserPlugins()
      expect(Array.isArray(plugins)).toBe(true)
    })

    it('should list directories in user plugins directory', async () => {
      // We can test this returns an array even if the directory doesn't exist
      const plugins = await listUserPlugins()
      expect(plugins).toBeInstanceOf(Array)
      // All items should be strings (directory names)
      plugins.forEach(plugin => {
        expect(typeof plugin).toBe('string')
      })
    })
  })
})
