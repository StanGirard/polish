'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('')
  const [duration, setDuration] = useState(3600) // 1 hour default
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, duration }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start polish job')
      }

      const { jobId } = await res.json()
      router.push(`/job/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full">
        <h1 className="text-4xl font-bold mb-2">Polish</h1>
        <p className="text-gray-400 mb-8">
          Automated code quality improvement. Run an LLM in a loop to fix lint errors,
          type issues, add tests, and more.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="repoUrl" className="block text-sm font-medium mb-2">
              GitHub Repository URL
            </label>
            <input
              type="url"
              id="repoUrl"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium mb-2">
              Duration: {duration >= 3600 ? `${duration / 3600}h` : `${duration / 60}min`}
            </label>
            <input
              type="range"
              id="duration"
              min={1800}
              max={7200}
              step={1800}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>30min</span>
              <span>1h</span>
              <span>1.5h</span>
              <span>2h</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? 'Starting...' : 'Start Polishing'}
          </button>
        </form>
      </div>
    </main>
  )
}
