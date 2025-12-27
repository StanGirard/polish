import type { McpServer } from './types'
import { spawn } from 'child_process'

interface TestResult {
  success: boolean
  error?: string
  tools?: string[]
  latencyMs?: number
}

/**
 * Test connection to an MCP server
 * For stdio: attempts to spawn the process and send MCP initialize
 * For HTTP/SSE: performs a health check request
 */
export async function testMcpConnection(server: McpServer): Promise<TestResult> {
  const startTime = Date.now()

  try {
    if (server.type === 'stdio') {
      return await testStdioServer(server, startTime)
    } else {
      return await testRemoteServer(server, startTime)
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    }
  }
}

async function testStdioServer(server: McpServer, startTime: number): Promise<TestResult> {
  if (!server.command) {
    return { success: false, error: 'No command specified' }
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill()
      resolve({ success: false, error: 'Connection timed out (5s)' })
    }, 5000)

    const child = spawn(server.command!, server.args || [], {
      env: { ...process.env, ...server.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      resolve({
        success: false,
        error: `Failed to spawn process: ${err.message}`
      })
    })

    // Send initialize request per MCP protocol
    const initRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'polish-test', version: '1.0.0' }
      }
    }) + '\n'

    child.stdin?.write(initRequest)

    // Wait for response
    setTimeout(() => {
      clearTimeout(timeout)
      child.kill()

      const latencyMs = Date.now() - startTime

      if (stdout.includes('"result"') || stdout.includes('"capabilities"')) {
        // Try to extract tools from response
        let tools: string[] | undefined
        try {
          const lines = stdout.split('\n').filter(l => l.trim())
          for (const line of lines) {
            const response = JSON.parse(line)
            if (response.result?.capabilities?.tools) {
              tools = Object.keys(response.result.capabilities.tools)
            }
          }
        } catch {
          // Ignore parse errors
        }

        resolve({
          success: true,
          latencyMs,
          tools
        })
      } else if (stderr && !stdout) {
        resolve({ success: false, error: stderr.slice(0, 200) })
      } else {
        // Process started but no clear response - consider it a success
        resolve({ success: true, latencyMs })
      }
    }, 2000)
  })
}

async function testRemoteServer(server: McpServer, startTime: number): Promise<TestResult> {
  if (!server.url) {
    return { success: false, error: 'No URL specified' }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    // For SSE, we do a GET request; for HTTP, we could do a POST
    const response = await fetch(server.url, {
      method: server.type === 'sse' ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': server.type === 'sse' ? 'text/event-stream' : 'application/json',
        ...server.headers
      },
      signal: controller.signal,
      // For POST, send a minimal body
      ...(server.type === 'http' ? {
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'polish-test', version: '1.0.0' }
          }
        })
      } : {})
    })

    clearTimeout(timeoutId)

    const latencyMs = Date.now() - startTime

    // 200, 201, or even 405 (method not allowed) means server is responding
    if (response.ok || response.status === 405 || response.status === 400) {
      return { success: true, latencyMs }
    } else {
      return {
        success: false,
        error: `Server returned ${response.status}: ${response.statusText}`
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Connection timed out (5s)' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}
