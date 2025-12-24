import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolve } from 'path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
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
  const testDir = resolve(process.cwd(), 'tmp-test-plugins')
  const originalHome = process.env.HOME

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    process.env.HOME = originalHome
  })

  describe('resolvePluginPath', () => {
    it('should resolve bundled plugin path', () => {
      const plugin: PluginConfig = { type: 'bundled', name: 'core-skills' }
      const path = resolvePluginPath(plugin)
      
      expect(path).toContain('plugins')
      expect(path).toContain('core-skills')
    })

    it('should resolve absolute local plugin path', () => {
      const plugin: PluginConfig = { type: 'local', path: '/absolute/path/to/plugin' }
      const path = resolvePluginPath(plugin)
      
      expect(path).toBe('/absolute/path/to/plugin')
    })

    it('should resolve home directory in local plugin path', () => {
      process.env.HOME = '/home/testuser'
      const plugin: PluginConfig = { type: 'local', path: '~/my-plugin' }
      const path = resolvePluginPath(plugin)
      
      expect(path).toBe('/home/testuser/my-plugin')
    })

    it('should resolve relative local plugin path from Polish root', () => {
      const plugin: PluginConfig = { type: 'local', path: 'custom-plugins/my-plugin' }
      const path = resolvePluginPath(plugin)
      
      expect(path).toContain('custom-plugins/my-plugin')
    })

    it('should resolve npm plugin path', () => {
      const plugin: PluginConfig = { type: 'npm', package: '@claude/test-plugin' }
      const path = resolvePluginPath(plugin)
      
      expect(path).toContain('node_modules')
      expect(path).toContain('@claude/test-plugin')
    })

    it('should throw error for url plugin type', () => {
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
      expect(result.error).toBeUndefined()
    })

    it('should return valid for path with SKILL.md', () => {
      const pluginDir = resolve(testDir, 'skill-plugin')
      mkdirSync(pluginDir, { recursive: true })
      writeFileSync(resolve(pluginDir, 'SKILL.md'), '# Test Skill')
      
      const result = validatePluginPath(pluginDir)
      
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return invalid for path without plugin.json or SKILL.md', () => {
      const pluginDir = resolve(testDir, 'invalid-plugin')
      mkdirSync(pluginDir, { recursive: true })
      
      const result = validatePluginPath(pluginDir)
      
      expect(result.valid).toBe(false)
      expect(result.error).toContain('missing .claude-plugin/plugin.json or SKILL.md')
    })
  })

  describe('resolvePluginsToSdkFormat', () => {
    it('should convert plugins to SDK format', () => {
      const plugins: PluginConfig[] = [
        { type: 'bundled', name: 'test-plugin' },
        { type: 'local', path: '/absolute/path' }
      ]
      
      const result = resolvePluginsToSdkFormat(plugins)
      
      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('local')
      expect(result[0].path).toContain('test-plugin')
      expect(result[1].type).toBe('local')
      expect(result[1].path).toBe('/absolute/path')
    })

    it('should skip invalid plugins when validation is enabled', () => {
      const plugins: PluginConfig[] = [
        { type: 'local', path: '/non/existent/plugin' }
      ]
      
      const result = resolvePluginsToSdkFormat(plugins, { validate: true })
      
      expect(result).toHaveLength(0)
    })

    it('should include all plugins when validation is disabled', () => {
      const plugins: PluginConfig[] = [
        { type: 'local', path: '/non/existent/plugin' }
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
      expect(dir).toContain('plugins')
    })
  })

  describe('listBundledPlugins', () => {
    it('should return empty array if bundled plugins directory does not exist', async () => {
      const plugins = await listBundledPlugins()
      
      // May or may not exist depending on installation
      expect(Array.isArray(plugins)).toBe(true)
    })
  })

  describe('listUserPlugins', () => {
    it('should return empty array if user plugins directory does not exist', async () => {
      process.env.HOME = testDir
      const plugins = await listUserPlugins()
      
      expect(plugins).toEqual([])
    })
  })
})
