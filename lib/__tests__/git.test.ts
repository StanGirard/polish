import { describe, it, expect } from 'vitest'
import { createTempDir } from '../git'

describe('git utilities', () => {
  describe('createTempDir', () => {
    it('should create a temp directory path with timestamp', () => {
      const path = createTempDir()
      expect(path).toMatch(/^\/tmp\/polish-\d+-[a-z0-9]+$/)
    })

    it('should create unique paths on subsequent calls', () => {
      const path1 = createTempDir()
      const path2 = createTempDir()
      expect(path1).not.toBe(path2)
    })

    it('should include timestamp in path', () => {
      const before = Date.now()
      const path = createTempDir()
      const after = Date.now()

      const timestampMatch = path.match(/polish-(\d+)-/)
      expect(timestampMatch).not.toBeNull()

      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1], 10)
        expect(timestamp).toBeGreaterThanOrEqual(before)
        expect(timestamp).toBeLessThanOrEqual(after)
      }
    })

    it('should include random suffix', () => {
      const path = createTempDir()
      const suffixMatch = path.match(/-([a-z0-9]+)$/)
      expect(suffixMatch).not.toBeNull()

      if (suffixMatch) {
        const suffix = suffixMatch[1]
        expect(suffix.length).toBeGreaterThan(0)
        expect(suffix).toMatch(/^[a-z0-9]+$/)
      }
    })
  })
})
