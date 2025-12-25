import { describe, it, expect } from 'vitest'
import {
  resolveCapabilitiesForPhase,
  getAvailableCapabilities,
  hasCapabilitiesConfig
} from '../capabilities'
import type { Preset, CapabilityOverride } from '../types'

describe('resolveCapabilitiesForPhase', () => {
  it('should return default implement tools when no capabilities configured', () => {
    const preset: Preset = {}
    const result = resolveCapabilitiesForPhase(preset, 'implement')

    expect(result.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'Task'])
  })

  it('should return default polish tools when no capabilities configured', () => {
    const preset: Preset = {}
    const result = resolveCapabilitiesForPhase(preset, 'polish')

    expect(result.tools).toEqual(['Read', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'Task'])
  })

  it('should use phase-specific tools when configured', () => {
    const preset: Preset = {
      capabilities: {
        implement: {
          tools: ['Read', 'Write', 'CustomTool']
        },
        polish: {
          tools: ['Read', 'Edit']
        }
      }
    }

    const implementResult = resolveCapabilitiesForPhase(preset, 'implement')
    expect(implementResult.tools).toEqual(['Read', 'Write', 'CustomTool'])

    const polishResult = resolveCapabilitiesForPhase(preset, 'polish')
    expect(polishResult.tools).toEqual(['Read', 'Edit'])
  })

  it('should merge shared and phase-specific capabilities', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          allowedTools: ['Read', 'Edit'],
          mcpServers: {
            common: { command: 'common-server' }
          }
        },
        implement: {
          allowedTools: ['Write'],
          mcpServers: {
            implementOnly: { command: 'implement-server' }
          }
        }
      }
    }

    const result = resolveCapabilitiesForPhase(preset, 'implement')

    expect(result.allowedTools).toContain('Read')
    expect(result.allowedTools).toContain('Edit')
    expect(result.allowedTools).toContain('Write')
    expect(result.mcpServers).toHaveProperty('common')
    expect(result.mcpServers).toHaveProperty('implementOnly')
  })

  it('should apply capability overrides to disable tools', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          tools: ['Read', 'Write', 'Edit', 'Bash']
        }
      }
    }

    const overrides: CapabilityOverride[] = [
      { type: 'tool', id: 'Bash', enabled: false, phases: ['both'] }
    ]

    const result = resolveCapabilitiesForPhase(preset, 'implement', overrides)

    expect(result.disallowedTools).toContain('Bash')
  })

  it('should respect phase-specific overrides', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          tools: ['Read', 'Write', 'Edit']
        }
      }
    }

    const overrides: CapabilityOverride[] = [
      { type: 'tool', id: 'Write', enabled: false, phases: ['polish'] }
    ]

    const implementResult = resolveCapabilitiesForPhase(preset, 'implement', overrides)
    expect(implementResult.disallowedTools || []).not.toContain('Write')

    const polishResult = resolveCapabilitiesForPhase(preset, 'polish', overrides)
    expect(polishResult.disallowedTools).toContain('Write')
  })

  it('should remove disabled MCP servers', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          mcpServers: {
            server1: { command: 'server1' },
            server2: { command: 'server2' }
          }
        }
      }
    }

    const overrides: CapabilityOverride[] = [
      { type: 'mcpServer', id: 'server1', enabled: false }
    ]

    const result = resolveCapabilitiesForPhase(preset, 'implement', overrides)

    expect(result.mcpServers).not.toHaveProperty('server1')
    expect(result.mcpServers).toHaveProperty('server2')
  })

  it('should resolve plugins to SDK format', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          plugins: [
            { type: 'bundled', name: 'core-skills' }
          ]
        }
      }
    }

    const result = resolveCapabilitiesForPhase(preset, 'implement')

    expect(result.plugins).toBeDefined()
    if (result.plugins) {
      expect(result.plugins[0].type).toBe('local')
      expect(result.plugins[0].path).toContain('core-skills')
    }
  })

  it('should set systemPrompt when systemPromptAppend is provided', () => {
    const preset: Preset = {
      capabilities: {
        implement: {
          systemPromptAppend: 'Extra instructions for implement phase'
        }
      }
    }

    const result = resolveCapabilitiesForPhase(preset, 'implement')

    expect(result.systemPrompt).toEqual({
      type: 'preset',
      preset: 'claude_code',
      append: 'Extra instructions for implement phase'
    })
  })
})

describe('getAvailableCapabilities', () => {
  it('should return default tools when no capabilities configured', () => {
    const preset: Preset = {}
    const result = getAvailableCapabilities(preset)

    expect(result.tools).toContain('Read')
    expect(result.tools).toContain('Write')
    expect(result.tools).toContain('Edit')
  })

  it('should collect all tools from all phases', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          tools: ['Read', 'Edit']
        },
        implement: {
          tools: ['Write']
        },
        polish: {
          tools: ['Glob']
        }
      }
    }

    const result = getAvailableCapabilities(preset)

    expect(result.tools).toContain('Read')
    expect(result.tools).toContain('Edit')
    expect(result.tools).toContain('Write')
    expect(result.tools).toContain('Glob')
  })

  it('should collect all MCP servers', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          mcpServers: {
            common: { command: 'common' }
          }
        },
        implement: {
          mcpServers: {
            implement: { command: 'implement' }
          }
        }
      }
    }

    const result = getAvailableCapabilities(preset)

    expect(result.mcpServers).toContain('common')
    expect(result.mcpServers).toContain('implement')
  })

  it('should collect all plugins without duplicates', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          plugins: [
            { type: 'bundled', name: 'core-skills' }
          ]
        },
        implement: {
          plugins: [
            { type: 'bundled', name: 'core-skills' }, // duplicate
            { type: 'local', path: '/path/to/plugin' }
          ]
        }
      }
    }

    const result = getAvailableCapabilities(preset)

    expect(result.plugins).toHaveLength(2)
    expect(result.plugins.some(p => p.id === 'core-skills')).toBe(true)
    expect(result.plugins.some(p => p.id === '/path/to/plugin')).toBe(true)
  })

  it('should collect all custom agents', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          agents: {
            reviewer: {
              description: 'Code reviewer',
              prompt: 'Review the code'
            }
          }
        }
      }
    }

    const result = getAvailableCapabilities(preset)

    expect(result.agents).toContain('reviewer')
  })
})

describe('hasCapabilitiesConfig', () => {
  it('should return false when no capabilities', () => {
    const preset: Preset = {}
    expect(hasCapabilitiesConfig(preset)).toBe(false)
  })

  it('should return true when capabilities exist', () => {
    const preset: Preset = {
      capabilities: {
        shared: {
          tools: ['Read']
        }
      }
    }
    expect(hasCapabilitiesConfig(preset)).toBe(true)
  })
})
