'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface JobStatus {
  id: string
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'CANCELED'
  output?: {
    scoreBefore: number
    scoreAfter: number
    iterations: number
    commits: string[]
    prUrl?: string
    durationSeconds: number
    costEstimate: number
  }
  createdAt: string
  updatedAt: string
}

export default function JobPage() {
  const params = useParams()
  const jobId = params.id as string

  const [job, setJob] = useState<JobStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/polish?jobId=${jobId}`)
        if (!res.ok) {
          throw new Error('Job not found')
        }
        const data = await res.json()
        setJob(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load job')
      } finally {
        setLoading(false)
      }
    }

    fetchJob()

    // Poll for updates if job is still running
    const interval = setInterval(async () => {
      if (job?.status === 'PENDING' || job?.status === 'EXECUTING') {
        try {
          const res = await fetch(`/api/polish?jobId=${jobId}`)
          if (res.ok) {
            const data = await res.json()
            setJob(data)
          }
        } catch {
          // Ignore polling errors
        }
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [jobId, job?.status])

  const getStatusColor = (status: JobStatus['status']) => {
    switch (status) {
      case 'PENDING':
        return 'text-yellow-400'
      case 'EXECUTING':
        return 'text-blue-400'
      case 'COMPLETED':
        return 'text-green-400'
      case 'FAILED':
        return 'text-red-400'
      case 'CANCELED':
        return 'text-gray-400'
      default:
        return 'text-gray-400'
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
        <div className="text-red-400 mb-4">{error}</div>
        <Link href="/" className="text-blue-400 hover:underline">
          ← Back to home
        </Link>
      </main>
    )
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
        <div className="text-gray-400 mb-4">Job not found</div>
        <Link href="/" className="text-blue-400 hover:underline">
          ← Back to home
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-blue-400 hover:underline mb-6 inline-block">
          ← Back to home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Polish Job</h1>
        <p className="text-gray-400 font-mono text-sm mb-8">{jobId}</p>

        <div className="bg-gray-900 rounded-lg p-6 space-y-6">
          {/* Status */}
          <div>
            <div className="text-sm text-gray-500 mb-1">Status</div>
            <div className={`text-lg font-medium ${getStatusColor(job.status)}`}>
              {job.status}
              {job.status === 'EXECUTING' && (
                <span className="ml-2 animate-pulse">●</span>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Created</div>
              <div className="text-gray-300">
                {new Date(job.createdAt).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Updated</div>
              <div className="text-gray-300">
                {new Date(job.updatedAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Results (when completed) */}
          {job.output && (
            <>
              <hr className="border-gray-800" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Score Before</div>
                  <div className="text-2xl font-bold text-gray-300">
                    {job.output.scoreBefore.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Score After</div>
                  <div className="text-2xl font-bold text-green-400">
                    {job.output.scoreAfter.toFixed(1)}
                    <span className="text-sm font-normal text-green-500 ml-2">
                      +{(job.output.scoreAfter - job.output.scoreBefore).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Iterations</div>
                  <div className="text-lg text-gray-300">{job.output.iterations}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Commits</div>
                  <div className="text-lg text-gray-300">{job.output.commits.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Duration</div>
                  <div className="text-lg text-gray-300">
                    {formatDuration(job.output.durationSeconds)}
                  </div>
                </div>
              </div>

              {job.output.prUrl && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Pull Request</div>
                  <a
                    href={job.output.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                  >
                    View PR on GitHub →
                  </a>
                </div>
              )}

              <div>
                <div className="text-sm text-gray-500 mb-1">Estimated Cost</div>
                <div className="text-gray-300">
                  ${job.output.costEstimate.toFixed(4)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
